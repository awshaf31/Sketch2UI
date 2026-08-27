"""Hard filtering rule — plan section 10.4 and Appendix J.

Section 10.4: "Only retain detections that are within the accepted page geometry… Use
overlap thresholds for boxes that cross the boundary."

A pure center-in-polygon test mishandles boxes straddling the edge — a wide header whose
center sits just outside the page would be dropped despite being mostly inside, and a
note whose center drifts just inside would be kept. So the criterion here is the
**fraction of the detection's area falling inside the polygon**.

Appendix J's sample additionally requires the center to be inside. That is redundant for
a convex quad at a >=0.5 threshold (a box with over half its area inside a convex region
has its center inside except in degenerate cases) and it re-introduces exactly the
straddle failure the overlap test exists to fix, so overlap alone is used. The threshold
matches Appendix J's 0.50.

PARITY CONTRACT
---------------
This algorithm is implemented twice — here, and in
packages/shared-types/src/boundary-geometry.ts for instant client-side re-filtering.
They MUST agree. That is enforced by a shared golden-fixture suite rather than by
memory:

    packages/shared-types/fixtures/boundary-overlap-parity.json  <- the contract
    cv-service/tests/test_boundary_parity.py             <- runs it here
    packages/shared-types/src/__tests__/boundary-parity.test.ts  <- runs it in TS

Change either implementation and a test fails; change the intended behaviour and update
the fixture in the same commit.

Rejected detections are NOT discarded — section 10.7 is explicit that external notes
should stay visible rather than being deleted. They are returned flagged so the caller
can persist them with status "rejected".
"""

from __future__ import annotations

from typing import List, Sequence, Tuple

Point = Tuple[float, float]

DEFAULT_OVERLAP_THRESHOLD = 0.50

# Below this the boundary is too speculative to filter on — silently rejecting a user's
# detections on a bad guess is worse than keeping an off-page note.
MIN_BOUNDARY_CONFIDENCE = 0.35


def _clip_polygon(subject: Sequence[Point], clip: Sequence[Point]) -> List[Point]:
    """Sutherland-Hodgman polygon clipping.

    Correct for a convex clip polygon, which is what a page quad is. Returns the
    intersection polygon, possibly empty.
    """
    def inside(p: Point, a: Point, b: Point) -> bool:
        # Left-of test; the clip polygon is wound consistently by _ensure_ccw.
        return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0.0

    def intersect(p1: Point, p2: Point, a: Point, b: Point) -> Point:
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = a
        x4, y4 = b
        den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if abs(den) < 1e-12:
            return p2
        t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den
        return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))

    output: List[Point] = list(subject)
    for i in range(len(clip)):
        if not output:
            return []
        a = clip[i]
        b = clip[(i + 1) % len(clip)]
        current = output
        output = []
        for j in range(len(current)):
            p = current[j]
            q = current[(j + 1) % len(current)]
            p_in = inside(p, a, b)
            q_in = inside(q, a, b)
            if p_in and q_in:
                output.append(q)
            elif p_in and not q_in:
                output.append(intersect(p, q, a, b))
            elif not p_in and q_in:
                output.append(intersect(p, q, a, b))
                output.append(q)
    return output


def polygon_area(points: Sequence[Point]) -> float:
    """Shoelace area, always non-negative."""
    if len(points) < 3:
        return 0.0
    total = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


def _ensure_ccw(points: Sequence[Point]) -> List[Point]:
    """Return the polygon wound counter-clockwise, which _clip_polygon's inside() assumes."""
    signed = 0.0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        signed += x1 * y2 - x2 * y1
    return list(points) if signed >= 0 else list(reversed(points))


def inside_fraction(
    bbox: Tuple[float, float, float, float],
    polygon: Sequence[Point],
) -> float:
    """Fraction of the bbox's area that falls inside the polygon, in [0,1].

    `bbox` is (x, y, width, height), normalized, top-left origin.
    """
    x, y, w, h = bbox
    if w <= 0 or h <= 0:
        return 0.0

    box = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    clipped = _clip_polygon(_ensure_ccw(box), _ensure_ccw(polygon))
    if not clipped:
        return 0.0

    return min(polygon_area(clipped) / (w * h), 1.0)


def should_accept(
    bbox: Tuple[float, float, float, float],
    polygon: Sequence[Point],
    threshold: float = DEFAULT_OVERLAP_THRESHOLD,
) -> Tuple[bool, float]:
    """Apply the section 10.4 rule. Returns (accepted, overlap_fraction)."""
    overlap = inside_fraction(bbox, polygon)
    return overlap >= threshold, overlap


def boundary_is_usable(confidence: float) -> bool:
    """Whether a boundary is trustworthy enough to filter on at all."""
    return confidence >= MIN_BOUNDARY_CONFIDENCE
