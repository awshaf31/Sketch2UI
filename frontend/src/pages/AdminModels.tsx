import { useEffect, useState } from "react";
import type { AdminModelSummary } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S9 — Admin Model Management (brief Phase 12). Read directly off the
// on-disk model registry (ml/models/), the same source cv-service itself
// loads from — see models.service.ts. No delete/promote controls: Phase 12 rules
// those out explicitly ("Do not expose arbitrary model weight deletion controls.
// Model promotion must remain a controlled engineering operation").

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function AdminModels() {
  const [models, setModels] = useState<AdminModelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .adminListModels()
      .then(setModels)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Models</h1>
        <p className="mt-2xs text-sm text-text-secondary">The component-detection model registry.</p>

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
        ) : models && models.length === 0 ? (
          <p className="mt-xl text-sm text-text-muted">No trained models found under ml/models/.</p>
        ) : models ? (
          <div className="mt-xl flex flex-col gap-lg">
            {models.map((m) => (
              <Card key={`${m.family}-${m.version}`} className="flex flex-col gap-md">
                <div className="flex items-center gap-sm">
                  <h2 className="font-mono text-md font-semibold text-text-primary">
                    {m.family} {m.version}
                  </h2>
                  {m.active && <Badge tone="success">Active</Badge>}
                  <Badge tone={m.status === "smoke_test" ? "warning" : "neutral"}>{m.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-lg sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Architecture</p>
                    <p className="mt-2xs font-mono text-sm text-text-primary">{m.architecture}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Dataset</p>
                    <p className="mt-2xs text-sm text-text-primary">
                      {m.classCount} classes
                      <br />
                      <span className="text-text-muted">{m.datasetVersion}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Created</p>
                    <p className="mt-2xs text-sm text-text-primary">{formatDate(m.createdAt)}</p>
                  </div>
                </div>
                {m.metrics && (
                  <div className="grid grid-cols-2 gap-lg border-t border-border pt-md sm:grid-cols-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Precision</p>
                      <p className="mt-2xs font-mono text-sm text-text-primary">{formatPct(m.metrics.precision)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Recall</p>
                      <p className="mt-2xs font-mono text-sm text-text-primary">{formatPct(m.metrics.recall)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">mAP50</p>
                      <p className="mt-2xs font-mono text-sm text-text-primary">{formatPct(m.metrics.mAP50)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">mAP50-95</p>
                      <p className="mt-2xs font-mono text-sm text-text-primary">{formatPct(m.metrics.mAP50_95)}</p>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
