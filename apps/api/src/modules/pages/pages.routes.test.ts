import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";
import { authRouter } from "../auth/auth.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { detectionsRouter } from "../detections/detections.routes.js";
import { pagesRouter } from "./pages.routes.js";
import { Router } from "express";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

/**
 * HTTP-integration coverage for Phase D3's multi-page routes — mirrors
 * modules/auth/auth.routes.test.ts's pattern (cookie-issuance and cross-boundary
 * behaviour are properties of route/middleware wiring, not any single repository, so
 * no contract test can see them).
 */

// A minimal page-scoped router, standing in for the many real ones (assets,
// code-versions, overrides, ...) that all share the identical
// requireProjectOwnership -> requirePageInProject composition being tested here.
const pageScopedProbeRouter = Router({ mergeParams: true });
pageScopedProbeRouter.use(requireProjectOwnership);
pageScopedProbeRouter.use(requirePageInProject);
pageScopedProbeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, pageId: req.params.pageId });
  })
);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects/:id/pages/:pageId/detections", detectionsRouter);
  app.use("/api/projects/:id/pages/:pageId/probe", pageScopedProbeRouter);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("pages routes", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  async function registerAndCreateProject(email: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email, password: "correct-horse" });
    const project = await agent.post("/api/projects").send({ name: "Test project" });
    return { agent, projectId: project.body.id as string };
  }

  it("a new project automatically has exactly one page", async () => {
    const { agent, projectId } = await registerAndCreateProject("owner1@example.com");
    const res = await agent.get(`/api/projects/${projectId}/pages`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Page 1");
    expect(res.body[0].order).toBe(1);
  });

  it("creating a second page assigns it order 2", async () => {
    const { agent, projectId } = await registerAndCreateProject("owner2@example.com");
    const res = await agent.post(`/api/projects/${projectId}/pages`).send({ name: "Page 2" });
    expect(res.status).toBe(201);
    expect(res.body.order).toBe(2);
  });

  it("renaming a page persists the new name", async () => {
    const { agent, projectId } = await registerAndCreateProject("owner3@example.com");
    const list = await agent.get(`/api/projects/${projectId}/pages`);
    const pageId = list.body[0].id;
    const res = await agent.patch(`/api/projects/${projectId}/pages/${pageId}`).send({ name: "Home" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Home");
  });

  it("refuses to delete a project's only page", async () => {
    const { agent, projectId } = await registerAndCreateProject("owner4@example.com");
    const list = await agent.get(`/api/projects/${projectId}/pages`);
    const pageId = list.body[0].id;
    const res = await agent.delete(`/api/projects/${projectId}/pages/${pageId}`);
    expect(res.status).toBe(400);
  });

  it("deletes a page once a second one exists", async () => {
    const { agent, projectId } = await registerAndCreateProject("owner5@example.com");
    const list = await agent.get(`/api/projects/${projectId}/pages`);
    const firstPageId = list.body[0].id;
    await agent.post(`/api/projects/${projectId}/pages`).send({ name: "Page 2" });

    const res = await agent.delete(`/api/projects/${projectId}/pages/${firstPageId}`);
    expect(res.status).toBe(204);

    const remaining = await agent.get(`/api/projects/${projectId}/pages`);
    expect(remaining.body).toHaveLength(1);
  });

  it("a page from another project 404s through requirePageInProject", async () => {
    const { agent: ownerA, projectId: projectA } = await registerAndCreateProject("cross-a@example.com");
    const { agent: ownerB, projectId: projectB } = await registerAndCreateProject("cross-b@example.com");

    const pagesA = await ownerA.get(`/api/projects/${projectA}/pages`);
    const pageIdFromA = pagesA.body[0].id;

    // ownerB owns projectB but tries to reach page A's id through project B's URL —
    // requireProjectOwnership passes (ownerB does own projectB), so this specifically
    // exercises requirePageInProject rejecting a page that belongs to a different project.
    const res = await ownerB.get(`/api/projects/${projectB}/pages/${pageIdFromA}/probe`);
    expect(res.status).toBe(404);
  });

  it("isolates detections between two pages of the same project", async () => {
    const { agent, projectId } = await registerAndCreateProject("isolation@example.com");
    const list = await agent.get(`/api/projects/${projectId}/pages`);
    const page1 = list.body[0].id;
    const page2Res = await agent.post(`/api/projects/${projectId}/pages`).send({ name: "Page 2" });
    const page2 = page2Res.body.id;

    await agent.post(`/api/projects/${projectId}/pages/${page1}/detections`).send({
      className: "button",
      bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
      sourceAssetId: "asset-1",
    });

    const page1List = await agent.get(`/api/projects/${projectId}/pages/${page1}/detections`);
    const page2List = await agent.get(`/api/projects/${projectId}/pages/${page2}/detections`);
    expect(page1List.body).toHaveLength(1);
    expect(page2List.body).toHaveLength(0);
  });
});
