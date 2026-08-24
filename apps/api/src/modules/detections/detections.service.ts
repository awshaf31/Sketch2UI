import { v4 as uuid } from "uuid";
import type { BBox, Detection, DetectionSource, DetectionStatus } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";

// Service layer for detections — plan section 7.2 (route -> service -> repository;
// keep business logic out of route handlers).
//
// Both the manual annotation route and the model detection job go through
// createDetection(), so a model-produced box is persisted by exactly the same path as a
// hand-drawn one. That is the point of section 51 step 9: the correction UI already
// works on these records and needs no change.

export interface CreateDetectionInput {
  projectId: string;
  sourceAssetId: string;
  className: string;
  bbox: BBox;
  source: DetectionSource;
  confidence?: number;
  modelVersionId?: string;
  /** Section 10.7: a box outside the page boundary is persisted as "rejected", never
   *  dropped, so the external note stays visible in the UI. Defaults to "active". */
  status?: DetectionStatus;
}

export function createDetection(input: CreateDetectionInput): Detection {
  const now = new Date().toISOString();
  const detection: Detection = {
    id: uuid(),
    projectId: input.projectId,
    sourceAssetId: input.sourceAssetId,
    className: input.className,
    // Manual annotations are certain by definition; model ones carry the model's score.
    confidence: input.confidence ?? 1,
    bbox: input.bbox,
    status: input.status ?? "active",
    source: input.source,
    ...(input.modelVersionId ? { modelVersionId: input.modelVersionId } : {}),
    createdAt: now,
    updatedAt: now,
  };

  db.state.detections.push(detection);
  return detection;
}

export function createDetections(inputs: CreateDetectionInput[]): Detection[] {
  const created = inputs.map(createDetection);
  db.save();
  return created;
}

export function listDetections(projectId: string): Detection[] {
  return db.state.detections.filter((d) => d.projectId === projectId);
}

/**
 * Remove previously model-generated detections for one asset.
 *
 * Section 27.5 (idempotency): re-running detection on the same asset must not pile up
 * duplicate boxes. Manual detections are never touched — a user's own work must survive
 * a re-detect.
 */
export function clearModelDetections(projectId: string, sourceAssetId: string): number {
  const before = db.state.detections.length;
  db.state.detections = db.state.detections.filter(
    (d) => !(d.projectId === projectId && d.sourceAssetId === sourceAssetId && d.source === "model")
  );
  return before - db.state.detections.length;
}
