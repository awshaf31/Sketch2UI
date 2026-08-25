import { v4 as uuid } from "uuid";
import type { PrismaClient, CodeVersion as PrismaCodeVersion } from "@prisma/client";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CodeVersionRepository, CreateCodeVersionInput } from "../types.js";

/**
 * Prisma-backed CodeVersionRepository.
 *
 * `create` RUNS IN A TRANSACTION so `versionNumber` assignment is race-free: two
 * concurrent saves for the same project must not both compute `existing.length + 1`
 * and collide. The schema's `@@unique([projectId, versionNumber])` is the backstop, but
 * relying on it would mean a second concurrent writer sees a constraint-violation
 * error instead of a version — the transaction turns that into "one waits its turn."
 */

function toRecord(row: PrismaCodeVersion): CodeVersion {
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    versionNumber: row.versionNumber,
    source: row.source as CodeVersion["source"],
    html: row.html,
    css: row.css,
    ...(row.javascript === null ? {} : { javascript: row.javascript }),
    ...(row.metadata === null ? {} : { metadata: row.metadata as CodeVersion["metadata"] }),
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaCodeVersionRepository implements CodeVersionRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listByProject(projectId: string): Promise<CodeVersion[]> {
    const rows = await this.prisma.codeVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
    });
    return rows.map(toRecord);
  }

  async listByPage(pageId: string): Promise<CodeVersion[]> {
    const rows = await this.prisma.codeVersion.findMany({
      where: { pageId },
      orderBy: { versionNumber: "desc" },
    });
    return rows.map(toRecord);
  }

  async findById(projectId: string, versionId: string): Promise<CodeVersion | null> {
    const row = await this.prisma.codeVersion.findFirst({ where: { id: versionId, projectId } });
    return row ? toRecord(row) : null;
  }

  async findByPage(pageId: string, versionId: string): Promise<CodeVersion | null> {
    const row = await this.prisma.codeVersion.findFirst({ where: { id: versionId, pageId } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateCodeVersionInput): Promise<CodeVersion> {
    // Version numbers are per-PAGE (Phase D3): count scoped to pageId, matching the
    // schema's @@unique([pageId, versionNumber]).
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.codeVersion.count({ where: { pageId: input.pageId } });
      const row = await tx.codeVersion.create({
        data: {
          id: uuid(),
          projectId: input.projectId,
          pageId: input.pageId,
          versionNumber: count + 1,
          source: input.source,
          html: input.html,
          css: input.css,
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
      });
      return toRecord(row);
    });
  }

  async resolveActive(projectId: string): Promise<CodeVersion | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { activeCodeVersionId: true },
    });

    if (project?.activeCodeVersionId) {
      const pinned = await this.prisma.codeVersion.findFirst({
        where: { id: project.activeCodeVersionId, projectId },
      });
      if (pinned) return toRecord(pinned);
    }

    const latest = await this.prisma.codeVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
    });
    return latest ? toRecord(latest) : null;
  }

  async resolveActiveForPage(pageId: string): Promise<CodeVersion | null> {
    const page = await this.prisma.page.findUnique({
      where: { id: pageId },
      select: { activeCodeVersionId: true },
    });

    if (page?.activeCodeVersionId) {
      const pinned = await this.prisma.codeVersion.findFirst({
        where: { id: page.activeCodeVersionId, pageId },
      });
      if (pinned) return toRecord(pinned);
    }

    const latest = await this.prisma.codeVersion.findFirst({
      where: { pageId },
      orderBy: { versionNumber: "desc" },
    });
    return latest ? toRecord(latest) : null;
  }
}
