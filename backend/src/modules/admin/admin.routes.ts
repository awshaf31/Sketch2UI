import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendError } from "../../middleware/apiError.js";
import { getRepositories } from "../../repositories/index.js";
import { listModels } from "./models.service.js";

// Admin API. Grown incrementally, one SaaS phase per domain (S6 shell/Overview, S7 Users,
// S8 Projects, S9 Jobs/Models/Training; Audit Logs is still ahead).
//
// /overview's numbers are real, currently-cheap-to-compute database aggregates — no
// fabricated or placeholder stats (per the brief's explicit "do not invent
// statistics" rule, Phase 8). Deliberately NOT included there: "Active Users" (no
// last-login tracking exists on User yet — adding one is a schema decision that
// belongs to a phase that actually uses it, not a shell), "Active Model" (models are
// files under ml/models/, not a Prisma entity — surfaced instead on /models, a
// filesystem-backed route rather than a database aggregate).

export const adminRouter = Router();

adminRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const repos = getRepositories();
    const [totalUsers, projects] = await Promise.all([repos.users.count(), repos.projects.list()]);
    const generatedProjects = projects.filter((p) => p.status === "generated").length;

    res.json({
      totalUsers,
      totalProjects: projects.length,
      generatedProjects,
    });
  })
);

// GET /api/admin/users — SaaS phase S7. Read-only by design (brief Phase 9: "Admin
// actions should be limited to real supported functionality... Do not give admin
// arbitrary password access."). No deactivate/role-change here: this app has no
// deactivation concept to begin with (a fabricated always-"Active" status column
// would tell the admin nothing real), and role changes stay a deliberate,
// out-of-band operation (backend/scripts/promote-admin.ts) rather than a
// self-service admin-UI button, per Phase 9's own "if required" hedge and Phase 6's
// "role changes are a controlled operation" reasoning.
//
// `passwordHash` is never included in the response — same discipline as
// `toPublicUser()` in auth.routes.ts, just re-declared here since this route has its
// own response shape (adds `projectCount`, which /me's caller-scoped shape has no
// use for).
adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const repos = getRepositories();
    const [users, projects] = await Promise.all([repos.users.listAll(), repos.projects.list()]);

    const projectCountByOwner = new Map<string, number>();
    for (const project of projects) {
      projectCountByOwner.set(project.ownerId, (projectCountByOwner.get(project.ownerId) ?? 0) + 1);
    }

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        projectCount: projectCountByOwner.get(u.id) ?? 0,
      }))
    );
  })
);

// GET /api/admin/projects?q=&status= — SaaS phase S8 (brief Phase 10: search, filter,
// view project/owner/creation date/status). Read-only ("prefer read-only oversight
// first" — Phase 10's own explicit instruction): no edit/delete route here, matching
// Phase 9's "do not silently edit user project content" principle extended to
// projects.
//
// Deliberately NOT using requireProjectOwnership — that middleware enforces "the
// CALLER owns this," which is the wrong check entirely for an admin, who by
// definition needs to see projects they don't own. Authorization here is
// requireAdmin alone (already applied at the router level in server.ts).
adminRouter.get(
  "/projects",
  asyncHandler(async (req, res) => {
    const repos = getRepositories();
    const [projects, users] = await Promise.all([repos.projects.list(), repos.users.listAll()]);
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const filtered = projects.filter((p) => {
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || (emailById.get(p.ownerId) ?? "").toLowerCase().includes(q);
      const matchesStatus = !status || p.status === status;
      return matchesQuery && matchesStatus;
    });

    res.json(
      filtered.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        ownerEmail: emailById.get(p.ownerId) ?? "(unknown)",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }))
    );
  })
);

// GET /api/admin/projects/:id — project detail + its jobs (Phase 10: "inspect
// associated jobs"). A genuine 404 for a missing project, not the
// existence-enumeration-avoidance 404 requireProjectOwnership uses elsewhere — an
// admin is allowed to know whether any given project id exists at all.
adminRouter.get(
  "/projects/:id",
  asyncHandler(async (req, res) => {
    const repos = getRepositories();
    const project = await repos.projects.findById(req.params.id);
    if (!project) {
      return sendError(res, 404, "NOT_FOUND", "Project not found.");
    }
    const [owner, jobs] = await Promise.all([
      repos.users.findById(project.ownerId),
      repos.jobs.listByProject(project.id),
    ]);

    await repos.auditLogs.record({
      event: "project_accessed_by_admin",
      userId: req.userId!,
      targetType: "project",
      targetId: project.id,
      metadata: { projectName: project.name, ownerEmail: owner?.email ?? "(unknown)" },
    });

    res.json({
      id: project.id,
      name: project.name,
      status: project.status,
      ownerEmail: owner?.email ?? "(unknown)",
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        status: j.status,
        stage: j.stage,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        errorMessage: j.errorMessage ?? null,
      })),
    });
  })
);

// GET /api/admin/jobs?status= — SaaS phase S9 (brief Phase 11: "Job ID, Project,
// User, Operation, Status, Created, Started, Completed, Error"). No separate
// "Started"/"Completed" timestamps exist on Job (backend/database/schema.prisma) — a
// job's `updatedAt` IS the moment it last changed status, which is the honest
// equivalent without inventing columns the schema doesn't track; exposed here as
// `updatedAt` rather than mislabeled as "Completed" (a queued job's updatedAt isn't a
// completion time).
adminRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const repos = getRepositories();
    const [jobs, projects, users] = await Promise.all([
      repos.jobs.listAll(),
      repos.projects.list(),
      repos.users.listAll(),
    ]);
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const status = typeof req.query.status === "string" ? req.query.status : "";
    const filtered = status ? jobs.filter((j) => j.status === status) : jobs;

    res.json(
      filtered.map((j) => {
        const project = projectById.get(j.projectId);
        return {
          id: j.id,
          projectId: j.projectId,
          projectName: project?.name ?? "(deleted project)",
          ownerEmail: project ? (emailById.get(project.ownerId) ?? "(unknown)") : "(unknown)",
          type: j.type,
          status: j.status,
          stage: j.stage,
          createdAt: j.createdAt,
          updatedAt: j.updatedAt,
          errorMessage: j.errorMessage ?? null,
        };
      })
    );
  })
);

// GET /api/admin/models — SaaS phase S9 (brief Phase 12). Filesystem-backed, not a
// repository call — see models.service.ts's header comment for why. No
// delete/promote route: Phase 12 explicitly rules out arbitrary weight deletion and
// keeps promotion a controlled engineering operation, not an admin-UI button.
adminRouter.get(
  "/models",
  asyncHandler(async (_req, res) => {
    res.json(listModels());
  })
);

// GET /api/admin/training — SaaS phase S9 (brief Phase 13: training samples,
// approval status, source project, class count, created date). Every row here is
// already approved — see TrainingRepository.listAll()'s doc comment for why there's
// no separate "pending"/"rejected" state to show, and no reject action here: no such
// API exists to reuse (Phase 13: "use those existing APIs" — there isn't one), and
// Phase 13 also says "do not redesign the dataset pipeline."
adminRouter.get(
  "/training",
  asyncHandler(async (_req, res) => {
    const repos = getRepositories();
    const [samples, projects] = await Promise.all([repos.training.listAll(), repos.projects.list()]);
    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

    res.json(
      samples.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        projectName: projectNameById.get(s.projectId) ?? "(deleted project)",
        datasetSplit: s.datasetSplit,
        boxCount: s.boxes.length,
        classCount: new Set(s.boxes.map((b) => b.className)).size,
        approvedAt: s.approvedAt,
      }))
    );
  })
);

// GET /api/admin/audit-logs?limit= — SaaS phase S10 (brief Phase 14). Newest first,
// capped (default 200) since this is the one admin list that's genuinely unbounded —
// see AuditLogRepository.listRecent()'s doc comment.
const DEFAULT_AUDIT_LOG_LIMIT = 200;

adminRouter.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const repos = getRepositories();
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : DEFAULT_AUDIT_LOG_LIMIT;

    const entries = await repos.auditLogs.listRecent(limit);
    const userIds = [...new Set(entries.map((e) => e.userId).filter((id): id is string => id !== null))];
    const users = await Promise.all(userIds.map((id) => repos.users.findById(id)));
    const emailById = new Map(users.filter((u) => u !== null).map((u) => [u.id, u.email]));

    res.json(
      entries.map((e) => ({
        id: e.id,
        event: e.event,
        actorEmail: e.userId ? (emailById.get(e.userId) ?? "(deleted user)") : null,
        targetType: e.targetType,
        targetId: e.targetId,
        metadata: e.metadata,
        createdAt: e.createdAt,
      }))
    );
  })
);
