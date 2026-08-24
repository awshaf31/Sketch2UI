import { Router } from "express";
import type { Detection } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { DetectionParams, ProjectParams } from "../../types.js";
import { createDetection, listDetections } from "./detections.service.js";
import { sendError } from "../../middleware/apiError.js";

export const detectionsRouter = Router({ mergeParams: true });

// GET /api/projects/:id/detections — plan section 18.4.
// Returns manual and model detections together; the client tells them apart via `source`.
detectionsRouter.get<ProjectParams>("/", (req, res) => {
  res.json(listDetections(req.params.id));
});

// POST /api/projects/:id/detections — manual annotation creation (source: "manual").
// Shares createDetection() with the model detect job, so both produce identical records.
detectionsRouter.post<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const { className, bbox, sourceAssetId } = req.body ?? {};
  if (!className || !bbox || !sourceAssetId) {
    return sendError(res, 400, "VALIDATION_FAILED", "className, bbox and sourceAssetId are required.");
  }

  const detection = createDetection({
    projectId: project.id,
    sourceAssetId,
    className,
    bbox,
    source: "manual",
  });
  db.save();
  res.status(201).json(detection);
});

// PATCH /api/projects/:id/detections/:detectionId — plan section 18.5
detectionsRouter.patch<DetectionParams>("/:detectionId", (req, res) => {
  const detection = db.state.detections.find(
    (d) => d.id === req.params.detectionId && d.projectId === req.params.id
  );
  if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found.");

  const { className, x, y, width, height, status } = req.body ?? {};

  const previousClassName = detection.className;
  const editedClass = typeof className === "string" && className !== detection.className;
  const editedBox = [x, y, width, height].every((v) => typeof v === "number");

  if (typeof className === "string") detection.className = className;
  if (editedBox) detection.bbox = { x, y, width, height };
  if (typeof status === "string") detection.status = status as Detection["status"];

  // A corrected model detection becomes the user's: it flips to source "manual" while
  // keeping modelVersionId for provenance. Two reasons this matters:
  //   1. re-running detection clears this asset's model detections (idempotency, section
  //      27.5) — without the flip, a correction would be silently destroyed by the next
  //      Detect run;
  //   2. section 36's training feedback loop wants exactly these records — a human-
  //      approved box that a known model version originally proposed.
  if (detection.source === "model" && (editedClass || editedBox)) {
    // Capture what the model originally said BEFORE overwriting it — section 36's
    // active-learning signal needs the class the model got wrong, not the corrected one.
    // Guarded so a second correction does not overwrite the model's original answer.
    if (editedClass && detection.originalClassName === undefined) {
      detection.originalClassName = previousClassName;
    }
    detection.source = "manual";
    detection.confidence = 1;
  }

  detection.updatedAt = new Date().toISOString();

  db.save();
  res.json(detection);
});

// DELETE /api/projects/:id/detections/:detectionId
detectionsRouter.delete<DetectionParams>("/:detectionId", (req, res) => {
  const index = db.state.detections.findIndex(
    (d) => d.id === req.params.detectionId && d.projectId === req.params.id
  );
  if (index === -1) return sendError(res, 404, "NOT_FOUND", "Detection not found.");

  db.state.detections.splice(index, 1);
  db.save();
  res.status(204).send();
});
