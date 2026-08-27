"""Sketch2UI CV worker — FastAPI inference service.

Plan references: section 7.1 (CV worker responsibilities), section 7.6 (error model),
section 19.6 (not exposed to the public internet — only the API talks to it),
section 10 (page boundary and external-annotation filtering), section 51 steps 9-10.

Loads one frozen model version, runs YOLO inference, detects the page boundary
(section 10.3 Strategy B) and applies the section 10.4 hard filtering rule, returning
Detection-shaped JSON.

Perspective correction and cropping (section 10.2) are deliberately NOT done — the
boundary is reported as a polygon in the original image's coordinate space and nothing
is warped. See app/preprocessing/page_boundary.py for why.

Run:
    cv-service/.venv/bin/uvicorn main:app --port 8000 --app-dir cv-service
"""

from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.responses import JSONResponse

from app.detector.model import ModelError, build_detector
from app.preprocessing.boundary_filter import (
    DEFAULT_OVERLAP_THRESHOLD,
    boundary_is_usable,
    should_accept,
)
from app.preprocessing.page_boundary import detect_page_boundary
from app.schemas.detection import (
    BBox,
    DetectedComponent,
    DetectResponse,
    ErrorBody,
    ErrorResponse,
    HealthResponse,
    PageBoundaryModel,
)

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger("cv-worker")

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

detector = build_detector()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load weights once at startup, not per request (section 51 step 9 requirement).
    # A failure here is logged rather than fatal so /health can report modelLoaded=false
    # and the API can surface a clean MODEL_UNAVAILABLE instead of a connection refusal.
    try:
        detector.load()
    except ModelError as exc:
        logger.error("Model load failed: %s (%s)", exc.message, exc.code)
    yield


app = FastAPI(title="Sketch2UI CV worker", version="0.1.0", lifespan=lifespan)


def error_response(status: int, code: str, message: str, retryable: bool) -> JSONResponse:
    """Section 7.6: consistent error JSON. Never surfaces a Python traceback."""
    return JSONResponse(
        status_code=status,
        content=ErrorResponse(
            error=ErrorBody(code=code, message=message, retryable=retryable)
        ).model_dump(),
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if detector.loaded else "degraded",
        modelVersionId=detector.version,
        modelLoaded=detector.loaded,
        classes=len(detector.class_names),
    )


@app.post("/detect")
async def detect(
    file: UploadFile = File(...),
    confidence: Optional[float] = Query(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override the configured confidence threshold.",
    ),
):
    """Run component detection on one image.

    Detections outside the detected page boundary come back with status "rejected"
    rather than being dropped (section 10.7). When no boundary is found, or its
    confidence is too low to trust, everything stays active and `pageBoundary.applied`
    is false.
    """
    if not detector.loaded:
        return error_response(
            503,
            "MODEL_UNAVAILABLE",
            "The detection model is not loaded.",
            retryable=True,
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        return error_response(
            400,
            "INVALID_IMAGE",
            f"Unsupported content type '{file.content_type}'. Expected PNG, JPEG or WebP.",
            retryable=False,
        )

    payload = await file.read()
    if len(payload) == 0:
        return error_response(400, "INVALID_IMAGE", "Uploaded file is empty.", retryable=False)
    if len(payload) > MAX_UPLOAD_BYTES:
        return error_response(
            413,
            "INVALID_IMAGE",
            f"Image exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB limit.",
            retryable=False,
        )

    suffix = Path(file.filename or "upload.png").suffix or ".png"
    tmp_path: Optional[str] = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(payload)
            tmp_path = tmp.name

        detections, width, height, threshold, duration_ms = detector.predict(
            tmp_path, confidence=confidence
        )

        # Section 10: find the page region, then apply the 10.4 hard filtering rule.
        # Runs AFTER inference, on the original (uncropped) image — see the deferral
        # note in app/preprocessing/page_boundary.py.
        boundary = detect_page_boundary(tmp_path)
        apply_boundary = boundary.method != "none" and boundary_is_usable(
            boundary.confidence
        )
    except ModelError as exc:
        status = 503 if exc.retryable else 400
        return error_response(status, exc.code, exc.message, exc.retryable)
    except Exception as exc:  # noqa: BLE001 - never leak a traceback (section 7.6)
        logger.exception("Unhandled error during detection")
        return error_response(
            500, "INFERENCE_FAILED", "Detection failed unexpectedly.", retryable=True
        )
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    components: List[DetectedComponent] = []
    rejected = 0

    for d in detections:
        inside_fraction = None
        status = "active"

        if apply_boundary:
            accepted, inside_fraction = should_accept(
                (d.x, d.y, d.width, d.height), boundary.polygon
            )
            inside_fraction = round(inside_fraction, 4)
            if not accepted:
                # Section 10.7: keep it, flagged. Never silently drop.
                status = "rejected"
                rejected += 1

        components.append(
            DetectedComponent(
                className=d.class_name,
                confidence=round(d.confidence, 4),
                bbox=BBox(x=d.x, y=d.y, width=d.width, height=d.height),
                modelVersionId=detector.version,
                status=status,
                insideFraction=inside_fraction,
            )
        )

    return DetectResponse(
        detections=components,
        modelVersionId=detector.version,
        imageWidth=width,
        imageHeight=height,
        confidenceThreshold=threshold,
        durationMs=round(duration_ms, 1),
        pageBoundary=PageBoundaryModel(
            polygon=[[x, y] for x, y in boundary.polygon],
            confidence=boundary.confidence,
            method=boundary.method,
            areaFraction=boundary.area_fraction,
            applied=apply_boundary,
            overlapThreshold=DEFAULT_OVERLAP_THRESHOLD if apply_boundary else None,
        ),
        rejectedCount=rejected,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", 8000)))
