import { v4 as uuid } from "uuid";
import type { PrismaClient, ProjectAsset as PrismaAsset } from "@prisma/client";
import type { ProjectAsset } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { AssetRepository, CreateAssetInput } from "../types.js";

/**
 * Prisma-backed AssetRepository.
 *
 * Ordering: the JSON adapter returns insertion order, which callers rely on
 * (`exports.routes.ts` takes the last asset as a project's source sketch). Rows here
 * are ordered by `createdAt` ascending to reproduce that.
 *
 * Known parity edge: two assets created in the same millisecond have an undefined
 * relative order under Postgres, whereas the JSON array would preserve the true
 * insertion sequence. `id` is added as a tiebreaker so the result is at least
 * deterministic rather than arbitrary. In practice uploads are seconds apart — this is
 * documented rather than papered over, because pretending the two are bit-identical
 * would be the kind of claim this migration is supposed to avoid.
 */

function toRecord(row: PrismaAsset): ProjectAsset {
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    storageKey: row.storageKey,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    fileSize: row.fileSize,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaAssetRepository implements AssetRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listByProject(projectId: string): Promise<ProjectAsset[]> {
    const rows = await this.prisma.projectAsset.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<ProjectAsset | null> {
    const row = await this.prisma.projectAsset.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listByPage(pageId: string): Promise<ProjectAsset[]> {
    const rows = await this.prisma.projectAsset.findMany({
      where: { pageId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async findLatestForProject(projectId: string): Promise<ProjectAsset | null> {
    const row = await this.prisma.projectAsset.findFirst({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return row ? toRecord(row) : null;
  }

  async findLatestForPage(pageId: string): Promise<ProjectAsset | null> {
    const row = await this.prisma.projectAsset.findFirst({
      where: { pageId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateAssetInput): Promise<ProjectAsset> {
    const row = await this.prisma.projectAsset.create({
      data: {
        // uuid generated here, as with projects, so both adapters mint the same kind of
        // identifier and stored references stay valid across the migration.
        id: uuid(),
        projectId: input.projectId,
        pageId: input.pageId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        fileSize: input.fileSize,
      },
    });
    return toRecord(row);
  }
}
