import { v4 as uuid } from "uuid";
import type { PrismaClient, ProjectExport as PrismaExport } from "@prisma/client";
import type { ProjectExport } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreateExportInput, ExportRepository } from "../types.js";

/** Prisma-backed ExportRepository. See json/export.repository.ts's doc comment for
 * why `nextVersionNumber` and `create` are separate calls rather than one atomic op. */

function toRecord(row: PrismaExport): ProjectExport {
  return {
    id: row.id,
    projectId: row.projectId,
    codeVersionId: row.codeVersionId,
    versionNumber: row.versionNumber,
    storagePath: row.storagePath,
    fileSize: row.fileSize,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaExportRepository implements ExportRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listByProject(projectId: string): Promise<ProjectExport[]> {
    const rows = await this.prisma.projectExport.findMany({
      where: { projectId },
      orderBy: { versionNumber: "desc" },
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ProjectExport | null> {
    const row = await this.prisma.projectExport.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateExportInput): Promise<ProjectExport> {
    const row = await this.prisma.projectExport.create({
      data: {
        id: uuid(),
        projectId: input.projectId,
        codeVersionId: input.codeVersionId,
        versionNumber: input.versionNumber,
        storagePath: input.storagePath,
        fileSize: input.fileSize,
      },
    });
    return toRecord(row);
  }

  async nextVersionNumber(projectId: string): Promise<number> {
    const count = await this.prisma.projectExport.count({ where: { projectId } });
    return count + 1;
  }
}
