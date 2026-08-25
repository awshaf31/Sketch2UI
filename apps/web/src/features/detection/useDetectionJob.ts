import { useCallback, useEffect, useRef, useState } from "react";
import type { Job } from "@sketch2ui/shared-types";
import { api } from "../../services/api.js";

// Polls a detect job to completion — plan section 7.4 (polling is the MVP choice over
// WebSockets per section 7.5).

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 180_000;

export interface DetectionJobState {
  job: Job | null;
  running: boolean;
  error: string | null;
}

export function useDetectionJob(onCompleted: (job: Job) => void | Promise<void>) {
  const [job, setJob] = useState<Job | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  // Keep the latest callback without making it a polling dependency, so re-renders
  // don't restart an in-flight poll loop.
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);

  const start = useCallback(
    async (projectId: string, pageId: string, assetId: string) => {
      clearTimer();
      setError(null);
      setJob(null);
      setRunning(true);

      let jobId: string;
      try {
        ({ jobId } = await api.startDetection(projectId, pageId, assetId));
      } catch (e) {
        setRunning(false);
        setError((e as Error).message);
        return;
      }

      const startedAt = Date.now();

      const poll = async () => {
        if (cancelledRef.current) return;

        try {
          const next = await api.getJob(jobId);
          if (cancelledRef.current) return;
          setJob(next);

          if (next.status === "completed") {
            setRunning(false);
            await onCompletedRef.current(next);
            return;
          }
          if (next.status === "failed") {
            setRunning(false);
            setError(
              next.errorMessage ??
                `Detection failed${next.errorCode ? ` (${next.errorCode})` : ""}.`
            );
            return;
          }
        } catch (e) {
          if (cancelledRef.current) return;
          setRunning(false);
          setError((e as Error).message);
          return;
        }

        if (Date.now() - startedAt > MAX_POLL_MS) {
          setRunning(false);
          setError("Detection timed out. The worker may still be running — reload to check.");
          return;
        }
        timerRef.current = window.setTimeout(poll, POLL_INTERVAL_MS);
      };

      void poll();
    },
    [clearTimer]
  );

  return { job, running, error, start, dismissError: () => setError(null) };
}
