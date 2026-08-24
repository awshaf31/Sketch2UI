// Page boundary — plan section 10.
//
// SCOPE NOTE (deliberate deferral): section 10.2's pipeline includes perspective
// correction and cropping between boundary detection and inference. That is NOT done.
// The polygon is expressed in the ORIGINAL image's normalized coordinate space, the same
// space every Detection bbox uses, and no image is warped, cropped, or re-based.
// Rectifying would change the coordinate space that detections, the canvas overlay and
// the stored asset all depend on — a much larger change. Sharing one coordinate space is
// also what lets the client re-filter after a manual boundary edit with no round trip.

/** A point normalized to [0,1] against the original image: [x, y]. */
export type PolygonPoint = [number, number];

/** Ordered top-left, top-right, bottom-right, bottom-left. */
export type PagePolygon = PolygonPoint[];

export type PageBoundaryMethod = "contour" | "none" | "manual";

export interface PageBoundary {
  polygon: PagePolygon;
  /** 0 when nothing plausible was found; 1 for a user-drawn boundary. */
  confidence: number;
  method: PageBoundaryMethod;
  areaFraction: number;
  /** Whether this boundary was actually used to filter detections. */
  applied: boolean;
  /** The section 10.4 overlap threshold used, when applied. */
  overlapThreshold?: number;
}

/** The full image, used when no boundary is found — section 10.3 Strategy C fallback. */
export const FULL_IMAGE_POLYGON: PagePolygon = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export const DEFAULT_OVERLAP_THRESHOLD = 0.5;
/** Below this a boundary is too speculative to filter on. Mirrors the worker's value. */
export const MIN_BOUNDARY_CONFIDENCE = 0.35;
