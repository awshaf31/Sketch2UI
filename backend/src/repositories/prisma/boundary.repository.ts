import { v4 as uuid } from "uuid";
import type { PrismaClient, PageBoundaryRecord as PrismaBoundary } from "@prisma/client";
import type {
  PageBoundary,
  PageBoundaryMethod,
  PageBoundaryRecord,
  PageBoundarySource,
  PagePolygon,
} from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { BoundaryRepository } from "../types.js";

/**
 * Prisma-backed BoundaryRepository.
 *
 * `saveRespectingManual` RUNS IN A TRANSACTION for the same reason Detection's
 * `update` does: it reads the existing row, decides whether the sticky-correction rule
 * applies, and writes — and the decision depends on the value it just read. Outside a
 * transaction two concurrent auto-writes racing a manual write could both observe "no
 * manual record yet" and both proceed, which is exactly the clobber this rule exists to
 * prevent. The JSON adapter is immune only because Node is single-threaded and that
 * code path never awaits.
 */

function toRecord(row: PrismaBoundary): PageBoundaryRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    assetId: row.assetId,
    polygon: row.polygon as PagePolygon,
    confidence: row.confidence,
    method: row.method as PageBoundaryMethod,
    areaFraction: row.areaFraction,
    applied: row.applied,
    ...(row.overlapThreshold === null ? {} : { overlapThreshold: row.overlapThreshold }),
    source: row.source as PageBoundarySource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaBoundaryRepository implements BoundaryRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findByAsset(assetId: string): Promise<PageBoundaryRecord | null> {
    const row = await this.prisma.pageBoundaryRecord.findUnique({ where: { assetId } });
    return row ? toRecord(row) : null;
  }

  async saveRespectingManual(
    projectId: string,
    pageId: string,
    assetId: string,
    boundary: PageBoundary,
    source: PageBoundarySource
  ): Promise<{ record: PageBoundaryRecord; preservedManual: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pageBoundaryRecord.findUnique({ where: { assetId } });

      if (source === "auto" && existing?.source === "manual") {
        return { record: toRecord(existing), preservedManual: true };
      }

      const data = {
        polygon: boundary.polygon,
        confidence: boundary.confidence,
        method: boundary.method,
        areaFraction: boundary.areaFraction,
        applied: boundary.applied,
        overlapThreshold: boundary.overlapThreshold ?? null,
        source,
      };

      const row = existing
        ? await tx.pageBoundaryRecord.update({ where: { assetId }, data })
        : await tx.pageBoundaryRecord.create({
            data: { id: uuid(), projectId, pageId, assetId, ...data },
          });

      return { record: toRecord(row), preservedManual: false };
    });
  }
}
