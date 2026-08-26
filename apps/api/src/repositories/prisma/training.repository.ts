import type { PrismaClient, TrainingSample as PrismaTrainingSample } from "@prisma/client";
import type { Split, TrainingSample, TrainingSampleBox } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { TrainingRepository } from "../types.js";

/**
 * Prisma-backed TrainingRepository.
 *
 * `upsertApproval` runs in a TRANSACTION as a delete-then-create, not a Prisma
 * `upsert`. An `upsert` keyed on `imageAssetId` would keep the EXISTING row's `id` on
 * the update path — but the caller mints a fresh id per approval and the JSON adapter
 * genuinely replaces the row (see its doc comment), so keeping the old id here would
 * be an adapter-only behaviour difference the contract tests are supposed to catch.
 */

function toRecord(row: PrismaTrainingSample): TrainingSample {
  return {
    id: row.id,
    projectId: row.projectId,
    imageAssetId: row.imageAssetId,
    storageKey: row.storageKey,
    approved: row.approved,
    approvedAt: row.approvedAt.toISOString(),
    datasetSplit: row.datasetSplit as Split,
    boxes: row.boxes as unknown as TrainingSampleBox[],
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaTrainingRepository implements TrainingRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findByAsset(assetId: string): Promise<TrainingSample | null> {
    const row = await this.prisma.trainingSample.findUnique({ where: { imageAssetId: assetId } });
    return row ? toRecord(row) : null;
  }

  async upsertApproval(
    sample: TrainingSample
  ): Promise<{ sample: TrainingSample; replacedPrevious: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.trainingSample.findUnique({
        where: { imageAssetId: sample.imageAssetId },
      });
      if (existing) await tx.trainingSample.delete({ where: { id: existing.id } });

      const row = await tx.trainingSample.create({
        data: {
          id: sample.id,
          projectId: sample.projectId,
          imageAssetId: sample.imageAssetId,
          storageKey: sample.storageKey,
          approved: sample.approved,
          approvedAt: new Date(sample.approvedAt),
          datasetSplit: sample.datasetSplit,
          boxes: sample.boxes as unknown as object,
          imageWidth: sample.imageWidth,
          imageHeight: sample.imageHeight,
          createdAt: new Date(sample.createdAt),
        },
      });

      return { sample: toRecord(row), replacedPrevious: existing !== null };
    });
  }

  async listAll(): Promise<TrainingSample[]> {
    const rows = await this.prisma.trainingSample.findMany();
    return rows.map(toRecord);
  }
}
