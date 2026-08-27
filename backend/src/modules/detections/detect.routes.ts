import { Router } from "express";
import type { PageParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getRepositories } from "../../repositories/index.js";
import { createJob } from "../jobs/jobs.service.js";
import { runDetectJob } from "./detect.job.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

export const detectRouter = Router({ mergeParams: true });
detectRouter.use(requireProjectOwnership);
detectRouter.use(requirePageInProject);

interface DetectParams extends PageParams {
  assetId: string;
}

// POST /api/projects/:id/pages/:pageId/assets/:assetId/detect — plan section 7.4 shape:
//   { "jobId": "...", "status": "queued" }
//
// Returns immediately; the work runs in-process afterwards. The client polls
// GET /api/jobs/:jobId (section 7.4) until it reaches completed or failed.
detectRouter.post<DetectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const asset = await getRepositories().assets.findById(req.params.assetId);
    if (!asset || asset.pageId !== req.params.pageId) {
      return sendError(res, 404, "NOT_FOUND", "Asset not found for this page.");
    }

    const job = await createJob({
      projectId: req.params.id,
      pageId: req.params.pageId,
      type: "detect",
      sourceAssetId: asset.id,
    });

    // Respond first, THEN start work. The response body's "queued" is a literal, not
    // read back off the job record, so there is nothing for a later mutation to race —
    // but starting the CV worker request before the response flushes would still needlessly
    // delay it, so runDetectJob is deferred to the next tick either way.
    res.status(202).json({ jobId: job.id, status: "queued" });

    // Fire and forget. runDetectJob never throws — it records every failure on the job
    // record — so there is no unhandled rejection to leak here.
    setImmediate(() => void runDetectJob(job.id, asset));
  })
);
