import { v4 as uuid } from "uuid";
import type { Detection } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type {
  CreateDetectionInput,
  DetectionRepository,
  DetectionUpdateResult,
  UpdateDetectionInput,
} from "../types.js";

/**
 * JSON-backed DetectionRepository — Phase 8 compatibility adapter.
 *
 * Same contract rules as the other adapters: detached reads, explicit writes.
 *
 * The correction rule (model→manual flip) now lives in `update()` rather than in the
 * route. That is the point of migrating this domain: the rule protects human
 * corrections from being wiped by the next re-detect, and leaving it in a route means
 * any future second caller silently loses the protection.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

function bboxEquals(a: Detection["bbox"], b: Detection["bbox"]): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function build(input: CreateDetectionInput): Detection {
  const now = new Date().toISOString();
  return {
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
}

export class JsonDetectionRepository implements DetectionRepository {
  async listByProject(projectId: string): Promise<Detection[]> {
    return db.state.detections.filter((d) => d.projectId === projectId).map(detach);
  }

  async listActiveByProject(projectId: string): Promise<Detection[]> {
    return db.state.detections
      .filter((d) => d.projectId === projectId && d.status === "active")
      .map(detach);
  }

  async listActiveByAsset(assetId: string): Promise<Detection[]> {
    return db.state.detections
      .filter((d) => d.sourceAssetId === assetId && d.status === "active")
      .map(detach);
  }

  async findById(id: string): Promise<Detection | null> {
    const found = db.state.detections.find((d) => d.id === id);
    return found ? detach(found) : null;
  }

  async findInProject(projectId: string, id: string): Promise<Detection | null> {
    const found = db.state.detections.find((d) => d.id === id && d.projectId === projectId);
    return found ? detach(found) : null;
  }

  async create(input: CreateDetectionInput): Promise<Detection> {
    const detection = build(input);
    db.state.detections.push(detection);
    db.save();
    return detach(detection);
  }

  async createMany(inputs: CreateDetectionInput[]): Promise<Detection[]> {
    const created = inputs.map(build);
    db.state.detections.push(...created);
    db.save();
    return created.map(detach);
  }

  async update(
    projectId: string,
    id: string,
    patch: UpdateDetectionInput
  ): Promise<DetectionUpdateResult | null> {
    const detection = db.state.detections.find(
      (d) => d.id === id && d.projectId === projectId
    );
    if (!detection) return null;

    const previous = detach(detection);

    const classChanged = patch.className !== undefined && patch.className !== detection.className;
    const bboxChanged = patch.bbox !== undefined && !bboxEquals(patch.bbox, detection.bbox);

    if (patch.className !== undefined) detection.className = patch.className;
    if (patch.bbox !== undefined) detection.bbox = patch.bbox;
    if (patch.status !== undefined) detection.status = patch.status;

    // A corrected model detection becomes the user's: it flips to source "manual" while
    // keeping modelVersionId for provenance. Two reasons this matters:
    //   1. re-running detection clears this asset's model detections (§27.5), so without
    //      the flip a correction would be silently destroyed by the next Detect run;
    //   2. §36's training feedback loop wants exactly these records — a human-approved
    //      box that a known model version originally proposed.
    if (previous.source === "model" && (classChanged || bboxChanged)) {
      // Capture what the model originally said BEFORE overwriting it. Guarded so a
      // second correction does not overwrite the model's original answer.
      if (classChanged && detection.originalClassName === undefined) {
        detection.originalClassName = previous.className;
      }
      detection.source = "manual";
      detection.confidence = 1;
    }

    detection.updatedAt = new Date().toISOString();
    db.save();

    return { detection: detach(detection), previous, classChanged, bboxChanged };
  }

  async delete(projectId: string, id: string): Promise<Detection | null> {
    const index = db.state.detections.findIndex(
      (d) => d.id === id && d.projectId === projectId
    );
    if (index === -1) return null;
    const [removed] = db.state.detections.splice(index, 1);
    db.save();
    return detach(removed);
  }

  async clearModelDetections(projectId: string, sourceAssetId: string): Promise<number> {
    const before = db.state.detections.length;
    // Manual detections are never touched — a user's own work, including a corrected
    // box that was flipped from model to manual, must survive a re-detect.
    db.state.detections = db.state.detections.filter(
      (d) => !(d.projectId === projectId && d.sourceAssetId === sourceAssetId && d.source === "model")
    );
    const removed = before - db.state.detections.length;
    if (removed > 0) db.save();
    return removed;
  }
}
