import fs from "node:fs";
import path from "node:path";
import type { DetectionStatus, PageBoundary, ProjectAsset } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import type { ErrorCode } from "../../middleware/apiError.js";
import { isRetryable } from "../../middleware/apiError.js";
import { markCompleted, markFailed, markProcessing } from "../jobs/jobs.service.js";
import { toPageBoundary } from "../boundaries/boundaries.service.js";
import { shouldAccept, DEFAULT_OVERLAP_THRESHOLD } from "@sketch2ui/shared-types";
import { getRepositories } from "../../repositories/index.js";

// The detect job — plan sections 7.4 (job API), 27 (queue semantics), 51 step 9.
//
// Runs IN-PROCESS rather than through Redis/BullMQ. The external contract is the plan's
// (create job -> poll -> read detections); only the execution substrate is lighter, the
// same tradeoff already made by using a JSON store instead of the section 8 Postgres
// schema. Swapping this function body for a queue producer later changes nothing the
// client can observe.

interface WorkerDetection {
  className: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  modelVersionId: string;
  /** Section 10.4: "rejected" when the box falls outside the page boundary. */
  status?: DetectionStatus;
  insideFraction?: number | null;
}

interface WorkerResponse {
  detections: WorkerDetection[];
  modelVersionId: string;
  pageBoundary?: PageBoundary;
  rejectedCount?: number;
}

interface WorkerErrorBody {
  error?: { code?: string; message?: string; retryable?: boolean };
}

/** Map a worker error code onto ours, defaulting to a retryable inference failure. */
function toApiErrorCode(workerCode: string | undefined): ErrorCode {
  switch (workerCode) {
    case "INVALID_IMAGE":
      return "INVALID_IMAGE";
    case "MODEL_UNAVAILABLE":
      return "MODEL_UNAVAILABLE";
    case "INFERENCE_FAILED":
      return "INFERENCE_FAILED";
    default:
      return "INFERENCE_FAILED";
  }
}

/**
 * Execute a detection job. Never throws — every failure path marks the job failed with a
 * section 7.6 error code and the section 27.4 retryable classification, so a caller that
 * fired this without awaiting cannot produce an unhandled rejection.
 */
export async function runDetectJob(jobId: string, asset: ProjectAsset): Promise<void> {
  try {
    await markProcessing(jobId, "preprocessing", 10);

    const imagePath = path.join(env.uploadsDir, asset.storageKey);
    if (!fs.existsSync(imagePath)) {
      await markFailed(
        jobId,
        "INVALID_IMAGE",
        "The source image is missing from storage.",
        isRetryable("INVALID_IMAGE")
      );
      return;
    }

    await markProcessing(jobId, "component_detection", 30);

    const form = new FormData();
    form.append(
      "file",
      new Blob([fs.readFileSync(imagePath)], { type: asset.mimeType }),
      asset.storageKey
    );

    let response: Response;
    try {
      response = await fetch(`${env.cvWorkerUrl}/detect`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(env.cvWorkerTimeoutMs),
      });
    } catch (cause) {
      // Connection refused / DNS / timeout — the worker is down or slow, which is
      // exactly the transient class section 27.4 says to retry.
      const reason = cause instanceof Error ? cause.message : "unknown error";
      await markFailed(
        jobId,
        "WORKER_UNREACHABLE",
        `Could not reach the detection service (${reason}).`,
        isRetryable("WORKER_UNREACHABLE")
      );
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as WorkerErrorBody;
      const code = toApiErrorCode(body.error?.code);
      await markFailed(
        jobId,
        code,
        body.error?.message ?? `The detection service returned ${response.status}.`,
        body.error?.retryable ?? isRetryable(code)
      );
      return;
    }

    const result = (await response.json()) as WorkerResponse;

    await markProcessing(jobId, "persisting_detections", 80);

    // Persist the auto-detected boundary — but the sticky-correction rule means a
    // MANUAL adjustment wins. `effective` is whatever is actually in force afterwards.
    let effective = result.pageBoundary;
    let preservedManual = false;
    if (result.pageBoundary) {
      const saved = await getRepositories().boundaries.saveRespectingManual(
        asset.projectId,
        asset.id,
        result.pageBoundary,
        "auto"
      );
      effective = toPageBoundary(saved.record);
      preservedManual = saved.preservedManual;
    }

    // Section 27.5 (idempotency): drop this asset's previous MODEL detections so a
    // re-run replaces rather than duplicates them. Manual boxes are left alone.
    await getRepositories().detections.clearModelDetections(asset.projectId, asset.id);

    // Persisted through the same repository the manual annotation route uses, so these
    // are indistinguishable from hand-drawn records apart from `source` and `modelVersionId`.
    const created = await getRepositories().detections.createMany(
      result.detections.map((d) => ({
        projectId: asset.projectId,
        sourceAssetId: asset.id,
        className: d.className,
        bbox: d.bbox,
        source: "model" as const,
        confidence: d.confidence,
        modelVersionId: d.modelVersionId ?? result.modelVersionId,
        // Section 10.7: persist rejected boxes rather than dropping them, so an
        // external note stays visible and reappears if the user moves the boundary.
        //
        // When a manual boundary is in force, the worker's own accept/reject verdict
        // was computed against the AUTO polygon and is wrong — re-derive it here
        // against the boundary the user actually chose.
        status: preservedManual && effective?.applied
          ? shouldAccept(d.bbox, effective.polygon, effective.overlapThreshold ?? DEFAULT_OVERLAP_THRESHOLD).accepted
            ? "active"
            : "rejected"
          : d.status ?? "active",
      }))
    );

    await markCompleted(jobId, {
      detectionCount: created.length,
      modelVersionId: result.modelVersionId,
      pageBoundary: effective,
      rejectedCount: created.filter((d) => d.status === "rejected").length,
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "unknown error";
    await markFailed(jobId, "INTERNAL", `Detection job failed: ${reason}`, true);
  }
}
