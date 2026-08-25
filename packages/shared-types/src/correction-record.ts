// Correction history / audit trail — plan §4 (Phase 4 of the execution plan), not
// part of the original 54-section plan. The point is traceability: a corrected
// detection's CURRENT state is already visible everywhere (canvas, tree, inspector),
// but nothing today records HOW it got there. This closes that gap.
//
// Deliberately flat, not a discriminated union — matches the execution plan's §4.1
// field list literally (oldClass/newClass/oldBBox/newBBox/oldParent/newParent/
// oldOrder/newOrder), and keeps append-site code simple: a caller fills in only the
// fields relevant to its `type` and leaves the rest undefined.
//
// Scope boundary: only detection identity/geometry/structure corrections are
// recorded (class, bbox, parent, order, create, delete) — not Style or Content
// overrides. Style/Content are presentational; they never feed the ML training loop
// (plan §4.4 / §36) the way class/bbox/structure corrections do, which is the whole
// reason this history exists. See docs/execution/phase-log.md Phase 4 for the
// reasoning.

import type { BBox } from "./detection.js";

export type CorrectionType =
  | "created"
  | "deleted"
  | "class_changed"
  | "bbox_changed"
  | "parent_changed"
  | "order_changed"
  /**
   * Reserved per plan §4.2's correction-type taxonomy. No route in this app sets a
   * detection to "ignored" today — `status: "rejected"` is always computed
   * automatically by page-boundary filtering (§10.4), never a deliberate per-box
   * user action. Kept in the union so a future explicit "ignore this box" UI action
   * has a type to record without a schema change.
   */
  | "ignored";

export interface CorrectionRecord {
  id: string;
  projectId: string;
  pageId: string;
  detectionId: string;
  type: CorrectionType;
  /**
   * Plan §4.1 "user/source". Always "user" today — every correction route in this
   * app is triggered by direct human action through the web client; there is no
   * automated correction pipeline yet (the §36 active-learning report only ranks
   * what to label next, per PROJECT_STATUS.md — it does not act automatically).
   * Kept as an explicit field, not a hardcoded literal in call sites, so a future
   * automated path has somewhere to record itself.
   */
  source: "user";
  timestamp: string;
  /** Free-text note. No UI writes this yet — reserved for a future "why" prompt. */
  reason?: string;

  oldClassName?: string;
  newClassName?: string;
  oldBBox?: BBox;
  newBBox?: BBox;
  /** `null` means root; `undefined` means "no parent override was set at that point". */
  oldParentDetectionId?: string | null;
  newParentDetectionId?: string | null;
  oldDisplayOrder?: number;
  newDisplayOrder?: number;
}
