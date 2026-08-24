// Per-node structure overrides — plan §17.3 Structure group.
//
// Style/Content overrides fold onto UI-IR nodes AFTER buildUITree; geometry runs at
// the detection layer BEFORE it. Structure sits alongside geometry conceptually — the
// user is telling layout inference "no, this belongs somewhere else" — but the fold
// point is inside buildUITree: the parent lookup and the sibling ordering step both
// need to know about overrides, and reproducing that logic outside layout.ts would
// duplicate the very thing the plan says not to rewrite. Same detection-uuid keying
// as the other three inspector groups (see project.ts for why UI-IR node ids are
// wrong to key on).
//
// Two independent fields. Either can be present alone:
//   - parentDetectionId: string  → reparent to that detection
//   - parentDetectionId: null    → detach to root (§17.3 explicit "root" value)
//   - undefined                  → auto-inferred parent unchanged
//   - displayOrder: number       → sort key within the effective parent's children
//   - displayOrder: undefined    → auto reading-order position unchanged

import type { Detection } from "./detection.js";

export interface StructureOverride {
  /**
   * Force the node's parent. `null` means "root". `undefined` (field omitted) means
   * "keep whatever auto-inference decides". A parent whose id no longer exists in
   * the active detection set is treated as `null` at apply time — safer than
   * silently dropping the child, and the API validator refuses to create such a
   * reference in the first place.
   */
  parentDetectionId?: string | null;
  /**
   * Sort key within the effective parent's children. Non-negative integer. Ties are
   * broken by the auto-inferred reading-order index, so a value of 0 pins the node
   * to the front without needing every sibling to be numbered.
   */
  displayOrder?: number;
}

export type StructureOverridesByDetection = Record<string, StructureOverride>;

export type StructureValidationResult =
  | { ok: true; override: StructureOverride }
  | { ok: false; error: string };

// Detection IDs are non-empty strings (uuid v4 in the store), so a bare presence
// check is enough. Longer values are fine — the store already accepts them elsewhere.
const NON_EMPTY_ID = /^\S.*/;

/**
 * Validate one PUT body under the strict-normalized rules for a single detection.
 *
 * `detectionId` is the node the override applies TO. `existingByDetection` is the
 * project's full structure map INCLUDING this new override merged in — used to detect
 * cycles. `activeDetections` is the current set of active detections for existence
 * checks on parent references.
 *
 * Rules:
 *   - unknown keys are rejected
 *   - `parentDetectionId`, when a string, must reference a currently active detection
 *   - a node cannot be its own parent
 *   - the resulting parent chain (walking up via overrides) must not cycle back to
 *     the node itself
 *   - `displayOrder`, when present, is a finite non-negative integer
 */
export function validateStructureOverride(
  raw: unknown,
  detectionId: string,
  activeDetections: ReadonlyArray<Pick<Detection, "id" | "status">>,
  existingByDetection: StructureOverridesByDetection
): StructureValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Structure override must be an object." };
  }

  const ALLOWED = new Set(["parentDetectionId", "displayOrder"]);
  const override: StructureOverride = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, error: `Unknown structure field: ${key}` };
    }
    if (value === undefined) continue;
    if (key === "parentDetectionId") {
      if (value === null) {
        override.parentDetectionId = null;
        continue;
      }
      if (typeof value !== "string" || !NON_EMPTY_ID.test(value)) {
        return { ok: false, error: "parentDetectionId must be a detection id or null." };
      }
      override.parentDetectionId = value;
      continue;
    }
    if (key === "displayOrder") {
      if (value === null) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
        return { ok: false, error: "displayOrder must be a non-negative integer." };
      }
      override.displayOrder = value;
    }
  }

  if (override.parentDetectionId === detectionId) {
    return { ok: false, error: "A detection cannot be its own parent." };
  }

  if (typeof override.parentDetectionId === "string") {
    const parent = activeDetections.find((d) => d.id === override.parentDetectionId);
    if (!parent) {
      return {
        ok: false,
        error: `parentDetectionId '${override.parentDetectionId}' is not an active detection in this project.`,
      };
    }
    // Cycle check — walk UP the parent chain from the proposed parent and confirm we
    // never reach `detectionId`. `existingByDetection` is the state that WOULD result
    // if this PUT lands, so it already reflects the pending edit.
    const chain = new Set<string>();
    let cursor: string | null | undefined = override.parentDetectionId;
    while (typeof cursor === "string") {
      if (cursor === detectionId) {
        return { ok: false, error: "This override would create a parent cycle." };
      }
      if (chain.has(cursor)) {
        // Pre-existing cycle in the stored map — refuse rather than infinite-loop.
        return { ok: false, error: "Existing structure overrides form a parent cycle; reset them first." };
      }
      chain.add(cursor);
      const next: string | null | undefined = existingByDetection[cursor]?.parentDetectionId;
      cursor = next;
    }
  }

  return { ok: true, override };
}

/** True when the override touches at least one field. Empty is a Reset request. */
export function structureOverrideHasFields(override: StructureOverride): boolean {
  return override.parentDetectionId !== undefined || override.displayOrder !== undefined;
}
