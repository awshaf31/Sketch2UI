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
import { adminRouter } from "./admin.routes.js";

/**
 * SaaS phase S6 — the admin shell's first route. Mirrors auth.routes.test.ts's
 * pattern: role gating is middleware/route wiring, not something a repository
 * contract test can see.
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/admin", requireAdmin, adminRouter);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

// There is no self-service or route-driven way to become an admin (deliberately, per
// Phase 9 of the brief — role changes are a controlled operation, see
// apps/api/scripts/promote-admin.ts). Goes through UserRepository.setRole() rather
// than db.state directly — check:db-state's zero-direct-access invariant applies to
// every file under apps/api/src, test files included.
async function promoteToAdmin(email: string): Promise<void> {
  const user = await getRepositories().users.findByEmail(email);
  if (!user) throw new Error(`test setup: no user with email ${email}`);
  await getRepositories().users.setRole(user.id, "admin");
}

describe("admin routes", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
  });

  it("GET /api/admin/overview without a session returns 401", async () => {
    const res = await request(app).get("/api/admin/overview");
    expect(res.status).toBe(401);
  });

  it("GET /api/admin/overview as a regular authenticated user returns 403, not 404", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({ email: "regular@example.com", password: "correct-horse" });

    const res = await agent.get("/api/admin/overview");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("GET /api/admin/overview as an admin returns real counts", async () => {
    const admin = request.agent(app);
    await admin.post("/api/auth/register").send({ email: "admin@example.com", password: "correct-horse" });
    await promoteToAdmin("admin@example.com");

    const other = request.agent(app);
    await other.post("/api/auth/register").send({ email: "other@example.com", password: "correct-horse" });
    await other.post("/api/projects").send({ name: "Someone else's project" });
    await other.post("/api/projects").send({ name: "Another project" });

    const res = await admin.get("/api/admin/overview");
    expect(res.status).toBe(200);
    // 2 registered users so far (admin + other) — an admin sees the whole platform's
    // count, not just their own, unlike GET /api/projects.
    expect(res.body.totalUsers).toBe(2);
    expect(res.body.totalProjects).toBe(2);
    expect(res.body.generatedProjects).toBe(0);
  });

  describe("GET /api/admin/users", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular2@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/users");
      expect(res.status).toBe(403);
    });

    it("as an admin lists every user with email, role, createdAt, and project count — never a password hash", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "listadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("listadmin@example.com");

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "listother@example.com", password: "correct-horse" });
      await other.post("/api/projects").send({ name: "P1" });
      await other.post("/api/projects").send({ name: "P2" });

      const res = await admin.get("/api/admin/users");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);

      const other_ = res.body.find((u: { email: string }) => u.email === "listother@example.com");
      expect(other_.projectCount).toBe(2);
      expect(other_.role).toBe("user");
      expect(typeof other_.createdAt).toBe("string");
      expect(other_.passwordHash).toBeUndefined();

      const admin_ = res.body.find((u: { email: string }) => u.email === "listadmin@example.com");
      expect(admin_.role).toBe("admin");
      expect(admin_.projectCount).toBe(0);
    });
  });

  describe("GET /api/admin/projects", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular3@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/projects");
      expect(res.status).toBe(403);
    });

    it("as an admin lists every project across every user, with the owner's email", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "projadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("projadmin@example.com");

      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "projowner@example.com", password: "correct-horse" });
      await owner.post("/api/projects").send({ name: "Not mine to see, but admin can" });

      const res = await admin.get("/api/admin/projects");
      expect(res.status).toBe(200);
      const found = res.body.find((p: { name: string }) => p.name === "Not mine to see, but admin can");
      expect(found).toBeDefined();
      expect(found.ownerEmail).toBe("projowner@example.com");
      expect(found.status).toBe("draft");
    });

    it("filters by name/owner-email search (?q=)", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "qadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("qadmin@example.com");
      await admin.post("/api/projects").send({ name: "Findable Project" });
      await admin.post("/api/projects").send({ name: "Other Thing" });

      const res = await admin.get("/api/admin/projects?q=findable");
      expect(res.body.map((p: { name: string }) => p.name)).toEqual(["Findable Project"]);
    });

    it("filters by status (?status=)", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "statusadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("statusadmin@example.com");
      await admin.post("/api/projects").send({ name: "Draft one" });

      const res = await admin.get("/api/admin/projects?status=generated");
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/admin/projects/:id", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular4@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/projects/anything");
      expect(res.status).toBe(403);
    });

    it("as an admin returns a genuine 404 for a missing project, not the ownership-obscurity kind", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "detailadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("detailadmin@example.com");

      const res = await admin.get("/api/admin/projects/does-not-exist");
      expect(res.status).toBe(404);
    });

    it("as an admin returns the project's own details and jobs, even though the admin doesn't own it", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "detailadmin2@example.com", password: "correct-horse" });
      await promoteToAdmin("detailadmin2@example.com");

      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "detailowner@example.com", password: "correct-horse" });
      const created = await owner.post("/api/projects").send({ name: "Detail Target" });
      const projectId = created.body.id as string;
      await getRepositories().jobs.create({ projectId, type: "detect" });

      const res = await admin.get(`/api/admin/projects/${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Detail Target");
      expect(res.body.ownerEmail).toBe("detailowner@example.com");
      expect(res.body.jobs).toHaveLength(1);
      expect(res.body.jobs[0].type).toBe("detect");
      expect(res.body.jobs[0].status).toBe("queued");
    });
  });

  describe("GET /api/admin/jobs", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular5@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/jobs");
      expect(res.status).toBe(403);
    });

    it("as an admin lists jobs across every project, with project name and owner email", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "jobsadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("jobsadmin@example.com");

      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "jobsowner@example.com", password: "correct-horse" });
      const created = await owner.post("/api/projects").send({ name: "Jobs Target" });
      const projectId = created.body.id as string;
      const job = await getRepositories().jobs.create({ projectId, type: "detect" });
      await getRepositories().jobs.update(job.id, { status: "failed", stage: "failed", errorMessage: "boom" });

      const res = await admin.get("/api/admin/jobs");
      expect(res.status).toBe(200);
      const found = res.body.find((j: { id: string }) => j.id === job.id);
      expect(found.projectName).toBe("Jobs Target");
      expect(found.ownerEmail).toBe("jobsowner@example.com");
      expect(found.status).toBe("failed");
      expect(found.errorMessage).toBe("boom");
    });

    it("filters by status (?status=)", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "jobsstatusadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("jobsstatusadmin@example.com");
      const created = await admin.post("/api/projects").send({ name: "Status filter target" });
      await getRepositories().jobs.create({ projectId: created.body.id, type: "detect" });

      const res = await admin.get("/api/admin/jobs?status=completed");
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/admin/models", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular6@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/models");
      expect(res.status).toBe(403);
    });

    it("as an admin lists the real model registry, reading straight off disk", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "modelsadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("modelsadmin@example.com");

      const res = await admin.get("/api/admin/models");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      const v1 = res.body.find((m: { version: string }) => m.version === "v1.0.0");
      expect(v1).toBeDefined();
      expect(v1.family).toBe("ui-detector");
      expect(v1.status).toBe("smoke_test");
      expect(v1.active).toBe(true);
      expect(v1.metrics).not.toBeNull();
    });
  });

  describe("GET /api/admin/training", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular7@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/training");
      expect(res.status).toBe(403);
    });

    it("is empty when nothing has been approved", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "trainingadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("trainingadmin@example.com");

      const res = await admin.get("/api/admin/training");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/admin/audit-logs", () => {
    it("as a regular authenticated user returns 403", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "regular8@example.com", password: "correct-horse" });
      const res = await agent.get("/api/admin/audit-logs");
      expect(res.status).toBe(403);
    });

    it("records USER_REGISTERED on register, with the actor's email resolved", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin@example.com");

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "auditsubject@example.com", password: "correct-horse" });

      const res = await admin.get("/api/admin/audit-logs");
      expect(res.status).toBe(200);
      const entry = res.body.find(
        (e: { event: string; actorEmail: string }) => e.event === "user_registered" && e.actorEmail === "auditsubject@example.com"
      );
      expect(entry).toBeDefined();
    });

    it("records USER_LOGIN and USER_LOGOUT", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin2@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin2@example.com");

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "loginlogout@example.com", password: "correct-horse" });
      await other.post("/api/auth/login").send({ email: "loginlogout@example.com", password: "correct-horse" });
      await other.post("/api/auth/logout");

      const res = await admin.get("/api/admin/audit-logs");
      const events = res.body
        .filter((e: { actorEmail: string }) => e.actorEmail === "loginlogout@example.com")
        .map((e: { event: string }) => e.event);
      expect(events).toContain("user_login");
      expect(events).toContain("user_logout");
    });

    it("records PROJECT_CREATED and PROJECT_DELETED with the project name", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin3@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin3@example.com");

      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "projectaudit@example.com", password: "correct-horse" });
      const created = await owner.post("/api/projects").send({ name: "Audited Project" });
      await owner.delete(`/api/projects/${created.body.id}`);

      const res = await admin.get("/api/admin/audit-logs");
      const createdEntry = res.body.find((e: { event: string; targetId: string }) => e.event === "project_created" && e.targetId === created.body.id);
      const deletedEntry = res.body.find((e: { event: string; targetId: string }) => e.event === "project_deleted" && e.targetId === created.body.id);
      expect(createdEntry.metadata.projectName).toBe("Audited Project");
      expect(deletedEntry.metadata.projectName).toBe("Audited Project");
    });

    it("records PROJECT_ACCESSED_BY_ADMIN when an admin views a project's detail page", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin4@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin4@example.com");

      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "accessedowner@example.com", password: "correct-horse" });
      const created = await owner.post("/api/projects").send({ name: "Viewed by admin" });

      await admin.get(`/api/admin/projects/${created.body.id}`);

      const res = await admin.get("/api/admin/audit-logs");
      const entry = res.body.find(
        (e: { event: string; targetId: string }) => e.event === "project_accessed_by_admin" && e.targetId === created.body.id
      );
      expect(entry).toBeDefined();
      expect(entry.actorEmail).toBe("auditadmin4@example.com");
    });

    it("never includes a password hash anywhere in the response", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin5@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin5@example.com");

      const res = await admin.get("/api/admin/audit-logs");
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|correct-horse/);
    });

    it("respects ?limit=", async () => {
      const admin = request.agent(app);
      await admin.post("/api/auth/register").send({ email: "auditadmin6@example.com", password: "correct-horse" });
      await promoteToAdmin("auditadmin6@example.com");
      await admin.post("/api/projects").send({ name: "A" });
      await admin.post("/api/projects").send({ name: "B" });
      await admin.post("/api/projects").send({ name: "C" });

      const res = await admin.get("/api/admin/audit-logs?limit=1");
      expect(res.body).toHaveLength(1);
    });
  });
});
