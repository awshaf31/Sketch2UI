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
import { jobsRouter } from "../jobs/jobs.routes.js";

/**
 * SaaS transformation plan, Phase S1 (database ownership/integrity audit) and
 * Phase S11/22 (explicit negative authorization tests).
 *
 * Every route exercised here already enforces ownership via requireProjectOwnership /
 * an inline fetch-then-check (see requireProjectOwnership.ts, jobs.routes.ts) — this
 * file doesn't change that behaviour, it just gives the "User A can never reach User
 * B's data" property its own dedicated, explicit test coverage, which D0's audit found
 * was previously only proven incidentally (one GET case in auth.routes.test.ts) rather
 * than asserted as its own concern. Mirrors auth.routes.test.ts's and
 * pages.routes.test.ts's supertest pattern.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects/:id/pages", pagesRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("cross-user security isolation", () => {
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

  describe("project resource", () => {
    it("PATCH by a non-owner returns 404, not 200 or 403", async () => {
      const { projectId } = await registerAndCreateProject("patch-owner@example.com");
      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "patch-other@example.com", password: "correct-horse" });

      const res = await other.patch(`/api/projects/${projectId}`).send({ name: "Hijacked" });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("DELETE by a non-owner returns 404, and the project still exists for its owner", async () => {
      const { agent: owner, projectId } = await registerAndCreateProject("delete-owner@example.com");
      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "delete-other@example.com", password: "correct-horse" });

      const res = await other.delete(`/api/projects/${projectId}`);
      expect(res.status).toBe(404);

      const stillThere = await owner.get(`/api/projects/${projectId}`);
      expect(stillThere.status).toBe(200);
    });

    it("GET/PATCH/DELETE without a session all return 401, before ownership is ever checked", async () => {
      const { projectId } = await registerAndCreateProject("anon-owner@example.com");

      const getRes = await request(app).get(`/api/projects/${projectId}`);
      const patchRes = await request(app).patch(`/api/projects/${projectId}`).send({ name: "x" });
      const deleteRes = await request(app).delete(`/api/projects/${projectId}`);

      expect(getRes.status).toBe(401);
      expect(patchRes.status).toBe(401);
      expect(deleteRes.status).toBe(401);
    });
  });

  describe("page resource (nested under project)", () => {
    it("POST a page under another user's project returns 404", async () => {
      const { projectId } = await registerAndCreateProject("pages-owner@example.com");
      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "pages-other@example.com", password: "correct-horse" });

      const res = await other.post(`/api/projects/${projectId}/pages`).send({ name: "Sneaky page" });
      expect(res.status).toBe(404);
    });

    it("GET the page list of another user's project returns 404, not an empty/leaked list", async () => {
      const { projectId } = await registerAndCreateProject("pages-list-owner@example.com");
      const other = request.agent(app);
      await other
        .post("/api/auth/register")
        .send({ email: "pages-list-other@example.com", password: "correct-horse" });

      const res = await other.get(`/api/projects/${projectId}/pages`);
      expect(res.status).toBe(404);
    });
  });

  describe("job resource (top-level route, ownership resolved via its project id)", () => {
    it("GET a job belonging to another user's project returns 404", async () => {
      const { agent: owner, projectId } = await registerAndCreateProject("job-owner@example.com");
      const job = await getRepositories().jobs.create({ projectId, type: "detect" });

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "job-other@example.com", password: "correct-horse" });
      const res = await other.get(`/api/jobs/${job.id}`);
      expect(res.status).toBe(404);

      // Sanity: the owner themself can still see it — confirms the 404 above is really
      // about ownership, not a broken fixture.
      const ownRes = await owner.get(`/api/jobs/${job.id}`);
      expect(ownRes.status).toBe(200);
    });

    it("GET a job without a session returns 401", async () => {
      const { projectId } = await registerAndCreateProject("job-anon-owner@example.com");
      const job = await getRepositories().jobs.create({ projectId, type: "detect" });

      const res = await request(app).get(`/api/jobs/${job.id}`);
      expect(res.status).toBe(401);
    });
  });
});
