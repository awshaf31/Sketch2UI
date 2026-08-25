import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getJob } from "./jobs.service.js";

export const jobsRouter = Router();

// GET /api/jobs/:jobId — plan sections 7.4 and 18.9.
// Returns the section 42 Job contract: status, stage, progress.
jobsRouter.get<{ jobId: string }>(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return sendError(res, 404, "NOT_FOUND", "Job not found.");
    }
    res.json(job);
  })
);
