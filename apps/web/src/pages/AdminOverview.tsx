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

const STAT_LABELS: Record<keyof AdminOverviewData, string> = {
  totalUsers: "Total Users",
  totalProjects: "Total Projects",
  generatedProjects: "Generated Projects",
};

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
          <div className="mt-xl grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-lg">
            {(Object.keys(STAT_LABELS) as Array<keyof AdminOverviewData>).map((key) => (
              <Card key={key}>
                <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{STAT_LABELS[key]}</p>
                <p className="mt-xs text-2xl font-semibold text-text-primary">{data[key]}</p>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
