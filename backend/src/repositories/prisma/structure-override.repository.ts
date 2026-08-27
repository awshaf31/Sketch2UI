import type { PrismaClient, StructureOverride as PrismaStructureOverride } from "@prisma/client";
import type { StructureOverride } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { StructureOverrideRepository } from "../types.js";

/**
 * Prisma-backed StructureOverrideRepository.
 *
 * `parentDetectionId` is a three-state field (a detection id / explicit root `null` /
 * "not touched" `undefined`) but a nullable Postgres column only has two states. The
 * schema's `parentDetectionIdSet` boolean is the third state: `false` means "not
 * touched" regardless of what `parentDetectionId` holds underneath (always null in
 * that case). See schema.prisma's comment on the column.
 */

function toValue(row: PrismaStructureOverride): StructureOverride {
  return {
    ...(row.parentDetectionIdSet ? { parentDetectionId: row.parentDetectionId } : {}),
    ...(row.displayOrder === null ? {} : { displayOrder: row.displayOrder }),
  };
}

function isEmpty(value: StructureOverride): boolean {
  return value.parentDetectionId === undefined && value.displayOrder === undefined;
}

export class PrismaStructureOverrideRepository implements StructureOverrideRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async mapForProject(projectId: string): Promise<Record<string, StructureOverride>> {
    const rows = await this.prisma.structureOverride.findMany({ where: { projectId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async mapForPage(pageId: string): Promise<Record<string, StructureOverride>> {
    const rows = await this.prisma.structureOverride.findMany({ where: { pageId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async findByDetection(projectId: string, detectionId: string): Promise<StructureOverride | null> {
    const row = await this.prisma.structureOverride.findFirst({ where: { detectionId, projectId } });
    return row ? toValue(row) : null;
  }

  async put(
    projectId: string,
    pageId: string,
    detectionId: string,
    value: StructureOverride
  ): Promise<StructureOverride | null> {
    if (isEmpty(value)) {
      await this.prisma.structureOverride.deleteMany({ where: { detectionId, projectId } });
      return null;
    }
    const data = {
      parentDetectionId: value.parentDetectionId ?? null,
      parentDetectionIdSet: value.parentDetectionId !== undefined,
      displayOrder: value.displayOrder ?? null,
    };
    const row = await this.prisma.structureOverride.upsert({
      where: { detectionId },
      create: { projectId, pageId, detectionId, ...data },
      update: data,
    });
    return toValue(row);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    await this.prisma.structureOverride.deleteMany({ where: { detectionId, projectId } });
  }
}
