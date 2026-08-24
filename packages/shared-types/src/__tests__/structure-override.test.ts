import { describe, expect, it } from "vitest";
import type { Detection } from "../detection.js";
import {
  structureOverrideHasFields,
  validateStructureOverride,
  type StructureOverridesByDetection,
} from "../structure-override.js";

// Structure override tests — plan §17.3 Structure group, execution plan Appendix C.
//
// The validator is shared between the API and the Inspector (same pattern as the
// boundary parity, code validation, and geometry override utilities), so the shape
// of its accept/reject decisions is a public contract, not internal detail.

function det(id: string, className = "button"): Pick<Detection, "id" | "status"> {
  return { id, status: "active" };
}

const NO_EXISTING: StructureOverridesByDetection = {};

describe("validateStructureOverride", () => {
  describe("accepts", () => {
    it("an empty body as a no-op (Reset flow)", () => {
      const r = validateStructureOverride({}, "child", [det("child")], NO_EXISTING);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({});
    });

    it("parentDetectionId: null (force to root)", () => {
      const r = validateStructureOverride(
        { parentDetectionId: null },
        "child",
        [det("child"), det("parent")],
        NO_EXISTING
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override.parentDetectionId).toBeNull();
    });

    it("a valid parent reference", () => {
      const r = validateStructureOverride(
        { parentDetectionId: "parent" },
        "child",
        [det("child"), det("parent")],
        NO_EXISTING
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override.parentDetectionId).toBe("parent");
    });

    it("displayOrder as a non-negative integer", () => {
      const r = validateStructureOverride(
        { displayOrder: 3 },
        "child",
        [det("child")],
        NO_EXISTING
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override.displayOrder).toBe(3);
    });

    it("both fields together", () => {
      const r = validateStructureOverride(
        { parentDetectionId: "p", displayOrder: 0 },
        "c",
        [det("c"), det("p")],
        NO_EXISTING
      );
      expect(r.ok).toBe(true);
    });

    it("undefined fields (treated as absent)", () => {
      const r = validateStructureOverride(
        { parentDetectionId: undefined, displayOrder: undefined },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.override).toEqual({});
    });
  });

  describe("rejects", () => {
    it("a non-object body", () => {
      expect(validateStructureOverride(1, "c", [det("c")], NO_EXISTING).ok).toBe(false);
      expect(validateStructureOverride(null, "c", [det("c")], NO_EXISTING).ok).toBe(false);
      expect(validateStructureOverride([], "c", [det("c")], NO_EXISTING).ok).toBe(false);
    });

    it("an unknown field", () => {
      const r = validateStructureOverride(
        { parentDetectionId: null, siblings: 3 },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/siblings/);
    });

    it("self-parent", () => {
      const r = validateStructureOverride(
        { parentDetectionId: "same" },
        "same",
        [det("same")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/its own parent/);
    });

    it("a parent that is not in the active set", () => {
      const r = validateStructureOverride(
        { parentDetectionId: "ghost" },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/not an active detection/);
    });

    it("an override that would create a direct cycle (A→B while B→A already exists)", () => {
      // Existing state: B is parented under A.
      const existing: StructureOverridesByDetection = {
        B: { parentDetectionId: "A" },
      };
      // Proposed: parent A under B — cycle.
      // The projected state (existing + the proposed) is what the validator sees.
      const proposed: StructureOverridesByDetection = {
        ...existing,
        A: { parentDetectionId: "B" },
      };
      const r = validateStructureOverride(
        { parentDetectionId: "B" },
        "A",
        [det("A"), det("B")],
        proposed
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/cycle/);
    });

    it("an override that would create a longer-chain cycle (A→B→C→A)", () => {
      const proposed: StructureOverridesByDetection = {
        A: { parentDetectionId: "B" },
        B: { parentDetectionId: "C" },
        C: { parentDetectionId: "A" },
      };
      const r = validateStructureOverride(
        { parentDetectionId: "A" },
        "C",
        [det("A"), det("B"), det("C")],
        proposed
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/cycle/);
    });

    it("displayOrder = -1", () => {
      const r = validateStructureOverride(
        { displayOrder: -1 },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
    });

    it("displayOrder = 1.5", () => {
      const r = validateStructureOverride(
        { displayOrder: 1.5 },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
    });

    it("displayOrder as a string", () => {
      const r = validateStructureOverride(
        { displayOrder: "3" },
        "c",
        [det("c")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
    });

    it("parentDetectionId as an empty string", () => {
      const r = validateStructureOverride(
        { parentDetectionId: "" },
        "c",
        [det("c"), det("p")],
        NO_EXISTING
      );
      expect(r.ok).toBe(false);
    });
  });
});

describe("structureOverrideHasFields", () => {
  it("returns true when parentDetectionId is set (including null)", () => {
    expect(structureOverrideHasFields({ parentDetectionId: null })).toBe(true);
    expect(structureOverrideHasFields({ parentDetectionId: "x" })).toBe(true);
  });

  it("returns true when displayOrder is set", () => {
    expect(structureOverrideHasFields({ displayOrder: 0 })).toBe(true);
  });

  it("returns false for an empty object", () => {
    expect(structureOverrideHasFields({})).toBe(false);
  });
});
