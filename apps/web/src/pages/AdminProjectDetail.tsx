import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AdminProjectDetail as AdminProjectDetailData } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S8 — Admin Project detail. The one piece a flat project list can't show:
// "inspect associated jobs" (brief Phase 10). A lightweight, per-project job list —
// the full cross-project job monitoring table (Job ID/Project/User/Operation/Status/
// Started/Completed/Error, brief Phase 11) is Admin Jobs' own later phase.

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const JOB_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "error"> = {
  queued: "neutral",
  processing: "info",
  completed: "success",
  failed: "error",
};

export default function AdminProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AdminProjectDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .adminGetProject(id)
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <Link to="/admin/projects" className="text-sm text-text-muted transition-colors duration-fast hover:text-text-secondary">
          ← Projects
        </Link>

        {loading ? (
          <p className="mt-lg text-sm text-text-muted">Loading…</p>
        ) : error ? (
          <div className="mt-lg">
            <ErrorState
              message={error}
              action={
                <Button variant="secondary" onClick={load}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : data ? (
          <>
            <div className="mt-sm flex items-center gap-sm">
              <h1 className="text-xl font-semibold text-text-primary">{data.name}</h1>
              <Badge tone="neutral">{data.status}</Badge>
            </div>

            <Card className="mt-lg grid grid-cols-2 gap-lg sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Owner</p>
                <p className="mt-2xs text-sm text-text-primary">{data.ownerEmail}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Created</p>
                <p className="mt-2xs text-sm text-text-primary">{formatDateTime(data.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Last updated</p>
                <p className="mt-2xs text-sm text-text-primary">{formatDateTime(data.updatedAt)}</p>
              </div>
            </Card>

            <h2 className="mt-2xl text-lg font-semibold text-text-primary">Jobs</h2>
            {data.jobs.length === 0 ? (
              <p className="mt-sm text-sm text-text-muted">No jobs have run for this project yet.</p>
            ) : (
              <Card className="mt-sm overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                      <th className="px-lg py-sm font-medium">Type</th>
                      <th className="px-lg py-sm font-medium">Status</th>
                      <th className="px-lg py-sm font-medium">Stage</th>
                      <th className="px-lg py-sm font-medium">Created</th>
                      <th className="px-lg py-sm font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((j) => (
                      <tr key={j.id} className="border-b border-border last:border-0">
                        <td className="px-lg py-sm text-text-primary">{j.type}</td>
                        <td className="px-lg py-sm">
                          <Badge tone={JOB_STATUS_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
                        </td>
                        <td className="px-lg py-sm text-text-secondary">{j.stage}</td>
                        <td className="px-lg py-sm text-text-secondary">{formatDateTime(j.createdAt)}</td>
                        <td className="px-lg py-sm text-error">{j.errorMessage ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
