import { v4 as uuid } from "uuid";
import type { PrismaClient, Project as PrismaProject } from "@prisma/client";
import type { ProjectStatus } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type {
  CreateProjectInput,
  DeletedProjectArtifacts,
  ProjectRecord,
  ProjectRepository,
  UpdateProjectInput,
} from "../types.js";

/**
 * Prisma-backed ProjectRepository.
 *
 * The interesting work here is impedance matching, and every mismatch below is a place
 * a parity bug could hide — so each is handled explicitly rather than by a generic
 * spread:
 *
 *   Date  vs  ISO string   Prisma returns `Date`; the domain types use ISO strings
 *                          everywhere (they are serialized straight to JSON responses).
 *   null  vs  undefined    Postgres has no `undefined`. Optional domain fields are
 *                          absent, not null, or `res.json` would start emitting
 *                          `"description": null` where it used to emit nothing.
 *   missing-row semantics  The JSON adapter silently no-ops when updating a project
 *                          that does not exist. Prisma's `update` throws P2025 for
 *                          that, so `updateMany` is used where the contract says
 *                          "no-op", keeping both adapters observably identical.
 */

function toRecord(row: PrismaProject): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    // `?? undefined` not `?? null`: the domain type declares `description?: string`, and
    // emitting an explicit null would change the response body shape.
    ...(row.description === null ? {} : { description: row.description }),
    status: row.status as ProjectStatus,
    ownerId: row.ownerId,
    ...(row.activeCodeVersionId === null
      ? {}
      : { activeCodeVersionId: row.activeCodeVersionId }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async list(): Promise<ProjectRecord[]> {
    const rows = await this.prisma.project.findMany();
    return rows.map(toRecord);
  }

  async listByOwner(ownerId: string): Promise<ProjectRecord[]> {
    const rows = await this.prisma.project.findMany({ where: { ownerId } });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    const row = await this.prisma.project.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateProjectInput): Promise<ProjectRecord> {
    const row = await this.prisma.project.create({
      data: {
        // The id is generated here rather than by the database so both adapters produce
        // the same kind of identifier (uuid v4) — the JSON store has always done this,
        // and changing id format mid-migration would invalidate every stored reference.
        id: uuid(),
        name: input.name,
        description: input.description ?? null,
        status: "draft",
        ownerId: input.ownerId,
      },
    });
    return toRecord(row);
  }

  async update(id: string, patch: UpdateProjectInput): Promise<ProjectRecord | null> {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await this.prisma.project.update({
      where: { id },
      data: {
        // Only fields the caller actually supplied. Passing `undefined` to Prisma means
        // "leave unchanged", which matches the contract exactly.
        name: patch.name,
        description: patch.description,
        status: patch.status,
        // `@updatedAt` in the schema maintains updatedAt automatically.
      },
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<DeletedProjectArtifacts | null> {
    // One transaction: read the file-bearing rows, then delete the project and let the
    // schema's ON DELETE CASCADE remove everything else. Reading first is mandatory —
    // after the delete those rows are gone and the caller could never clean up the
    // uploaded images and export ZIPs they name.
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id } });
      if (!project) return null;

      const [assetRows, exportRows] = await Promise.all([
        tx.projectAsset.findMany({ where: { projectId: id } }),
        tx.projectExport.findMany({ where: { projectId: id } }),
      ]);

      await tx.project.delete({ where: { id } });

      return {
        assets: assetRows.map((a) => ({
          id: a.id,
          projectId: a.projectId,
          pageId: a.pageId,
          storageKey: a.storageKey,
          mimeType: a.mimeType,
          width: a.width,
          height: a.height,
          fileSize: a.fileSize,
          createdAt: a.createdAt.toISOString(),
        })),
        exports: exportRows.map((e) => ({
          id: e.id,
          projectId: e.projectId,
          codeVersionId: e.codeVersionId,
          versionNumber: e.versionNumber,
          storagePath: e.storagePath,
          fileSize: e.fileSize,
          createdAt: e.createdAt.toISOString(),
        })),
      };
    });
  }

  async setActiveCodeVersion(projectId: string, codeVersionId: string): Promise<void> {
    // updateMany, not update: the contract is a silent no-op for a missing project, and
    // `update` would throw P2025 instead.
    await this.prisma.project.updateMany({
      where: { id: projectId },
      data: { activeCodeVersionId: codeVersionId },
    });
  }

  async setStatus(projectId: string, status: ProjectStatus): Promise<void> {
    await this.prisma.project.updateMany({
      where: { id: projectId },
      data: { status },
    });
  }
}
