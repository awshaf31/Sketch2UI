"""Response shapes for the CV worker.

These mirror `packages/shared-types/src/detection.ts` so the API can persist what
comes back with no reshaping. Keep the two in sync by hand — there is no codegen
between the TS and Python type definitions.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class BBox(BaseModel):
    """Normalized, TOP-LEFT origin — matches the TS `BBox`.

    YOLO emits center-origin xywh; the conversion happens in the detector, not here.
    """

    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    width: float = Field(gt=0.0, le=1.0)
    height: float = Field(gt=0.0, le=1.0)


class DetectedComponent(BaseModel):
    """One model detection, shaped for the TS `Detection` type.

    The API fills in `id`, `projectId`, `sourceAssetId`, and timestamps — the worker is
    stateless and knows nothing about projects.
    """

    className: str
    confidence: float
    bbox: BBox
    source: Literal["model"] = "model"
    modelVersionId: str
    # Section 10.4/10.7: a detection outside the page boundary is REJECTED, not dropped.
    # The API persists it with status "rejected" so the note stays visible in the UI.
    status: Literal["active", "rejected"] = "active"
    # Fraction of this box inside the page polygon. None when no boundary was applied.
    insideFraction: Optional[float] = None


class PageBoundaryModel(BaseModel):
    """Detected page region — section 10.6.

    `polygon` is 4 [x, y] points, normalized to [0,1] against the ORIGINAL image
    (top-left, top-right, bottom-right, bottom-left). No perspective correction or
    cropping is applied — see the module docstring in app/preprocessing/page_boundary.py
    for why that is deliberately deferred.
    """

    polygon: List[List[float]]
    confidence: float
    method: str  # "contour" | "none"
    areaFraction: float
    # Whether this boundary was actually used to filter. False when confidence is too
    # low to trust, in which case every detection stays active.
    applied: bool
    overlapThreshold: Optional[float] = None


class DetectResponse(BaseModel):
    detections: List[DetectedComponent]
    modelVersionId: str
    imageWidth: int
    imageHeight: int
    confidenceThreshold: float
    durationMs: float
    # Additive: existing callers that ignore this field keep working unchanged.
    pageBoundary: Optional[PageBoundaryModel] = None
    rejectedCount: int = 0


class ErrorBody(BaseModel):
    """Matches the plan's section 7.6 error model."""

    code: str
    message: str
    retryable: bool = False


class ErrorResponse(BaseModel):
    error: ErrorBody


class HealthResponse(BaseModel):
    status: str
    modelVersionId: Optional[str]
    modelLoaded: bool
    classes: int
