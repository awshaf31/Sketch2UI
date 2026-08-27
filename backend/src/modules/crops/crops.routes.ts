import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import { CropError, cropDetection } from "./crop.service.js";
import type { DetectionParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// GET /api/projects/:id/pages/:pageId/detections/:detectionId/crop.png — plan §15.5.
// Serves the source sketch's pixels for one detection so the live preview shows the
// real drawing instead of a placeholder.

export const cropsRouter = Router({ mergeParams: true });
cropsRouter.use(requireProjectOwnership);
cropsRouter.use(requirePageInProject);

cropsRouter.get<DetectionParams>("/", async (req, res) => {
  const detection = await getRepositories().detections.findInPage(req.params.pageId, req.params.detectionId);
  if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found.");

  const asset = await getRepositories().assets.findById(detection.sourceAssetId);
  if (!asset) return sendError(res, 404, "NOT_FOUND", "Source asset not found.");

  try {
    const png = await cropDetection(detection, asset);
    // Crops are deterministic for a given detection+asset, and the detection id changes
    // whenever a box is re-created, so they are safe to cache hard.
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(png);
  } catch (cause) {
    if (cause instanceof CropError) {
      return sendError(res, cause.code === "NOT_FOUND" ? 404 : 400, cause.code, cause.message);
    }
    return sendError(res, 500, "INTERNAL", "Could not generate the crop.");
  }
});
