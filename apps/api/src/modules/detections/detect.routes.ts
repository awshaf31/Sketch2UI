import { Router } from "express";
import { sendError } from "../../middleware/apiError.js";
import { db } from "../../db/jsonStore.js";
import { createJob } from "../jobs/jobs.service.js";
import { runDetectJob } from "./detect.job.js";

export const detectRouter = Router({ mergeParams: true });

interface DetectParams extends Record<string, string> {
  id: string;
  assetId: string;
}

// POST /api/projects/:id/assets/:assetId/detect — plan section 7.4 shape:
//   { "jobId": "...", "status": "queued" }
//
// Returns immediately; the work runs in-process afterwards. The client polls
// GET /api/jobs/:jobId (section 7.4) until it reaches completed or failed.
detectRouter.post<DetectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) {
    return sendError(res, 404, "NOT_FOUND", "Project not found.");
  }

  const asset = db.state.assets.find(
    (a) => a.id === req.params.assetId && a.projectId === project.id
  );
  if (!asset) {
    return sendError(res, 404, "NOT_FOUND", "Asset not found for this project.");
  }

  const job = createJob({ projectId: project.id, type: "detect", sourceAssetId: asset.id });

  // Respond first, THEN start work. runDetectJob runs synchronously up to its first
  // await and flips the very same job object to "processing"; starting it before
  // res.json() would serialize that mutation and break the section 7.4 contract, which
  // specifies status "queued" here.
  res.status(202).json({ jobId: job.id, status: "queued" });

  // Fire and forget. runDetectJob never throws — it records every failure on the job
  // record — so there is no unhandled rejection to leak here.
  setImmediate(() => void runDetectJob(job.id, asset));
});
