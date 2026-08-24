import { Router } from "express";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";
import { listCorrections } from "./corrections.service.js";

// Read-only correction history — plan §4.3 ("Audit UI ... Optional but useful").
// Records are written by the detections, geometry-overrides and structure-overrides
// routes (see corrections.service.ts's recordCorrection call sites); this router
// only exposes them for the Inspector's History section and for manual verification.

export const correctionsRouter = Router({ mergeParams: true });

// GET /api/projects/:id/corrections?detectionId=... — full project history, or one
// detection's history when the query param is present.
correctionsRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const detectionId =
    typeof req.query.detectionId === "string" ? req.query.detectionId : undefined;
  res.json(listCorrections(project.id, detectionId));
});
