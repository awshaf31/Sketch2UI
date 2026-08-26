import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminJobListEntry } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";
import { Select } from "../components/Select.js";

// SaaS phase S9 — Admin Job Monitoring (brief Phase 11). Cross-project, unlike
// AdminProjectDetail's own per-project job list. No "Started"/"Completed" columns —
// see admin.routes.ts's /jobs comment for why "Last updated" is the honest stand-in.

const STATUS_OPTIONS = ["", "queued", "processing", "completed", "failed"] as const;

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "error"> = {
  queued: "neutral",
  processing: "info",
  completed: "success",
  failed: "error",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<AdminJobListEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  function load(statusFilter: string) {
    setLoading(true);
    setError(null);
    api
      .adminListJobs({ status: statusFilter })
      .then(setJobs)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(status), [status]);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[1080px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Jobs</h1>
        <p className="mt-2xs text-sm text-text-secondary">Detection and codegen jobs across every project.</p>

        <div className="mt-lg">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[160px]">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "" ? "All statuses" : s}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="mt-xl text-sm text-text-muted">Loading…</p>
        ) : error ? (
          <div className="mt-xl">
            <ErrorState
              message={error}
              action={
                <Button variant="secondary" onClick={() => load(status)}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : jobs && jobs.length === 0 ? (
          <p className="mt-xl text-sm text-text-muted">No jobs match.</p>
        ) : jobs ? (
          <Card className="mt-lg overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-lg py-sm font-medium">Project</th>
                  <th className="px-lg py-sm font-medium">Owner</th>
                  <th className="px-lg py-sm font-medium">Operation</th>
                  <th className="px-lg py-sm font-medium">Status</th>
                  <th className="px-lg py-sm font-medium">Created</th>
                  <th className="px-lg py-sm font-medium">Last updated</th>
                  <th className="px-lg py-sm font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-border last:border-0">
                    <td className="px-lg py-sm">
                      <Link to={`/admin/projects/${j.projectId}`} className="font-medium text-primary hover:underline">
                        {j.projectName}
                      </Link>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{j.ownerEmail}</td>
                    <td className="px-lg py-sm text-text-primary">{j.type}</td>
                    <td className="px-lg py-sm">
                      <Badge tone={STATUS_TONE[j.status] ?? "neutral"}>{j.status}</Badge>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{formatDateTime(j.createdAt)}</td>
                    <td className="px-lg py-sm text-text-secondary">{formatDateTime(j.updatedAt)}</td>
                    <td className="px-lg py-sm text-error">{j.errorMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
