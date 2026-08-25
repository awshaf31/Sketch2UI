import { v4 as uuid } from "uuid";
import type { Prisma, PrismaClient, Job as PrismaJob } from "@prisma/client";
import type { Job, JobStage, JobStatus, JobType, PageBoundary } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreateJobInput, JobRepository } from "../types.js";

/** Prisma-backed JobRepository. `failOrphaned` is a single `updateMany`, atomic by
 * construction — no read-then-write race the JSON adapter's loop has to worry about. */

function toRecord(row: PrismaJob): Job {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as JobType,
    status: row.status as JobStatus,
    stage: row.stage as JobStage,
    progress: row.progress,
    ...(row.pageId === null ? {} : { pageId: row.pageId }),
    ...(row.sourceAssetId === null ? {} : { sourceAssetId: row.sourceAssetId }),
    ...(row.errorCode === null ? {} : { errorCode: row.errorCode }),
    ...(row.errorMessage === null ? {} : { errorMessage: row.errorMessage }),
    ...(row.retryable === null ? {} : { retryable: row.retryable }),
    ...(row.detectionCount === null ? {} : { detectionCount: row.detectionCount }),
    ...(row.modelVersionId === null ? {} : { modelVersionId: row.modelVersionId }),
    ...(row.pageBoundary === null ? {} : { pageBoundary: row.pageBoundary as unknown as PageBoundary }),
    ...(row.rejectedCount === null ? {} : { rejectedCount: row.rejectedCount }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findById(id: string): Promise<Job | null> {
    const row = await this.prisma.job.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateJobInput): Promise<Job> {
    const row = await this.prisma.job.create({
      data: {
        id: uuid(),
        projectId: input.projectId,
        pageId: input.pageId ?? null,
        type: input.type,
        status: "queued",
        stage: "queued",
        progress: 0,
        sourceAssetId: input.sourceAssetId ?? null,
      },
    });
    return toRecord(row);
  }

  async update(id: string, patch: Partial<Omit<Job, "id" | "createdAt">>): Promise<Job | null> {
    // updateMany, not update: the contract is a silent no-op for a missing job, and
    // `update` would throw P2025 instead — same reasoning as ProjectRepository.
    const data: Prisma.JobUncheckedUpdateManyInput = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
      ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
      ...(patch.sourceAssetId !== undefined ? { sourceAssetId: patch.sourceAssetId } : {}),
      ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
      ...(patch.errorMessage !== undefined ? { errorMessage: patch.errorMessage } : {}),
      ...(patch.retryable !== undefined ? { retryable: patch.retryable } : {}),
      ...(patch.detectionCount !== undefined ? { detectionCount: patch.detectionCount } : {}),
      ...(patch.modelVersionId !== undefined ? { modelVersionId: patch.modelVersionId } : {}),
      ...(patch.pageBoundary !== undefined
        ? { pageBoundary: patch.pageBoundary as unknown as Prisma.InputJsonValue }
        : {}),
      ...(patch.rejectedCount !== undefined ? { rejectedCount: patch.rejectedCount } : {}),
    };

    const result = await this.prisma.job.updateMany({ where: { id }, data });
    if (result.count === 0) return null;
    return this.findById(id);
  }

  async failOrphaned(): Promise<number> {
    const result = await this.prisma.job.updateMany({
      where: { status: { in: ["queued", "processing"] } },
      data: {
        status: "failed",
        stage: "failed",
        errorCode: "INTERNAL",
        errorMessage: "The API restarted while this job was running. Start a new one.",
        retryable: true,
      },
    });
    return result.count;
  }
}
