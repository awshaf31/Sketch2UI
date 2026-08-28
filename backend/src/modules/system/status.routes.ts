import { Router } from "express";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

export const systemRouter = Router();

// GET /api/system/status — workspace redesign gap-closing pass, footer status bar.
// A short liveness probe against cv-service's own /health (main.py), separate from the
// real /detect call's much longer env.cvWorkerTimeoutMs — this only needs to answer
// "is it up" for a status pill, not survive a real inference.
const HEALTH_CHECK_TIMEOUT_MS = 3_000;

interface CvWorkerHealth {
  status: string;
  modelVersionId: string | null;
  modelLoaded: boolean;
}

systemRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    let cvWorker: "connected" | "degraded" | "unreachable" = "unreachable";
    let modelVersionId: string | null = null;

    try {
      const response = await fetch(`${env.cvWorkerUrl}/health`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json()) as CvWorkerHealth;
        cvWorker = body.modelLoaded ? "connected" : "degraded";
        modelVersionId = body.modelVersionId ?? null;
      }
    } catch {
      // Connection refused / DNS / timeout — stays "unreachable".
    }

    res.json({ cvWorker, modelVersionId });
  })
);
