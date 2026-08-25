import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

// Read-only correction history — plan §4.3 ("Audit UI ... Optional but useful").
// Records are written by the detections, geometry-overrides and structure-overrides
// routes (see CorrectionRepository's append call sites); this router only exposes
// them for the Inspector's History section and for manual verification.

export const correctionsRouter = Router({ mergeParams: true });

// GET /api/projects/:id/corrections?detectionId=... — full project history, or one
// detection's history when the query param is present.
correctionsRouter.get<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    const detectionId =
      typeof req.query.detectionId === "string" ? req.query.detectionId : undefined;
    res.json(await getRepositories().corrections.list(project.id, detectionId));
  })
);
