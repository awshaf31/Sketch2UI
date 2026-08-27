"""Page boundary detection — plan section 10, Strategy B (OpenCV contours).

Strategy A (an explicit trained `page` class, section 10.3) is NOT available: the frozen
v1.0.0 detector trains on a 16-class subset that excludes `page` for lack of
train/val/test coverage. See ml/dataset/v1-training-scope.md.

Strategy C (manual correction) is the required fallback and lives in the web UI — this
module always returns *something*, including an explicit low-confidence "no boundary
found" result the UI can present as "using full image".

SCOPE — deliberate deferral
---------------------------
Section 10.2's pipeline includes perspective correction and cropping between boundary
detection and inference. That is **out of scope for this pass and intentionally so.**
The boundary is detected and reported as a polygon in the ORIGINAL image's normalized
coordinate space; nothing is warped, cropped, or re-based. Rectifying the image would
change the coordinate space every detection, the canvas overlay, and the stored asset
all depend on — a much larger change that does not block the filtering value this step
delivers. Detections and the polygon therefore share one coordinate space, which is also
what lets the client re-filter without a round trip.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# A page must occupy a good fraction of the frame. Below this a contour is far more
# likely to be a drawn component (a card, a big image box) than the page itself.
MIN_AREA_FRACTION = 0.30

# Above this the "boundary" is indistinguishable from the image border, which is the
# normal case for an already-cropped digital sketch. Reported as no-boundary rather than
# a meaningless full-frame quad.
FULL_FRAME_AREA_FRACTION = 0.985

# A page must contain essentially all of the drawing. See _ink_containment — this is the
# guard that separates a real page boundary from a large drawn content container, which
# area and rectangularity alone cannot distinguish. Empirically the sample sketches score
# >0.95 here while container false positives sat near 0.6.
MIN_INK_CONTAINMENT = 0.90

# approxPolyDP epsilon as a fraction of contour perimeter, tried in order. Different
# sketches need different tolerance before a contour collapses to exactly 4 points.
APPROX_EPSILON_STEPS = (0.02, 0.03, 0.04, 0.05, 0.015, 0.01)

Point = Tuple[float, float]


@dataclass
class PageBoundary:
    """A detected page region.

    `polygon` is 4 points, normalized to [0,1] against the ORIGINAL image and ordered
    top-left, top-right, bottom-right, bottom-left.
    """

    polygon: List[Point]
    confidence: float
    method: str  # "contour" | "none"
    area_fraction: float

    @classmethod
    def none_found(cls, reason: str) -> "PageBoundary":
        """No plausible boundary. The full image is the page — a normal outcome for a
        tightly-cropped digital sketch, not an error."""
        return cls(
            polygon=[(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
            confidence=0.0,
            method="none",
            area_fraction=1.0,
        )


def _order_corners(points: np.ndarray) -> List[Point]:
    """Order 4 points as TL, TR, BR, BL.

    x+y is smallest at top-left and largest at bottom-right; x-y separates the other two.
    """
    pts = points.reshape(4, 2).astype(np.float64)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).reshape(-1)

    return [
        tuple(pts[np.argmin(s)]),   # top-left
        tuple(pts[np.argmin(d)]),   # top-right
        tuple(pts[np.argmax(s)]),   # bottom-right
        tuple(pts[np.argmax(d)]),   # bottom-left
    ]


def _ink_containment(quad: np.ndarray, gray: np.ndarray) -> float:
    """Fraction of the image's drawn ink that falls inside the quad, in [0,1].

    This is the guard against the dominant false positive: a large *drawn component*
    (a content container, a table, a hero box) reduces to a clean 4-point convex quad
    just as readily as a sheet of paper does, and area alone cannot tell them apart.

    A real page boundary contains essentially all the drawing. A content container leaves
    the header, nav and footer outside it. Measured directly, that difference is stark —
    on the sample sketches containment runs >0.95, while the container false positives
    sat near 0.6.
    """
    # Adaptive threshold isolates strokes without assuming a global ink/paper contrast,
    # which varies wildly between a phone photo and a clean digital export.
    ink = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 8
    )
    total = float(cv2.countNonZero(ink))
    if total <= 0:
        return 1.0  # nothing drawn; containment is vacuously satisfied

    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillPoly(mask, [quad.reshape(-1, 2).astype(np.int32)], 255)
    inside = float(cv2.countNonZero(cv2.bitwise_and(ink, ink, mask=mask)))

    return min(inside / total, 1.0)


def _rectangularity(quad: np.ndarray, contour: np.ndarray) -> float:
    """How much the quad looks like the contour it approximates, in [0,1].

    Ratio of contour area to the quad's area: a genuine page fills its own quad almost
    completely, whereas a ragged blob that happens to reduce to 4 points does not.
    """
    quad_area = abs(cv2.contourArea(quad.astype(np.float32)))
    if quad_area <= 0:
        return 0.0
    return float(min(abs(cv2.contourArea(contour)) / quad_area, 1.0))


def _candidate_quads(binary: np.ndarray, image_area: float) -> List[Tuple[np.ndarray, np.ndarray]]:
    """Find contours large enough to be a page and reducible to 4 points."""
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: List[Tuple[np.ndarray, np.ndarray]] = []

    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:10]:
        area = abs(cv2.contourArea(contour))
        if area < image_area * MIN_AREA_FRACTION:
            continue

        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue

        for eps in APPROX_EPSILON_STEPS:
            approx = cv2.approxPolyDP(contour, eps * perimeter, True)
            if len(approx) == 4 and cv2.isContourConvex(approx):
                out.append((approx, contour))
                break

    return out


def detect_page_boundary(image_path: str) -> PageBoundary:
    """Detect the drawn page region — section 10.3 Strategy B.

    Never raises for "nothing found": that is a legitimate result reported as
    confidence 0.0 with method "none".
    """
    image = cv2.imread(image_path)
    if image is None:
        logger.warning("Could not read %s for boundary detection", image_path)
        return PageBoundary.none_found("unreadable")

    height, width = image.shape[:2]
    image_area = float(width * height)
    if image_area <= 0:
        return PageBoundary.none_found("degenerate")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Two complementary binarizations. Canny finds a crisp paper edge against a
    # contrasting background; adaptive threshold copes with a page whose edge is a drawn
    # line rather than a lighting change. Whichever yields the better quad wins.
    candidates: List[Tuple[np.ndarray, np.ndarray]] = []

    edges = cv2.Canny(blurred, 50, 150)
    # Close small gaps so a slightly broken page edge still forms one closed contour.
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    candidates.extend(_candidate_quads(edges, image_area))

    adaptive = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 8
    )
    adaptive = cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    candidates.extend(_candidate_quads(adaptive, image_area))

    if not candidates:
        return PageBoundary.none_found("no-large-quad")

    best: Optional[Tuple[float, np.ndarray, float]] = None
    for quad, contour in candidates:
        quad_area = abs(cv2.contourArea(quad.astype(np.float32)))
        area_fraction = quad_area / image_area
        if area_fraction < MIN_AREA_FRACTION:
            continue

        # A quad covering essentially the whole frame carries no information — the image
        # is already cropped to the page. Treat it as no-boundary so the UI says
        # "using full image" instead of drawing a box on the image border.
        if area_fraction >= FULL_FRAME_AREA_FRACTION:
            continue

        # A quad that leaves a meaningful share of the drawing outside it is a component,
        # not the page. Reject outright rather than merely scoring it down — accepting it
        # would filter away legitimate content that happens to sit above or below.
        containment = _ink_containment(quad, gray)
        if containment < MIN_INK_CONTAINMENT:
            logger.debug(
                "Rejecting quad (area %.3f): only %.1f%% of ink inside",
                area_fraction,
                containment * 100,
            )
            continue

        rect_score = _rectangularity(quad, contour)
        # Confidence blends three signals: does it look like a solid rectangle, is it
        # page-sized, and does it actually contain the drawing.
        confidence = round(
            0.40 * rect_score
            + 0.25 * min(area_fraction / 0.9, 1.0)
            + 0.35 * containment,
            4,
        )

        if best is None or confidence > best[0]:
            best = (confidence, quad, area_fraction)

    if best is None:
        return PageBoundary.none_found("only-full-frame")

    confidence, quad, area_fraction = best
    corners = _order_corners(quad)
    polygon = [
        (
            round(min(max(x / width, 0.0), 1.0), 6),
            round(min(max(y / height, 0.0), 1.0), 6),
        )
        for x, y in corners
    ]

    return PageBoundary(
        polygon=polygon,
        confidence=confidence,
        method="contour",
        area_fraction=round(area_fraction, 4),
    )
