import { v4 as uuid } from "uuid";
import type { Job, JobStage, JobStatus, JobType, PageBoundary } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";

// Job records live in the same JSON store as everything else (plan section 8's tables,
// implemented as a file for now). Jobs are persisted rather than kept in memory so a
// client polling across an API restart gets a coherent answer instead of a 404.

export function createJob(input: {
  projectId: string;
  type: JobType;
  sourceAssetId?: string;
}): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: uuid(),
    projectId: input.projectId,
    type: input.type,
    status: "queued",
    stage: "queued",
    progress: 0,
    ...(input.sourceAssetId ? { sourceAssetId: input.sourceAssetId } : {}),
    createdAt: now,
    updatedAt: now,
  };
  db.state.jobs.push(job);
  db.save();
  return job;
}

export function getJob(jobId: string): Job | undefined {
  return db.state.jobs.find((j) => j.id === jobId);
}

export function updateJob(jobId: string, patch: Partial<Omit<Job, "id" | "createdAt">>): Job | undefined {
  const job = getJob(jobId);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  db.save();
  return job;
}

export function markProcessing(jobId: string, stage: JobStage, progress: number): void {
  updateJob(jobId, { status: "processing" satisfies JobStatus, stage, progress });
}

export function markCompleted(
  jobId: string,
  extra: {
    detectionCount?: number;
    modelVersionId?: string;
    pageBoundary?: PageBoundary;
    rejectedCount?: number;
  } = {}
): void {
  updateJob(jobId, {
    status: "completed",
    stage: "completed",
    progress: 100,
    ...extra,
  });
}

export function markFailed(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  retryable: boolean
): void {
  updateJob(jobId, {
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
export function failOrphanedJobs(): number {
  const orphans = db.state.jobs.filter(
    (j) => j.status === "queued" || j.status === "processing"
  );
  for (const job of orphans) {
    Object.assign(job, {
      status: "failed" as JobStatus,
      stage: "failed" as JobStage,
      errorCode: "INTERNAL",
      errorMessage: "The API restarted while this job was running. Start a new one.",
      retryable: true,
      updatedAt: new Date().toISOString(),
    });
  }
  if (orphans.length > 0) db.save();
  return orphans.length;
}
