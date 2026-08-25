import type { Job, JobStage, JobType, PageBoundary } from "@sketch2ui/shared-types";
import { getRepositories } from "../../repositories/index.js";

// Thin domain helpers over JobRepository — each computes the patch shape for one job
// state transition so call sites (detect.job.ts) don't construct raw patch objects
// inline. Persistence itself lives entirely in the repository (Phase 8 amendment).

export function createJob(input: {
  projectId: string;
  type: JobType;
  sourceAssetId?: string;
}): Promise<Job> {
  return getRepositories().jobs.create(input);
}

export function getJob(jobId: string): Promise<Job | null> {
  return getRepositories().jobs.findById(jobId);
}

export async function markProcessing(jobId: string, stage: JobStage, progress: number): Promise<void> {
  await getRepositories().jobs.update(jobId, { status: "processing", stage, progress });
}

export async function markCompleted(
  jobId: string,
  extra: {
    detectionCount?: number;
    modelVersionId?: string;
    pageBoundary?: PageBoundary;
    rejectedCount?: number;
  } = {}
): Promise<void> {
  await getRepositories().jobs.update(jobId, {
    status: "completed",
    stage: "completed",
    progress: 100,
    ...extra,
  });
}

export async function markFailed(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  retryable: boolean
): Promise<void> {
  await getRepositories().jobs.update(jobId, {
    status: "failed",
    stage: "failed",
    errorCode,
    errorMessage,
    retryable,
  });
}

/**
 * Jobs a stale process left mid-flight. In-process execution means a restart abandons
 * anything that was running, and a client polling such a job would otherwise wait
 * forever on "processing".
 */
export function failOrphanedJobs(): Promise<number> {
  return getRepositories().jobs.failOrphaned();
}
