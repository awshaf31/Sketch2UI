import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { assetsRouter } from "./modules/assets/assets.routes.js";
import { detectionsRouter } from "./modules/detections/detections.routes.js";
import { detectRouter } from "./modules/detections/detect.routes.js";
import { jobsRouter } from "./modules/jobs/jobs.routes.js";
import { trainingRouter } from "./modules/training/training.routes.js";
import { exportsRouter } from "./modules/exports/exports.routes.js";
import { cropsRouter } from "./modules/crops/crops.routes.js";
import { boundariesRouter } from "./modules/boundaries/boundaries.routes.js";
import { failOrphanedJobs } from "./modules/jobs/jobs.service.js";
import { codegenRouter, latestCodeRouter } from "./modules/codegen/codegen.routes.js";
import { codeVersionsRouter } from "./modules/codegen/code-versions.routes.js";
import { styleOverridesRouter } from "./modules/style-overrides/style-overrides.routes.js";
import { contentOverridesRouter } from "./modules/content-overrides/content-overrides.routes.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use("/uploads", express.static(env.uploadsDir));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/projects/:id/assets/:assetId/detect", detectRouter);
app.use("/api/projects/:id/assets/:assetId/approve-training", trainingRouter);
app.use("/api/projects/:id/assets/:assetId/page-boundary", boundariesRouter);
app.use("/api/projects/:id/assets", assetsRouter);
app.use("/api/projects/:id/detections/:detectionId/crop.png", cropsRouter);
app.use("/api/projects/:id/detections", detectionsRouter);
app.use("/api/projects/:id/exports", exportsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/projects/:id/code-generation-jobs", codegenRouter);
app.use("/api/projects/:id/code-versions", codeVersionsRouter);
app.use("/api/projects/:id/code", latestCodeRouter);
app.use("/api/projects/:id/style-overrides", styleOverridesRouter);
app.use("/api/projects/:id/content-overrides", contentOverridesRouter);
app.use("/api/projects", projectsRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  // Detect jobs run in-process, so a restart abandons anything mid-flight. Fail those
  // records rather than leaving a client polling "processing" forever.
  const orphaned = failOrphanedJobs();
  if (orphaned > 0) {
    console.log(`Failed ${orphaned} job(s) orphaned by a previous shutdown.`);
  }
  console.log(`Sketch2UI API listening on http://localhost:${env.port}`);
  console.log(`CV worker expected at ${env.cvWorkerUrl}`);
});
