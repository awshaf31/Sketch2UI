// Per-node geometry overrides — plan §17.3 Geometry group.
//
// Where Style/Content overrides fold onto UI-IR nodes AFTER buildUITree, geometry has
// to run BEFORE it: parent inference, row grouping and grid detection all key off
// bbox coordinates, so an override that only changed the rendered position would
// leave the layout tree describing the *un-overridden* structure. Applying at the
// detection layer means one edit propagates through containment, ordering and
// generated CSS in the same pass — see applyGeometryOverrides below and its call
// site in `@sketch2ui/codegen`'s generateCode.
//
// Same detection-uuid keying as styleOverrides/contentOverrides (see project.ts for
// why UI-IR node ids are wrong to key on). A partial override is legal: a user who
// only wants to nudge `x` should not have to restate `y`/`width`/`height`.

import type { BBox, Detection } from "./detection.js";

export interface GeometryOverride {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export type GeometryOverridesByDetection = Record<string, GeometryOverride>;

// Floating-point slack for the `x + width <= 1` invariant. Normalized inputs coming
// from the annotation canvas already carry rounding error (pixel → fraction division),
// and rejecting an override the user could not physically avoid is worse than allowing
// one that overshoots the page by 1e-6. The tolerance is a small constant, not a
// relative fraction, because the invariant is on absolute normalized values.
export const GEOMETRY_TOLERANCE = 1e-6;

export type GeometryValidationResult =
  | { ok: true; override: GeometryOverride }
  | { ok: false; error: string };

/**
 * Validate a partial geometry override under the plan's strict-normalized rules
 * (§17.3, execution plan Appendix B).
 *
 * Rules:
 *   - each declared field is a finite number
 *   - x >= 0, y >= 0
 *   - width > 0, height > 0
 *   - x + width <= 1 + tolerance, y + height <= 1 + tolerance
 *   - unknown keys are rejected (so a typo cannot silently persist)
 *
 * `base` is the current detection bbox: partial overrides that omit `x` still need to
 * be checked against a real x when validating `x + width`. Passing the base lets us
 * enforce the invariant without inventing default zeros that would trip legitimate
 * partial edits (e.g. shrinking height on a box whose x+width already sits at 0.99).
 */
export function validateGeometryOverride(
  raw: unknown,
  base?: BBox
): GeometryValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Geometry override must be an object." };
  }

  const ALLOWED = new Set(["x", "y", "width", "height"]);
  const override: GeometryOverride = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, error: `Unknown geometry field: ${key}` };
    }
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: `Geometry field '${key}' must be a finite number.` };
    }
    (override as Record<string, number>)[key] = value;
  }

  const x = override.x ?? base?.x ?? 0;
  const y = override.y ?? base?.y ?? 0;
  const width = override.width ?? base?.width ?? 0;
  const height = override.height ?? base?.height ?? 0;

  if (override.x !== undefined && override.x < 0) {
    return { ok: false, error: "x must be >= 0." };
  }
  if (override.y !== undefined && override.y < 0) {
    return { ok: false, error: "y must be >= 0." };
  }
  if (override.width !== undefined && override.width <= 0) {
    return { ok: false, error: "width must be > 0." };
  }
  if (override.height !== undefined && override.height <= 0) {
    return { ok: false, error: "height must be > 0." };
  }
  if (x + width > 1 + GEOMETRY_TOLERANCE) {
    return { ok: false, error: `x + width (${(x + width).toFixed(4)}) must be <= 1.` };
  }
  if (y + height > 1 + GEOMETRY_TOLERANCE) {
    return { ok: false, error: `y + height (${(y + height).toFixed(4)}) must be <= 1.` };
  }

  return { ok: true, override };
}

/** Fold an override onto a base bbox, one field at a time. Undefined fields inherit. */
export function effectiveBBox(base: BBox, override?: GeometryOverride | null): BBox {
  if (!override) return base;
  return {
    x: override.x ?? base.x,
    y: override.y ?? base.y,
    width: override.width ?? base.width,
    height: override.height ?? base.height,
  };
}

/**
 * Return a new Detection[] with geometry overrides applied. Never mutates the input —
 * the store holds detections as-is, so an override is a projection layered on top.
 * Rejected / non-active detections are passed through unchanged: they never reach
 * buildUITree anyway (see layout.ts), and applying an override to something the user
 * has already flagged as outside the page would only complicate the debug picture.
 */
export function applyGeometryOverrides(
  detections: Detection[],
  overrides: GeometryOverridesByDetection | undefined
): Detection[] {
  if (!overrides) return detections;
  return detections.map((d) => {
    const override = overrides[d.id];
    if (!override) return d;
    const bbox = effectiveBBox(d.bbox, override);
    // Identity is preserved (id, source, className, confidence, projectId all pass
    // through). Only the bbox differs — which is exactly the shape the layout engine
    // reads, so the rest of the pipeline is oblivious to whether an override was in
    // play.
    return { ...d, bbox };
  });
}
