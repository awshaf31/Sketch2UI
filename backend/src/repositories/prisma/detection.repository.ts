import { v4 as uuid } from "uuid";
import type { PrismaClient, Detection as PrismaDetection } from "@prisma/client";
import type { Detection, DetectionSource, DetectionStatus } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type {
  CreateDetectionInput,
  DetectionRepository,
  DetectionUpdateResult,
  UpdateDetectionInput,
} from "../types.js";

/**
 * Prisma-backed DetectionRepository.
 *
 * Two things need care here beyond the usual Date/null mapping:
 *
 *   1. BBOX IS FLATTENED in the schema (bboxX/Y/Width/Height as separate Float columns
 *      — see schema.prisma for why), so it is reassembled on read and split on write.
 *
 *   2. `update` RUNS IN A TRANSACTION. It has to read the row, decide whether the
 *      model→manual flip applies, and write — and the decision depends on the value it
 *      just read. Outside a transaction two concurrent corrections could both observe
 *      `source: "model"`, and the second would overwrite `originalClassName` with the
 *      first one's corrected class, destroying the record of what the model actually
 *      proposed. The JSON adapter is immune only because Node is single-threaded and
 *      that code path never awaits; Postgres has no such accident to rely on.
 */

function toRecord(row: PrismaDetection): Detection {
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    sourceAssetId: row.sourceAssetId,
    className: row.className,
    confidence: row.confidence,
    bbox: { x: row.bboxX, y: row.bboxY, width: row.bboxWidth, height: row.bboxHeight },
    status: row.status as DetectionStatus,
    source: row.source as DetectionSource,
    ...(row.modelVersionId === null ? {} : { modelVersionId: row.modelVersionId }),
    ...(row.originalClassName === null ? {} : { originalClassName: row.originalClassName }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCreateData(input: CreateDetectionInput) {
  return {
    id: uuid(),
    projectId: input.projectId,
    pageId: input.pageId,
    sourceAssetId: input.sourceAssetId,
    className: input.className,
    confidence: input.confidence ?? 1,
    bboxX: input.bbox.x,
    bboxY: input.bbox.y,
    bboxWidth: input.bbox.width,
    bboxHeight: input.bbox.height,
    status: (input.status ?? "active") as DetectionStatus,
    source: input.source,
    modelVersionId: input.modelVersionId ?? null,
  };
}

function bboxEquals(a: Detection["bbox"], b: Detection["bbox"]): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export class PrismaDetectionRepository implements DetectionRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async listByProject(projectId: string): Promise<Detection[]> {
    const rows = await this.prisma.detection.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listByPage(pageId: string): Promise<Detection[]> {
    const rows = await this.prisma.detection.findMany({
      where: { pageId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listActiveByProject(projectId: string): Promise<Detection[]> {
    const rows = await this.prisma.detection.findMany({
      where: { projectId, status: "active" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listActiveByPage(pageId: string): Promise<Detection[]> {
    const rows = await this.prisma.detection.findMany({
      where: { pageId, status: "active" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async listActiveByAsset(assetId: string): Promise<Detection[]> {
    const rows = await this.prisma.detection.findMany({
      where: { sourceAssetId: assetId, status: "active" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toRecord);
  }

  async findById(id: string): Promise<Detection | null> {
    const row = await this.prisma.detection.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findInProject(projectId: string, id: string): Promise<Detection | null> {
    const row = await this.prisma.detection.findFirst({ where: { id, projectId } });
    return row ? toRecord(row) : null;
  }

  async findInPage(pageId: string, id: string): Promise<Detection | null> {
    const row = await this.prisma.detection.findFirst({ where: { id, pageId } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateDetectionInput): Promise<Detection> {
    const row = await this.prisma.detection.create({ data: toCreateData(input) });
    return toRecord(row);
  }

  async createMany(inputs: CreateDetectionInput[]): Promise<Detection[]> {
    if (inputs.length === 0) return [];
    const data = inputs.map(toCreateData);
    // createMany does not return rows, so the ids are minted up front and the created
    // rows read back — callers (the detect job) need the persisted records.
    await this.prisma.detection.createMany({ data });
    const rows = await this.prisma.detection.findMany({
      where: { id: { in: data.map((d) => d.id) } },
    });
    // Preserve input order; findMany's order is not guaranteed to match `in`.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return data.map((d) => toRecord(byId.get(d.id)!));
  }

  async update(
    projectId: string,
    id: string,
    patch: UpdateDetectionInput
  ): Promise<DetectionUpdateResult | null> {
    return this.applyUpdate({ id, projectId }, patch);
  }

  async updateInPage(
    pageId: string,
    id: string,
    patch: UpdateDetectionInput
  ): Promise<DetectionUpdateResult | null> {
    return this.applyUpdate({ id, pageId }, patch);
  }

  private applyUpdate(
    where: { id: string; projectId?: string; pageId?: string },
    patch: UpdateDetectionInput
  ): Promise<DetectionUpdateResult | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.detection.findFirst({ where });
      if (!existing) return null;

      const previous = toRecord(existing);

      const classChanged =
        patch.className !== undefined && patch.className !== previous.className;
      const bboxChanged = patch.bbox !== undefined && !bboxEquals(patch.bbox, previous.bbox);

      const flip = previous.source === "model" && (classChanged || bboxChanged);
      const captureOriginal =
        flip && classChanged && previous.originalClassName === undefined;

      const row = await tx.detection.update({
        where: { id: existing.id },
        data: {
          className: patch.className,
          ...(patch.bbox
            ? {
                bboxX: patch.bbox.x,
                bboxY: patch.bbox.y,
                bboxWidth: patch.bbox.width,
                bboxHeight: patch.bbox.height,
              }
            : {}),
          status: patch.status,
          // The model→manual flip. Only these two fields change, and only under the
          // conditions above — modelVersionId is deliberately preserved for provenance.
          ...(flip ? { source: "manual" as const, confidence: 1 } : {}),
          ...(captureOriginal ? { originalClassName: previous.className } : {}),
        },
      });

      return { detection: toRecord(row), previous, classChanged, bboxChanged };
    });
  }

  async delete(projectId: string, id: string): Promise<Detection | null> {
    return this.removeMatching({ id, projectId });
  }

  async deleteInPage(pageId: string, id: string): Promise<Detection | null> {
    return this.removeMatching({ id, pageId });
  }

  private removeMatching(where: { id: string; projectId?: string; pageId?: string }): Promise<Detection | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.detection.findFirst({ where });
      if (!existing) return null;
      await tx.detection.delete({ where: { id: existing.id } });
      return toRecord(existing);
    });
  }

  async clearModelDetections(projectId: string, sourceAssetId: string): Promise<number> {
    // Manual detections are never touched — including a corrected box that was flipped
    // from model to manual, which is the whole point of the flip.
    const result = await this.prisma.detection.deleteMany({
      where: { projectId, sourceAssetId, source: "model" },
    });
    return result.count;
  }
}
