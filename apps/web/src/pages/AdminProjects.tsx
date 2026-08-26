import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminProjectSummary } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";
import { Input } from "../components/Input.js";
import { Select } from "../components/Select.js";

// SaaS phase S8 — Admin Projects. Read-only ("prefer read-only oversight first",
// brief Phase 10) — search + status filter + a list, and a detail page
// (AdminProjectDetail.tsx) for the one thing a flat list can't show: a project's own
// jobs. No edit/delete affordance here, matching Phase 9/10's shared "do not silently
// edit user content" principle.

const STATUS_OPTIONS = ["", "draft", "annotated", "generated", "archived"] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminProjects() {
  const [projects, setProjects] = useState<AdminProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  function load(q: string, statusFilter: string) {
    setLoading(true);
    setError(null);
    api
      .adminListProjects({ q, status: statusFilter })
      .then(setProjects)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const handle = setTimeout(() => load(search, status), 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
        <p className="mt-2xs text-sm text-text-secondary">Every project on the platform, regardless of owner.</p>

        <div className="mt-lg flex items-center gap-sm">
          <Input
            placeholder="Search by project name or owner email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-[360px]"
          />
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
                <Button variant="secondary" onClick={() => load(search, status)}>
                  Retry
                </Button>
              }
            />
          </div>
        ) : projects && projects.length === 0 ? (
          <p className="mt-xl text-sm text-text-muted">No projects match.</p>
        ) : projects ? (
          <Card className="mt-lg overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-lg py-sm font-medium">Name</th>
                  <th className="px-lg py-sm font-medium">Owner</th>
                  <th className="px-lg py-sm font-medium">Status</th>
                  <th className="px-lg py-sm font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-sunken/50">
                    <td className="px-lg py-sm">
                      <Link to={`/admin/projects/${p.id}`} className="font-medium text-primary hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{p.ownerEmail}</td>
                    <td className="px-lg py-sm">
                      <Badge tone="neutral">{p.status}</Badge>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{formatDate(p.createdAt)}</td>
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
