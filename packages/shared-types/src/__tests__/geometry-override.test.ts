import { describe, expect, it } from "vitest";
import type { BBox, Detection } from "../detection.js";
import {
  applyGeometryOverrides,
  effectiveBBox,
  validateGeometryOverride,
} from "../geometry-override.js";

// Geometry override tests — plan §17.3 Geometry, execution plan Appendix B.
//
// The validator is the strict-normalized rule the API and the inspector both call,
// so its behavior is a public contract, not just an internal detail. Anything that
// slips through here reaches the JSON store and, later, the generated CSS.

const baseBBox: BBox = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };

function makeDetection(bbox: BBox): Detection {
  return {
    id: "det-1",
    projectId: "proj-1",
    sourceAssetId: "asset-1",
    className: "button",
    confidence: 1,
    bbox,
    status: "active",
    source: "manual",
    createdAt: "2026-08-24T00:00:00Z",
    updatedAt: "2026-08-24T00:00:00Z",
  };
}

describe("validateGeometryOverride", () => {
  describe("accepts", () => {
    it("a complete valid override at the page edge", () => {
      const r = validateGeometryOverride({ x: 0, y: 0, width: 1, height: 1 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    });

    it("a partial override (width only) checked against base x", () => {
      const r = validateGeometryOverride({ width: 0.9 }, { x: 0.05, y: 0, width: 0.1, height: 0.1 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({ width: 0.9 });
    });

    it("an empty object as a no-op override (Reset flow)", () => {
      const r = validateGeometryOverride({});
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({});
    });

    it("a value that overshoots by less than the floating-point tolerance", () => {
      // 0.5 + 0.5 == 1 exactly, but real IEEE 754 arithmetic gives 1 + tiny epsilon
      // in some paths; the GEOMETRY_TOLERANCE slack is what keeps that from failing.
      const r = validateGeometryOverride({ x: 0.5, width: 0.5 + 1e-9 });
      expect(r.ok).toBe(true);
    });

    it("skips null/undefined fields (treated as absent)", () => {
      const r = validateGeometryOverride({ x: null, y: undefined, width: 0.5, height: 0.5 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({ width: 0.5, height: 0.5 });
    });
  });

  describe("rejects", () => {
    it("a non-object body", () => {
      expect(validateGeometryOverride(42).ok).toBe(false);
      expect(validateGeometryOverride("x").ok).toBe(false);
      expect(validateGeometryOverride(null).ok).toBe(false);
      expect(validateGeometryOverride([]).ok).toBe(false);
    });

    it("negative x", () => {
      const r = validateGeometryOverride({ x: -0.01, y: 0, width: 0.1, height: 0.1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/x/);
    });

    it("negative y", () => {
      const r = validateGeometryOverride({ x: 0, y: -0.001, width: 0.1, height: 0.1 });
      expect(r.ok).toBe(false);
    });

    it("zero width", () => {
      const r = validateGeometryOverride({ x: 0, y: 0, width: 0, height: 0.1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/width/);
    });

    it("zero height", () => {
      const r = validateGeometryOverride({ x: 0, y: 0, width: 0.1, height: 0 });
      expect(r.ok).toBe(false);
    });

    it("x + width > 1 (over-right edge)", () => {
      const r = validateGeometryOverride({ x: 0.8, y: 0, width: 0.3, height: 0.1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/x \+ width/);
    });

    it("y + height > 1 (over-bottom edge)", () => {
      const r = validateGeometryOverride({ x: 0, y: 0.9, width: 0.1, height: 0.2 });
      expect(r.ok).toBe(false);
    });

    it("partial override that overflows once combined with the base bbox", () => {
      // base x=0.9, override width=0.2 → 0.9 + 0.2 = 1.1 > 1
      const r = validateGeometryOverride({ width: 0.2 }, { x: 0.9, y: 0, width: 0.05, height: 0.1 });
      expect(r.ok).toBe(false);
    });

    it("non-finite values (NaN, Infinity)", () => {
      expect(validateGeometryOverride({ x: NaN }).ok).toBe(false);
      expect(validateGeometryOverride({ x: Infinity }).ok).toBe(false);
    });

    it("a non-numeric string value", () => {
      const r = validateGeometryOverride({ x: "0.1" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/x/);
    });

    it("an unknown key", () => {
      const r = validateGeometryOverride({ x: 0, y: 0, width: 0.1, height: 0.1, rotation: 45 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/rotation/);
    });
  });
});

describe("effectiveBBox", () => {
  it("returns the base unchanged when no override is present", () => {
    expect(effectiveBBox(baseBBox, undefined)).toBe(baseBBox);
    expect(effectiveBBox(baseBBox, null)).toBe(baseBBox);
  });

  it("folds only the fields the override actually declares", () => {
    const merged = effectiveBBox(baseBBox, { width: 0.5 });
    expect(merged).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.2 });
  });

  it("prefers override values over base when both present", () => {
    const merged = effectiveBBox(baseBBox, { x: 0.9, y: 0.8, width: 0.05, height: 0.1 });
    expect(merged).toEqual({ x: 0.9, y: 0.8, width: 0.05, height: 0.1 });
  });
});

describe("applyGeometryOverrides", () => {
  it("returns the same array reference structure when no overrides", () => {
    const dets = [makeDetection(baseBBox)];
    expect(applyGeometryOverrides(dets, undefined)).toBe(dets);
  });

  it("does not mutate the input detections", () => {
    const dets = [makeDetection(baseBBox)];
    const original = { ...dets[0].bbox };
    applyGeometryOverrides(dets, { "det-1": { width: 0.5 } });
    expect(dets[0].bbox).toEqual(original);
  });

  it("applies an override to the matching detection only", () => {
    const a = makeDetection(baseBBox);
    const b = { ...makeDetection(baseBBox), id: "det-2" };
    const result = applyGeometryOverrides([a, b], { "det-1": { width: 0.5 } });
    expect(result[0].bbox.width).toBe(0.5);
    expect(result[1].bbox.width).toBe(baseBBox.width);
  });

  it("preserves detection identity (id, source, className, etc.)", () => {
    const det = makeDetection(baseBBox);
    const [result] = applyGeometryOverrides([det], {
      "det-1": { x: 0, y: 0, width: 0.9, height: 0.9 },
    });
    expect(result.id).toBe(det.id);
    expect(result.className).toBe(det.className);
    expect(result.source).toBe(det.source);
    expect(result.confidence).toBe(det.confidence);
    expect(result.status).toBe(det.status);
  });

  it("survives across regeneration — override is keyed by detection UUID, not by array order", () => {
    // Simulates a detection set that changes order between regenerations. The
    // override, keyed on stable UUID, must still land on the right detection.
    const before = [
      makeDetection(baseBBox),
      { ...makeDetection(baseBBox), id: "det-2", bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } },
    ];
    const overrides = { "det-2": { x: 0.7 } };
    const shuffled = [before[1], before[0]];
    const result = applyGeometryOverrides(shuffled, overrides);
    // The det-2 (originally second, now first) got the override; the previously-first
    // det-1 did not.
    expect(result[0].id).toBe("det-2");
    expect(result[0].bbox.x).toBe(0.7);
    expect(result[1].id).toBe("det-1");
    expect(result[1].bbox).toEqual(baseBBox);
  });
});
