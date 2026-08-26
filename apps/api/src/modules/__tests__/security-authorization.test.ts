import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { getRepositories } from "../../repositories/index.js";
import { authRouter } from "../auth/auth.routes.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { pagesRouter } from "../pages/pages.routes.js";
import { detectionsRouter } from "../detections/detections.routes.js";
import { codeVersionsRouter } from "../codegen/code-versions.routes.js";
import { exportsRouter } from "../exports/exports.routes.js";
import { adminRouter } from "../admin/admin.routes.js";

/**
 * SaaS phase S11 — Authorization/security tests (brief Phase 22). D0's audit and the
 * S1/S6–S10 test files already proved the project/page/job/asset/admin cases from
 * Phase 22's own list — see cross-user-security.test.ts, assets.routes.test.ts
 * (DEF-008), and admin.routes.test.ts's per-route 403 checks. This file closes the
 * remaining gaps Phase 22 and Phase 15's question list name explicitly but that had
 * no dedicated HTTP-integration test yet: detections (Phase 15 Q3: "can a user modify
 * another user's detection?"), code versions (Q4), exports (Q5), and a complete
 * unauthenticated-401 sweep across every /api/admin route (previously only checked
 * for /overview).
 *
 * Every route this file touches shares the same requireProjectOwnership (+
 * requirePageInProject) composition already proven generically in
 * pages.routes.test.ts's probe-router test — these are the same guarantee applied to
 * the specific, named, product-critical flows Phase 22 calls out, not a search for a
 * different bug.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/admin", requireAdmin, adminRouter);
  app.use("/api/projects/:id/pages/:pageId/detections", detectionsRouter);
  app.use("/api/projects/:id/pages/:pageId/code-versions", codeVersionsRouter);
  app.use("/api/projects/:id/exports", exportsRouter);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("security authorization sweep", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  async function registerAndCreateProject(email: string) {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email, password: "correct-horse" });
    const project = await agent.post("/api/projects").send({ name: "Test project" });
    const pages = await agent.get(`/api/projects/${project.body.id}/pages`);
    return { agent, projectId: project.body.id as string, pageId: pages.body[0].id as string };
  }

  describe("detections — Phase 15 Q3 (\"can a user modify another user's detection?\")", () => {
    it("User A cannot list, create, correct, or delete detections on User B's page", async () => {
      const { agent: ownerB, projectId, pageId } = await registerAndCreateProject("detowner@example.com");
      const created = await ownerB.post(`/api/projects/${projectId}/pages/${pageId}/detections`).send({
        className: "button",
        bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
        sourceAssetId: "asset-1",
      });
      const detectionId = created.body.id as string;

      const userA = request.agent(app);
      await userA.post("/api/auth/register").send({ email: "detattacker@example.com", password: "correct-horse" });

      const list = await userA.get(`/api/projects/${projectId}/pages/${pageId}/detections`);
      const create = await userA
        .post(`/api/projects/${projectId}/pages/${pageId}/detections`)
        .send({ className: "input", bbox: { x: 0, y: 0, width: 0.1, height: 0.1 }, sourceAssetId: "asset-1" });
      const patch = await userA
        .patch(`/api/projects/${projectId}/pages/${pageId}/detections/${detectionId}`)
        .send({ className: "hijacked" });
      const del = await userA.delete(`/api/projects/${projectId}/pages/${pageId}/detections/${detectionId}`);

      expect(list.status).toBe(404);
      expect(create.status).toBe(404);
      expect(patch.status).toBe(404);
      expect(del.status).toBe(404);

      // Confirms these 404s are real ownership blocks, not accidental no-ops: the
      // detection is untouched from the owner's own point of view.
      const stillThere = await ownerB.get(`/api/projects/${projectId}/pages/${pageId}/detections`);
      expect(stillThere.body).toHaveLength(1);
      expect(stillThere.body[0].className).toBe("button");
    });

    it("unauthenticated GET returns 401 before any ownership check", async () => {
      const { projectId, pageId } = await registerAndCreateProject("detowner2@example.com");
      const res = await request(app).get(`/api/projects/${projectId}/pages/${pageId}/detections`);
      expect(res.status).toBe(401);
    });
  });

  describe("code versions — Phase 15 Q4 (\"can a user access another user's code version?\")", () => {
    it("User A cannot list or create code versions on User B's page", async () => {
      const { projectId, pageId } = await registerAndCreateProject("cvowner@example.com");

      const userA = request.agent(app);
      await userA.post("/api/auth/register").send({ email: "cvattacker@example.com", password: "correct-horse" });

      const list = await userA.get(`/api/projects/${projectId}/pages/${pageId}/code-versions`);
      const create = await userA
        .post(`/api/projects/${projectId}/pages/${pageId}/code-versions`)
        .send({ html: "<p>hi</p>", css: "" });

      expect(list.status).toBe(404);
      expect(create.status).toBe(404);
    });

    it("unauthenticated GET returns 401", async () => {
      const { projectId, pageId } = await registerAndCreateProject("cvowner2@example.com");
      const res = await request(app).get(`/api/projects/${projectId}/pages/${pageId}/code-versions`);
      expect(res.status).toBe(401);
    });
  });

  describe("exports — Phase 15 Q5 (\"can a user download another user's export?\")", () => {
    it("User A cannot list or trigger exports for User B's project", async () => {
      const { projectId } = await registerAndCreateProject("exportowner@example.com");

      const userA = request.agent(app);
      await userA.post("/api/auth/register").send({ email: "exportattacker@example.com", password: "correct-horse" });

      const list = await userA.get(`/api/projects/${projectId}/exports`);
      const create = await userA.post(`/api/projects/${projectId}/exports`).send({});
      // A guessed/fabricated export id under the victim's project id must also 404,
      // not just an empty list.
      const download = await userA.get(`/api/projects/${projectId}/exports/does-not-exist/download`);

      expect(list.status).toBe(404);
      expect(create.status).toBe(404);
      expect(download.status).toBe(404);
    });

    it("unauthenticated GET returns 401", async () => {
      const { projectId } = await registerAndCreateProject("exportowner2@example.com");
      const res = await request(app).get(`/api/projects/${projectId}/exports`);
      expect(res.status).toBe(401);
    });
  });

  describe("admin routes — unauthenticated sweep (brief Phase 22: \"Unauthenticated -> project API -> 401\", extended to every admin route)", () => {
    const adminGetRoutes = [
      "/api/admin/overview",
      "/api/admin/users",
      "/api/admin/projects",
      "/api/admin/jobs",
      "/api/admin/models",
      "/api/admin/training",
      "/api/admin/audit-logs",
    ];

    it.each(adminGetRoutes)("GET %s without a session returns 401, not 403 or 404", async (route) => {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    });
  });

  describe("admin project detail — cross-cutting (Phase 10 + Phase 22 combined)", () => {
    it("a regular authenticated user gets 403 on an admin project-detail route, even for their OWN project", async () => {
      const { agent, projectId } = await registerAndCreateProject("ownprojectuser@example.com");
      const res = await agent.get(`/api/admin/projects/${projectId}`);
      expect(res.status).toBe(403);
    });
  });
});
