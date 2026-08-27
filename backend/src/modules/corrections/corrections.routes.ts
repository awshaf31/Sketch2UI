import { Router } from "express";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Read-only correction history — plan §4.3 ("Audit UI ... Optional but useful").
// Records are written by the detections, geometry-overrides and structure-overrides
// routes (see CorrectionRepository's append call sites); this router only exposes
// them for the Inspector's History section and for manual verification.

export const correctionsRouter = Router({ mergeParams: true });
correctionsRouter.use(requireProjectOwnership);
correctionsRouter.use(requirePageInProject);

// GET /api/projects/:id/pages/:pageId/corrections?detectionId=... — full page
// history, or one detection's history when the query param is present.
correctionsRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    const detectionId =
      typeof req.query.detectionId === "string" ? req.query.detectionId : undefined;
    res.json(await getRepositories().corrections.listByPage(req.params.pageId, detectionId));
  })
);
