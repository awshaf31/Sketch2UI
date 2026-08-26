import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminAuditLogEntry } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S10 — Audit Logs (brief Phase 14). Read-only, newest first. See
// admin.routes.ts's /audit-logs comment for the limit/ordering contract, and
// packages/shared-types/src/audit-log.ts for exactly which events exist and why
// MODEL_ACTIVATED (from the brief's example list) is the one deliberate omission.

const EVENT_LABEL: Record<string, string> = {
  user_registered: "User registered",
  user_login: "User login",
  user_logout: "User logout",
  project_created: "Project created",
  project_deleted: "Project deleted",
  project_accessed_by_admin: "Project accessed by admin",
  training_approved: "Training data approved",
  admin_role_changed: "Admin role changed",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summarizeMetadata(entry: AdminAuditLogEntry): string {
  if (!entry.metadata) return "—";
  const parts = Object.entries(entry.metadata).map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join(", ") || "—";
}

export default function AdminAuditLogs() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .adminListAuditLogs()
      .then(setEntries)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[1080px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Audit Logs</h1>
        <p className="mt-2xs text-sm text-text-secondary">
          Security and admin events, newest first. Append-only — nothing here can be edited or removed.
        </p>

        {loading ? (
          <p className="mt-xl text-sm text-text-muted">Loading…</p>
        ) : error ? (
          <div className="mt-xl">
            <ErrorState
              message={error}
              action={
                <Button variant="secondary" onClick={load}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : entries && entries.length === 0 ? (
          <p className="mt-xl text-sm text-text-muted">No events recorded yet.</p>
        ) : entries ? (
          <Card className="mt-xl overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-lg py-sm font-medium">Event</th>
                  <th className="px-lg py-sm font-medium">Actor</th>
                  <th className="px-lg py-sm font-medium">Target</th>
                  <th className="px-lg py-sm font-medium">Details</th>
                  <th className="px-lg py-sm font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0">
                    <td className="px-lg py-sm">
                      <Badge tone="neutral">{EVENT_LABEL[e.event] ?? e.event}</Badge>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{e.actorEmail ?? "—"}</td>
                    <td className="px-lg py-sm text-text-secondary">
                      {e.targetType === "project" && e.targetId ? (
                        <Link to={`/admin/projects/${e.targetId}`} className="text-primary hover:underline">
                          {e.targetType}
                        </Link>
                      ) : e.targetType ? (
                        `${e.targetType}`
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[280px] truncate px-lg py-sm text-text-muted" title={summarizeMetadata(e)}>
                      {summarizeMetadata(e)}
                    </td>
                    <td className="whitespace-nowrap px-lg py-sm text-text-secondary">{formatDateTime(e.createdAt)}</td>
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
