import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getRepositories } from "../../repositories/index.js";
import { authRouter } from "../auth/auth.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { pagesRouter } from "../pages/pages.routes.js";
import { detectionsRouter } from "../detections/detections.routes.js";
import { boundariesRouter } from "./boundaries.routes.js";

/**
 * HTTP-integration regression coverage for DEF-002
 * (docs/qa/MASTER_DEFECT_REGISTER.md) — saving a manually-adjusted page boundary only
 * ever updated the CLIENT's live-computed accept/reject view; the persisted
 * `Detection.status` column was never re-derived, so a later "Save Version"/export
 * (both of which read `listActiveByPage`, filtered on the stored `status`) silently
 * kept using the OLD boundary's verdicts. This test seeds two model detections with
 * stale statuses relative to the boundary about to be saved, and one manual detection
 * that must never be reclassified by boundary geometry regardless of position.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects/:id/pages/:pageId/assets/:assetId/page-boundary", boundariesRouter);
  app.use("/api/projects/:id/pages/:pageId/detections", detectionsRouter);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("boundaries routes — detection status re-derivation on manual boundary save", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  it("flips model detection status to match the newly-saved boundary, leaves manual detections alone", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: "boundary@example.com", password: "correct-horse" });
    const project = await agent.post("/api/projects").send({ name: "Boundary test" });
    const projectId = project.body.id as string;
    const pages = await agent.get(`/api/projects/${projectId}/pages`);
    const pageId = pages.body[0].id as string;

    const asset = await getRepositories().assets.create({
      projectId,
      pageId,
      storageKey: "test-asset.png",
      mimeType: "image/png",
      width: 1000,
      height: 1000,
      fileSize: 1024,
    });

    // Seeded as "active" (inside an implicit full-image boundary) but positioned
    // entirely in [0.6-0.8] — the new boundary below only covers [0, 0.5], so this
    // must flip to "rejected".
    const wasActiveNowOutside = await getRepositories().detections.create({
      projectId,
      pageId,
      sourceAssetId: asset.id,
      className: "button",
      bbox: { x: 0.6, y: 0.6, width: 0.1, height: 0.1 },
      source: "model",
      confidence: 0.9,
    });

    // Seeded as "rejected" but positioned inside [0, 0.5] — must flip to "active"
    // once the new boundary is saved covering exactly that region.
    const wasRejectedNowInside = await getRepositories().detections.create({
      projectId,
      pageId,
      sourceAssetId: asset.id,
      className: "heading",
      bbox: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
      source: "model",
      confidence: 0.9,
      status: "rejected",
    });

    // A manual detection sitting outside the new boundary too — must NOT be
    // reclassified; manual annotations are never subject to boundary filtering.
    const manualOutside = await getRepositories().detections.create({
      projectId,
      pageId,
      sourceAssetId: asset.id,
      className: "text",
      bbox: { x: 0.9, y: 0.9, width: 0.05, height: 0.05 },
      source: "manual",
    });

    const res = await agent
      .put(`/api/projects/${projectId}/pages/${pageId}/assets/${asset.id}/page-boundary`)
      .send({
        polygon: [
          [0, 0],
          [0.5, 0],
          [0.5, 0.5],
          [0, 0.5],
        ],
        overlapThreshold: 0.5,
      });
    expect(res.status).toBe(200);

    const detections = await agent.get(`/api/projects/${projectId}/pages/${pageId}/detections`);
    const byId = new Map(detections.body.map((d: { id: string; status: string }) => [d.id, d.status]));

    expect(byId.get(wasActiveNowOutside.id)).toBe("rejected");
    expect(byId.get(wasRejectedNowInside.id)).toBe("active");
    expect(byId.get(manualOutside.id)).toBe("active"); // unchanged — manual is never boundary-filtered
  });
});
