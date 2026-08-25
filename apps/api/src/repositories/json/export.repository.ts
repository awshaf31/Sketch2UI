import { v4 as uuid } from "uuid";
import type { ProjectExport } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreateExportInput, ExportRepository } from "../types.js";

/**
 * JSON-backed ExportRepository — Phase 8 compatibility adapter.
 *
 * `nextVersionNumber` and `create` are deliberately SEPARATE calls, not one atomic
 * operation: the caller needs the number before it can compute the ZIP's file path,
 * and the ZIP is streamed to disk (seconds of I/O) between the two — a transaction
 * cannot reasonably span that. The race window this leaves (two concurrent exports
 * computing the same number) pre-dates this migration; Prisma's
 * `@@unique([projectId, versionNumber])` at least turns it into a loud error instead
 * of a silently overwritten file, which the JSON store cannot do.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonExportRepository implements ExportRepository {
  /** Newest first, matching the export history route's existing ordering. */
  async listByProject(projectId: string): Promise<ProjectExport[]> {
    return db.state.exports
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map(detach);
  }

  /** Unscoped by project — callers that need a project match check it themselves. */
  async findById(id: string): Promise<ProjectExport | null> {
    const found = db.state.exports.find((e) => e.id === id);
    return found ? detach(found) : null;
  }

  async create(input: CreateExportInput): Promise<ProjectExport> {
    const record: ProjectExport = {
      id: uuid(),
      projectId: input.projectId,
      codeVersionId: input.codeVersionId,
      versionNumber: input.versionNumber,
      storagePath: input.storagePath,
      fileSize: input.fileSize,
      createdAt: new Date().toISOString(),
    };
    db.state.exports.push(record);
    db.save();
    return detach(record);
  }

  async nextVersionNumber(projectId: string): Promise<number> {
    return db.state.exports.filter((e) => e.projectId === projectId).length + 1;
  }
}
