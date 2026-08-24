import type { BBox } from "./detection.js";
import type { PagePolygon, PolygonPoint } from "./page-boundary.js";
import { DEFAULT_OVERLAP_THRESHOLD } from "./page-boundary.js";

// The section 10.4 hard filtering rule, in TypeScript.
//
// This is a deliberate port of services/cv-worker/app/preprocessing/boundary_filter.py.
// The two must agree: the worker applies the rule once at detection time, and the client
// re-applies it whenever the user drags the boundary (section 10.3 Strategy C) so the
// accepted/rejected split updates without a re-detect. Change one, change the other.
//
// Overlap fraction rather than a center-in-polygon test, per section 10.4's "use overlap
// thresholds for boxes that cross the boundary" — a wide header whose center falls just
// outside the page is still mostly inside and should be kept.

function signedArea(points: readonly PolygonPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    total += x1 * y2 - x2 * y1;
  }
  return total / 2;
}

export function polygonArea(points: readonly PolygonPoint[]): number {
  return Math.abs(signedArea(points));
}

/** Wound counter-clockwise, which the clipper's inside test assumes. */
function ensureCcw(points: readonly PolygonPoint[]): PolygonPoint[] {
  return signedArea(points) >= 0 ? [...points] : [...points].reverse();
}

/** Sutherland-Hodgman clipping. Correct for a convex clip polygon — a page quad is one. */
function clipPolygon(
  subject: readonly PolygonPoint[],
  clip: readonly PolygonPoint[]
): PolygonPoint[] {
  const inside = (p: PolygonPoint, a: PolygonPoint, b: PolygonPoint): boolean =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;

  const intersect = (
    p1: PolygonPoint,
    p2: PolygonPoint,
    a: PolygonPoint,
    b: PolygonPoint
  ): PolygonPoint => {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = a;
    const [x4, y4] = b;
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-12) return p2;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };

  let output: PolygonPoint[] = [...subject];
  for (let i = 0; i < clip.length; i += 1) {
    if (output.length === 0) return [];
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const current = output;
    output = [];
    for (let j = 0; j < current.length; j += 1) {
      const p = current[j];
      const q = current[(j + 1) % current.length];
      const pIn = inside(p, a, b);
      const qIn = inside(q, a, b);
      if (pIn && qIn) {
        output.push(q);
      } else if (pIn && !qIn) {
        output.push(intersect(p, q, a, b));
      } else if (!pIn && qIn) {
        output.push(intersect(p, q, a, b));
        output.push(q);
      }
    }
  }
  return output;
}

/** Fraction of the bbox's area inside the polygon, in [0,1]. */
export function insideFraction(bbox: BBox, polygon: PagePolygon): number {
  if (bbox.width <= 0 || bbox.height <= 0) return 0;

  const box: PolygonPoint[] = [
    [bbox.x, bbox.y],
    [bbox.x + bbox.width, bbox.y],
    [bbox.x + bbox.width, bbox.y + bbox.height],
    [bbox.x, bbox.y + bbox.height],
  ];

  const clipped = clipPolygon(ensureCcw(box), ensureCcw(polygon));
  if (clipped.length === 0) return 0;

  return Math.min(polygonArea(clipped) / (bbox.width * bbox.height), 1);
}

export function shouldAccept(
  bbox: BBox,
  polygon: PagePolygon,
  threshold: number = DEFAULT_OVERLAP_THRESHOLD
): { accepted: boolean; overlap: number } {
  const overlap = insideFraction(bbox, polygon);
  return { accepted: overlap >= threshold, overlap };
}

/** Axis-aligned bounds of a polygon, as a BBox. Used to drive the resize handles. */
export function polygonBounds(polygon: PagePolygon): BBox {
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** A rectangle as a 4-point polygon, ordered TL, TR, BR, BL. */
export function bboxToPolygon(bbox: BBox): PagePolygon {
  return [
    [bbox.x, bbox.y],
    [bbox.x + bbox.width, bbox.y],
    [bbox.x + bbox.width, bbox.y + bbox.height],
    [bbox.x, bbox.y + bbox.height],
  ];
}
