"""YOLO model loading and inference.

Plan references: section 7.1 (CV worker responsibilities), section 9.10 (model registry),
section 51 step 9.

Deliberately NOT here: page-boundary detection and external-annotation filtering. That is
section 10 / section 51 step 10, explicitly the step after this one. This module returns
raw confidence-filtered detections only.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
REGISTRY_ROOT = REPO_ROOT / "ml" / "models" / "ui-detector"

DEFAULT_MODEL_VERSION = "v1.0.0"
DEFAULT_CONFIDENCE = 0.5


class ModelError(Exception):
    """Raised when the model cannot be loaded or inference fails."""

    def __init__(self, code: str, message: str, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


@dataclass
class Detection:
    class_name: str
    confidence: float
    # Normalized, top-left origin.
    x: float
    y: float
    width: float
    height: float


class UIDetector:
    """Wraps one frozen model version from the section 9.10 registry.

    The weights are loaded once at startup, not per request — a per-request load would
    dominate inference time and defeat the point of a long-lived service.
    """

    def __init__(
        self,
        version: str = DEFAULT_MODEL_VERSION,
        confidence: float = DEFAULT_CONFIDENCE,
    ) -> None:
        self.version = version
        self.default_confidence = confidence
        self.model = None
        self.class_names: List[str] = []

    @property
    def version_dir(self) -> Path:
        return REGISTRY_ROOT / self.version

    def load(self) -> None:
        version_dir = self.version_dir
        weights = version_dir / "weights.pt"
        classes_file = version_dir / "classes.txt"

        if not weights.exists():
            raise ModelError(
                "MODEL_UNAVAILABLE",
                f"No weights at {weights}. Train and freeze a model version first.",
                retryable=False,
            )
        if not classes_file.exists():
            raise ModelError(
                "MODEL_UNAVAILABLE",
                f"No classes.txt at {classes_file}.",
                retryable=False,
            )

        # CRITICAL: the class order comes from the MODEL VERSION's own classes.txt, not
        # from the full 41-class taxonomy. v1.0.0 was trained on a 16-class subset with
        # its own contiguous ids (see ml/dataset/v1-training-scope.md); reading the
        # taxonomy here would mislabel every single detection.
        self.class_names = [
            line.strip()
            for line in classes_file.read_text().splitlines()
            if line.strip()
        ]

        from ultralytics import YOLO  # imported lazily: heavy, and only needed on load

        self.model = YOLO(str(weights))
        logger.info(
            "Loaded ui-detector %s (%d classes) from %s",
            self.version,
            len(self.class_names),
            weights,
        )

    @property
    def loaded(self) -> bool:
        return self.model is not None

    def predict(
        self,
        image_path: str,
        confidence: Optional[float] = None,
    ) -> tuple[List[Detection], int, int, float, float]:
        """Run inference. Returns (detections, width, height, threshold, duration_ms)."""
        if self.model is None:
            raise ModelError(
                "MODEL_UNAVAILABLE", "Model is not loaded.", retryable=True
            )

        threshold = self.default_confidence if confidence is None else confidence

        # Decode-check BEFORE inference so a corrupt file is classified as
        # INVALID_IMAGE (not retryable) rather than falling through to a generic
        # inference error. Section 27.4 is explicit: invalid images must not be retried,
        # and ultralytics raises the same opaque exception for both cases.
        try:
            from PIL import Image

            with Image.open(image_path) as probe:
                probe.verify()
        except Exception as exc:  # noqa: BLE001 - re-raised as a typed ModelError
            raise ModelError(
                "INVALID_IMAGE",
                "The uploaded file could not be decoded as an image.",
                retryable=False,
            ) from exc

        started = time.perf_counter()

        try:
            results = self.model.predict(
                source=image_path,
                conf=threshold,
                verbose=False,
                device="cpu",
            )
        except Exception as exc:  # noqa: BLE001 - re-raised as a typed ModelError
            logger.exception("Inference failed")
            raise ModelError(
                "INFERENCE_FAILED", f"Inference failed: {exc}", retryable=True
            ) from exc

        duration_ms = (time.perf_counter() - started) * 1000.0

        if not results:
            return [], 0, 0, threshold, duration_ms

        result = results[0]
        height, width = result.orig_shape  # ultralytics gives (h, w)

        detections: List[Detection] = []
        boxes = getattr(result, "boxes", None)
        if boxes is not None:
            # xywhn = center-x, center-y, w, h, all normalized to [0,1].
            for xywhn, cls_id, conf in zip(boxes.xywhn, boxes.cls, boxes.conf):
                cx, cy, w, h = (float(v) for v in xywhn)
                idx = int(cls_id)
                if idx < 0 or idx >= len(self.class_names):
                    logger.warning("Model emitted class id %d outside classes.txt", idx)
                    continue

                # Center-origin -> top-left origin, which is what the TS BBox uses.
                x = cx - w / 2.0
                y = cy - h / 2.0

                # Clamp: a box may sit a hair outside the frame after the shift, and the
                # TS side treats bboxes as strictly within [0,1].
                x = min(max(x, 0.0), 1.0)
                y = min(max(y, 0.0), 1.0)
                w = min(w, 1.0 - x)
                h = min(h, 1.0 - y)
                if w <= 0 or h <= 0:
                    continue

                detections.append(
                    Detection(
                        class_name=self.class_names[idx],
                        confidence=float(conf),
                        x=x,
                        y=y,
                        width=w,
                        height=h,
                    )
                )

        return detections, int(width), int(height), threshold, duration_ms


def build_detector() -> UIDetector:
    return UIDetector(
        version=os.environ.get("MODEL_VERSION", DEFAULT_MODEL_VERSION),
        confidence=float(os.environ.get("CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE)),
    )
