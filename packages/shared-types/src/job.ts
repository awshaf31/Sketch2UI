// Background job contract — plan section 42 ("Job") and section 7.4 (job API shape).
//
// The transport contract is the plan's: create a job, poll it, read the result. The
// implementation behind it is currently in-process rather than Redis/BullMQ (section 27),
// matching how this project runs on a JSON store rather than the section 8 Postgres
// schema — same external contract, lighter internals, swappable later.

import type { PageBoundary } from "./page-boundary.js";

export type JobType = "detect" | "layout" | "codegen" | "export";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

/** Stage names come from the section 7.5 progress vocabulary. */
export type JobStage =
  | "queued"
  | "preprocessing"
  | "component_detection"
  | "persisting_detections"
  | "completed"
  | "failed";

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  status: JobStatus;
  stage: JobStage;
  progress: number; // 0-100
  /** The page this job ran against, mirroring sourceAssetId's optionality — a
   * detect/codegen job is page-scoped, a hypothetical whole-project export job
   * would not be. */
  pageId?: string;
  /** The asset this job ran against — detect jobs are per-asset. */
  sourceAssetId?: string;
  /** Set when status === "failed". Codes match the section 7.6 error model. */
  errorCode?: string;
  errorMessage?: string;
  /** Section 27.4: whether a queue would be right to retry this failure. */
  retryable?: boolean;
  /** Populated on completion so the client knows what changed. */
  detectionCount?: number;
  modelVersionId?: string;
  /** Section 10: the page boundary this run found, and how many boxes it rejected.
   *  Additive — callers predating step 10 simply ignore these. */
  pageBoundary?: PageBoundary;
  rejectedCount?: number;
  createdAt: string;
  updatedAt: string;
}
