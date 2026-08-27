import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getRepositories } from "../../repositories/index.js";
import { getJob } from "./jobs.service.js";

export const jobsRouter = Router();

// GET /api/jobs/:jobId — plan sections 7.4 and 18.9.
// Returns the section 42 Job contract: status, stage, progress.
//
// Mounted at the top level (/api/jobs, not nested under /api/projects/:id), so there is
// no project id in this route's own path for requireProjectOwnership to check. Fetch
// the job first — it carries `projectId` — then check that project's ownerId inline,
// same 404-not-403 rule as everywhere else.
jobsRouter.get<{ jobId: string }>(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return sendError(res, 404, "NOT_FOUND", "Job not found.");
    }
    const project = await getRepositories().projects.findById(job.projectId);
    if (!project || project.ownerId !== req.userId) {
      return sendError(res, 404, "NOT_FOUND", "Job not found.");
    }
    res.json(job);
  })
);
