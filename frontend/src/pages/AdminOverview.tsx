import { useEffect, useState } from "react";
import type { AdminOverview as AdminOverviewData } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S6 — Admin shell landing page. Every number comes straight from
// GET /api/admin/overview (real Prisma/JSON aggregates, no fabricated stats — see
// admin.routes.ts's header comment for exactly what's included and why the rest of
// Phase 8's suggested list is deferred to later admin phases).
//
// 2026-08-27 — restyled from three disconnected stat cards into a connected funnel.
// Users → Projects → Generated Projects isn't an arbitrary grouping: each stage is a
// real subset of the one before it (you can't have a generated project without a
// project, can't have a project without a user), so the connecting labels between
// stages are legitimate derived numbers — plain arithmetic on the same two fetched
// integers, never a fabricated metric — not decoration.

function FunnelStage({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex-1 text-center sm:text-left">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-xs font-mono text-3xl font-semibold text-text-primary">{value}</p>
    </Card>
  );
}

function FunnelConnector({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-2xs py-2xs sm:min-w-[72px] sm:py-0">
      <svg
        viewBox="0 0 12 32"
        width="12"
        height="32"
        className="text-border-strong sm:hidden"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M6 0v24M2 20l4 6 4-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 40 12"
        width="40"
        height="12"
        className="hidden text-border-strong sm:block"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M0 6h30M26 2l6 4-6 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="whitespace-nowrap font-mono text-2xs text-text-muted">{label}</span>
    </div>
  );
}

export default function AdminOverview() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .adminOverview()
      .then(setData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const projectsPerUser =
    data && data.totalUsers > 0 ? `${(data.totalProjects / data.totalUsers).toFixed(1)} / user` : "—";
  const generatedRate =
    data && data.totalProjects > 0 ? `${Math.round((data.generatedProjects / data.totalProjects) * 100)}% generated` : "—";

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
        <p className="mt-2xs text-sm text-text-secondary">Platform-wide metrics, read directly from the database.</p>

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
        ) : data ? (
          <div className="mt-xl flex flex-col items-stretch sm:flex-row sm:items-stretch">
            <FunnelStage label="Total Users" value={data.totalUsers} />
            <FunnelConnector label={projectsPerUser} />
            <FunnelStage label="Total Projects" value={data.totalProjects} />
            <FunnelConnector label={generatedRate} />
            <FunnelStage label="Generated Projects" value={data.generatedProjects} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
