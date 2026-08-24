import { v4 as uuid } from "uuid";
import type { BBox, CorrectionRecord, CorrectionType } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";

// Correction history / audit trail — plan §4 (execution plan Phase 4).
//
// This module only APPENDS records; it never calls db.save() itself. Every call
// site already mutates other store state (a detection, an override map) and calls
// db.save() once after — batching into that single write avoids doubling the
// number of JSON-file rewrites per request, consistent with how the rest of the
// JSON store already works (see jsonStore.ts's own module comment).

export interface RecordCorrectionInput {
  projectId: string;
  detectionId: string;
  type: CorrectionType;
  oldClassName?: string;
  newClassName?: string;
  oldBBox?: BBox;
  newBBox?: BBox;
  oldParentDetectionId?: string | null;
  newParentDetectionId?: string | null;
  oldDisplayOrder?: number;
  newDisplayOrder?: number;
  reason?: string;
}

/** Append one correction record. Caller is responsible for db.save(). */
export function recordCorrection(input: RecordCorrectionInput): CorrectionRecord {
  const record: CorrectionRecord = {
    id: uuid(),
    source: "user",
    timestamp: new Date().toISOString(),
    ...input,
  };
  db.state.correctionRecords.push(record);
  return record;
}

/**
 * List a project's correction history, newest last (chronological — matches the
 * plan §4.3 mockup's top-to-bottom reading order). Optionally scoped to one
 * detection for the Inspector's per-node History section.
 */
export function listCorrections(projectId: string, detectionId?: string): CorrectionRecord[] {
  return db.state.correctionRecords
    .filter((r) => r.projectId === projectId && (!detectionId || r.detectionId === detectionId))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
