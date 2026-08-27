import { v4 as uuid } from "uuid";
import type { Project } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type {
  CreateProjectInput,
  DeletedProjectArtifacts,
  ProjectRecord,
  ProjectRepository,
  UpdateProjectInput,
} from "../types.js";
import type { ProjectStatus } from "@sketch2ui/shared-types";

/**
 * JSON-backed ProjectRepository — Phase 8 compatibility adapter.
 *
 * This is an ADAPTER over the existing `db.state`, not a redesign of JSON persistence.
 * Its purpose is to give the contract a second implementation so the Prisma one can be
 * proven equivalent before anything switches over (amendment §7-§8). It reads and
 * writes the very same store the not-yet-converted modules use, so there is exactly one
 * source of truth during the migration.
 *
 * TWO DELIBERATE DIFFERENCES FROM THE CODE IT REPLACES — both required for the contract
 * to mean anything:
 *
 *   1. DETACHED READS. `db.state.projects.find(...)` hands back a live array element;
 *      callers today mutate it and rely on `db.save()` to persist (amendment §2.3).
 *      Prisma cannot do that — it returns detached rows. So this adapter clones on the
 *      way out. Without this, contract tests would pass on JSON and fail on Prisma,
 *      which is exactly the bug the tests exist to catch.
 *
 *   2. OVERRIDE MAPS STRIPPED. See ProjectRecord's doc comment: overrides are their own
 *      repositories, and the Prisma schema normalizes them into their own tables.
 */

/** Structural clone so no caller can mutate stored state by accident. */
function detach<T>(value: T): T {
  return structuredClone(value);
}

/** Drop the persistence-only override maps and hand back a clean domain record. */
function toRecord(project: Project): ProjectRecord {
  const {
    styleOverrides: _s,
    contentOverrides: _c,
    geometryOverrides: _g,
    structureOverrides: _st,
    ...rest
  } = detach(project);
  return rest;
}

export class JsonProjectRepository implements ProjectRepository {
  async list(): Promise<ProjectRecord[]> {
    return db.state.projects.map(toRecord);
  }

  async listByOwner(ownerId: string): Promise<ProjectRecord[]> {
    return db.state.projects.filter((p) => p.ownerId === ownerId).map(toRecord);
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const project = db.state.projects.find((p) => p.id === id);
    return project ? toRecord(project) : null;
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const now = new Date().toISOString();
    const project: Project = {
      id: uuid(),
      name: input.name,
      description: input.description,
      status: "draft",
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
    };
    db.state.projects.push(project);
    db.save();
    return toRecord(project);
  }

  async update(id: string, patch: UpdateProjectInput): Promise<ProjectRecord | null> {
    const project = db.state.projects.find((p) => p.id === id);
    if (!project) return null;

    // Field-by-field rather than Object.assign: the route only accepts these three, and
    // a blanket merge would let an unexpected body key overwrite `id` or `createdAt`.
    if (patch.name !== undefined) project.name = patch.name;
    if (patch.description !== undefined) project.description = patch.description;
    if (patch.status !== undefined) project.status = patch.status;
    project.updatedAt = new Date().toISOString();

    db.save();
    return toRecord(project);
  }

  async delete(id: string): Promise<DeletedProjectArtifacts | null> {
    const index = db.state.projects.findIndex((p) => p.id === id);
    if (index === -1) return null;

    // Captured BEFORE the cascade, because the caller needs them to delete the files
    // those rows point at. Postgres would lose them to ON DELETE CASCADE otherwise —
    // which is why this is part of the contract rather than something the route does.
    const assets = db.state.assets.filter((a) => a.projectId === id).map(detach);
    const exports = db.state.exports.filter((e) => e.projectId === id).map(detach);

    db.state.projects.splice(index, 1);
    db.state.pages = db.state.pages.filter((p) => p.projectId !== id);
    db.state.assets = db.state.assets.filter((a) => a.projectId !== id);
    db.state.detections = db.state.detections.filter((d) => d.projectId !== id);
    db.state.codeVersions = db.state.codeVersions.filter((c) => c.projectId !== id);
    db.state.jobs = db.state.jobs.filter((j) => j.projectId !== id);
    db.state.trainingSamples = db.state.trainingSamples.filter((t) => t.projectId !== id);
    db.state.exports = db.state.exports.filter((e) => e.projectId !== id);
    db.state.pageBoundaries = db.state.pageBoundaries.filter((b) => b.projectId !== id);
    db.state.correctionRecords = db.state.correctionRecords.filter((r) => r.projectId !== id);
    db.save();

    return { assets, exports };
  }

  async setActiveCodeVersion(projectId: string, codeVersionId: string): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return;
    project.activeCodeVersionId = codeVersionId;
    project.updatedAt = new Date().toISOString();
    db.save();
  }

  async setStatus(projectId: string, status: ProjectStatus): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return;
    project.status = status;
    project.updatedAt = new Date().toISOString();
    db.save();
  }
}
