import type { PrismaClient, Page as PrismaPage } from "@prisma/client";
import type { Page } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreatePageInput, PageRepository, UpdatePageInput } from "../types.js";

function toRecord(row: PrismaPage): Page {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    order: row.order,
    ...(row.activeCodeVersionId === null ? {} : { activeCodeVersionId: row.activeCodeVersionId }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaPageRepository implements PageRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listByProject(projectId: string): Promise<Page[]> {
    const rows = await this.prisma.page.findMany({ where: { projectId }, orderBy: { order: "asc" } });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<Page | null> {
    const row = await this.prisma.page.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreatePageInput): Promise<Page> {
    const count = await this.prisma.page.count({ where: { projectId: input.projectId } });
    const row = await this.prisma.page.create({
      data: { projectId: input.projectId, name: input.name, order: count + 1 },
    });
    return toRecord(row);
  }

  async update(id: string, patch: UpdatePageInput): Promise<Page | null> {
    const existing = await this.prisma.page.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await this.prisma.page.update({ where: { id }, data: { name: patch.name } });
    return toRecord(row);
  }

  async delete(id: string): Promise<boolean> {
    const page = await this.prisma.page.findUnique({ where: { id } });
    if (!page) return false;

    const siblingCount = await this.prisma.page.count({ where: { projectId: page.projectId } });
    if (siblingCount <= 1) return false;

    await this.prisma.page.delete({ where: { id } });
    return true;
  }

  async setActiveCodeVersion(pageId: string, codeVersionId: string): Promise<void> {
    // updateMany, not update: a silent no-op for a missing page matches the JSON
    // adapter, and `update` would throw P2025 instead (same reasoning as
    // PrismaProjectRepository's setActiveCodeVersion).
    await this.prisma.page.updateMany({ where: { id: pageId }, data: { activeCodeVersionId: codeVersionId } });
  }
}
