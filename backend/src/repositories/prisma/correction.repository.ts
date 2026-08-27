import { v4 as uuid } from "uuid";
import type { PrismaClient, CorrectionRecord as PrismaCorrectionRecord } from "@prisma/client";
import type { BBox, CorrectionRecord, CorrectionType } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CorrectionRepository } from "../types.js";

/**
 * Prisma-backed CorrectionRepository.
 *
 * Two flattening tricks, both mirrored from other adapters in this migration:
 *   - bbox IS FLATTENED into 8 float columns (old/new × x/y/width/height), same as
 *     Detection's bbox.
 *   - parentDetectionId IS THREE-STATE (a detection id / explicit root `null` /
 *     "no override at that point" `undefined`), same problem StructureOverride
 *     solves — a `*Set` boolean per side carries the distinction a nullable column
 *     alone cannot.
 */

function toBBox(x: number | null, y: number | null, width: number | null, height: number | null): BBox | undefined {
  if (x === null || y === null || width === null || height === null) return undefined;
  return { x, y, width, height };
}

function toRecord(row: PrismaCorrectionRecord): CorrectionRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    detectionId: row.detectionId,
    type: row.type as CorrectionType,
    source: "user",
    timestamp: row.timestamp.toISOString(),
    ...(row.reason === null ? {} : { reason: row.reason }),
    ...(row.oldClassName === null ? {} : { oldClassName: row.oldClassName }),
    ...(row.newClassName === null ? {} : { newClassName: row.newClassName }),
    ...((() => {
      const b = toBBox(row.oldBBoxX, row.oldBBoxY, row.oldBBoxWidth, row.oldBBoxHeight);
      return b ? { oldBBox: b } : {};
    })()),
    ...((() => {
      const b = toBBox(row.newBBoxX, row.newBBoxY, row.newBBoxWidth, row.newBBoxHeight);
      return b ? { newBBox: b } : {};
    })()),
    ...(row.oldParentDetectionIdSet ? { oldParentDetectionId: row.oldParentDetectionId } : {}),
    ...(row.newParentDetectionIdSet ? { newParentDetectionId: row.newParentDetectionId } : {}),
    ...(row.oldDisplayOrder === null ? {} : { oldDisplayOrder: row.oldDisplayOrder }),
    ...(row.newDisplayOrder === null ? {} : { newDisplayOrder: row.newDisplayOrder }),
  };
}

export class PrismaCorrectionRepository implements CorrectionRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async list(projectId: string, detectionId?: string): Promise<CorrectionRecord[]> {
    const rows = await this.prisma.correctionRecord.findMany({
      where: { projectId, ...(detectionId ? { detectionId } : {}) },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listByPage(pageId: string, detectionId?: string): Promise<CorrectionRecord[]> {
    const rows = await this.prisma.correctionRecord.findMany({
      where: { pageId, ...(detectionId ? { detectionId } : {}) },
      orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async append(
    record: Omit<CorrectionRecord, "id" | "timestamp" | "source">
  ): Promise<CorrectionRecord> {
    const row = await this.prisma.correctionRecord.create({
      data: {
        id: uuid(),
        projectId: record.projectId,
        pageId: record.pageId,
        detectionId: record.detectionId,
        type: record.type,
        timestamp: new Date(),
        reason: record.reason ?? null,
        oldClassName: record.oldClassName ?? null,
        newClassName: record.newClassName ?? null,
        oldBBoxX: record.oldBBox?.x ?? null,
        oldBBoxY: record.oldBBox?.y ?? null,
        oldBBoxWidth: record.oldBBox?.width ?? null,
        oldBBoxHeight: record.oldBBox?.height ?? null,
        newBBoxX: record.newBBox?.x ?? null,
        newBBoxY: record.newBBox?.y ?? null,
        newBBoxWidth: record.newBBox?.width ?? null,
        newBBoxHeight: record.newBBox?.height ?? null,
        oldParentDetectionId: record.oldParentDetectionId ?? null,
        oldParentDetectionIdSet: record.oldParentDetectionId !== undefined,
        newParentDetectionId: record.newParentDetectionId ?? null,
        newParentDetectionIdSet: record.newParentDetectionId !== undefined,
        oldDisplayOrder: record.oldDisplayOrder ?? null,
        newDisplayOrder: record.newDisplayOrder ?? null,
      },
    });
    return toRecord(row);
  }
}
