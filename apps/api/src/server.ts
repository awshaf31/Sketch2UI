import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { pagesRouter } from "./modules/pages/pages.routes.js";
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
import { geometryOverridesRouter } from "./modules/geometry-overrides/geometry-overrides.routes.js";
import { structureOverridesRouter } from "./modules/structure-overrides/structure-overrides.routes.js";
import { correctionsRouter } from "./modules/corrections/corrections.routes.js";

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// register/login are public; every route below requireAuth needs a session. /me
// applies requireAuth itself (auth.routes.ts), since it lives before the global gate.
app.use("/api/auth", authRouter);
app.use(requireAuth);

// Page-owned resources — Phase D3. Nested under /pages/:pageId; each router is
// gated by requireProjectOwnership then requirePageInProject (see each router file).
app.use("/api/projects/:id/pages/:pageId/assets/:assetId/detect", detectRouter);
app.use("/api/projects/:id/pages/:pageId/assets/:assetId/approve-training", trainingRouter);
app.use("/api/projects/:id/pages/:pageId/assets/:assetId/page-boundary", boundariesRouter);
app.use("/api/projects/:id/pages/:pageId/assets", assetsRouter);
app.use("/api/projects/:id/pages/:pageId/detections/:detectionId/crop.png", cropsRouter);
app.use("/api/projects/:id/pages/:pageId/detections", detectionsRouter);
app.use("/api/projects/:id/pages/:pageId/code-generation-jobs", codegenRouter);
app.use("/api/projects/:id/pages/:pageId/code-versions", codeVersionsRouter);
app.use("/api/projects/:id/pages/:pageId/code", latestCodeRouter);
app.use("/api/projects/:id/pages/:pageId/style-overrides", styleOverridesRouter);
app.use("/api/projects/:id/pages/:pageId/content-overrides", contentOverridesRouter);
app.use("/api/projects/:id/pages/:pageId/geometry-overrides", geometryOverridesRouter);
app.use("/api/projects/:id/pages/:pageId/structure-overrides", structureOverridesRouter);
app.use("/api/projects/:id/pages/:pageId/corrections", correctionsRouter);
app.use("/api/projects/:id/pages", pagesRouter);

// Project-level resources — span every page, not nested under one.
app.use("/api/projects/:id/exports", exportsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/projects", projectsRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Sketch2UI API listening on http://localhost:${env.port}`);
  console.log(`CV worker expected at ${env.cvWorkerUrl}`);

  // Detect jobs run in-process, so a restart abandons anything mid-flight. Fail those
  // records rather than leaving a client polling "processing" forever. The listen
  // callback itself cannot be async (Node's return-value contract), so this is fired
  // and handled here rather than awaited — it must not silently stop reaping orphans
  // if the repository call ever rejects (amendment §2.3).
  void failOrphanedJobs()
    .then((orphaned) => {
      if (orphaned > 0) {
        console.log(`Failed ${orphaned} job(s) orphaned by a previous shutdown.`);
      }
    })
    .catch((err) => {
      console.error("Failed to reap orphaned jobs at startup:", err);
    });
});
