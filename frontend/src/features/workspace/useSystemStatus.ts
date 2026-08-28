import { useEffect, useState } from "react";
import { api } from "../../services/api.js";
import type { SystemStatus } from "../../services/api.js";

// Backs both the header's "AI Model" pill and the footer's "AI Service"/"CV Worker"
// segments — one poll, two presentational consumers, so they can never disagree with
// each other for a tick the way two independent polls could.
//
// "AI Service" (the backend API itself) is inferred from whether this call succeeds at
// all, not a separate ping — if the browser can't even get a response, the API is the
// thing that's actually unreachable from here, cv-service's own status notwithstanding.

const POLL_INTERVAL_MS = 20_000;

export interface UseSystemStatusResult {
  status: SystemStatus | null;
  /** False once a poll has failed outright (network error, not just a "degraded" body). */
  apiReachable: boolean;
}

export function useSystemStatus(): UseSystemStatusResult {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [apiReachable, setApiReachable] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const next = await api.systemStatus();
        if (cancelled) return;
        setStatus(next);
        setApiReachable(true);
      } catch {
        if (cancelled) return;
        setApiReachable(false);
      }
    }

    void poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return { status, apiReachable };
}
