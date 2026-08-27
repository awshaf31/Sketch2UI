import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { authRouter } from "../auth/auth.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { pagesRouter } from "../pages/pages.routes.js";
import { detectionsRouter } from "../detections/detections.routes.js";
import { contentOverridesRouter } from "./content-overrides.routes.js";

/**
 * HTTP-integration regression coverage for DEF-001 (docs/qa/MASTER_DEFECT_REGISTER.md)
 * — a stored-XSS bypass in the href allowlist. `isSafeHref`'s scheme-detection regex
 * failed to match a scheme containing an embedded whitespace/control character (e.g.
 * "java\nscript:alert(1)"), so the "no scheme found -> treat as relative path -> allow"
 * branch fired instead. Browsers strip exactly those characters from a URL during
 * parsing (WHATWG URL spec) regardless of position, so the stored value still resolved
 * to `javascript:alert(1)` on click. Mirrors e2e/inspector-overrides.spec.ts's existing
 * "<script>" content-security test, but at the HTTP layer and for this specific
 * obfuscation technique rather than the unobfuscated form that test already covers.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects/:id/pages/:pageId/detections", detectionsRouter);
  app.use("/api/projects/:id/pages/:pageId/content-overrides", contentOverridesRouter);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("content-overrides routes — href injection", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  async function setup(email: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email, password: "correct-horse" });
    const project = await agent.post("/api/projects").send({ name: "Test project" });
    const projectId = project.body.id as string;
    const pages = await agent.get(`/api/projects/${projectId}/pages`);
    const pageId = pages.body[0].id as string;
    // "link" is the class content-applicability allows an href override on.
    const detection = await agent
      .post(`/api/projects/${projectId}/pages/${pageId}/detections`)
      .send({ className: "link", bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 }, sourceAssetId: "asset-1" });
    return { agent, projectId, pageId, detectionId: detection.body.id as string };
  }

  it.each([
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    "java\tscript:alert(1)",
    "java\rscript:alert(1)",
    " javascript:alert(1)",
    "javascript:alert(1)\t",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
  ])("rejects href %j", async (payload) => {
    const { agent, projectId, pageId, detectionId } = await setup(`href-${Buffer.from(payload).toString("hex")}@example.com`);
    const res = await agent
      .put(`/api/projects/${projectId}/pages/${pageId}/content-overrides/${detectionId}`)
      .send({ href: payload });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it.each([
    "#section",
    "/page-2.html",
    "./page-2.html",
    "../up.html",
    "https://example.com",
    "http://example.com/path?q=1",
    "mailto:a@b.com",
    "tel:+15551234567",
  ])("accepts legitimate href %j", async (payload) => {
    const { agent, projectId, pageId, detectionId } = await setup(`ok-${Buffer.from(payload).toString("hex")}@example.com`);
    const res = await agent
      .put(`/api/projects/${projectId}/pages/${pageId}/content-overrides/${detectionId}`)
      .send({ href: payload });
    expect(res.status).toBe(200);
    expect(res.body.override.href).toBe(payload);
  });
});
