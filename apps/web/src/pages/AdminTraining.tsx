import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminTrainingSampleSummary } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S9 — Training Data Admin (brief Phase 13: training samples, approval
// status, source project, class count, created date). Every row is already
// approved — see admin.routes.ts's /training comment for why there's no
// pending/rejected state or reject action to build here.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminTraining() {
  const [samples, setSamples] = useState<AdminTrainingSampleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .adminListTraining()
      .then(setSamples)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Training Data</h1>
        <p className="mt-2xs text-sm text-text-secondary">Sketches approved as ground truth for future model training.</p>

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
        ) : samples && samples.length === 0 ? (
          <p className="mt-xl text-sm text-text-muted">No sketches have been approved for training yet.</p>
        ) : samples ? (
          <Card className="mt-xl overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-lg py-sm font-medium">Source project</th>
                  <th className="px-lg py-sm font-medium">Approval</th>
                  <th className="px-lg py-sm font-medium">Split</th>
                  <th className="px-lg py-sm font-medium">Boxes</th>
                  <th className="px-lg py-sm font-medium">Classes</th>
                  <th className="px-lg py-sm font-medium">Approved</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="px-lg py-sm">
                      <Link to={`/admin/projects/${s.projectId}`} className="font-medium text-primary hover:underline">
                        {s.projectName}
                      </Link>
                    </td>
                    <td className="px-lg py-sm">
                      <Badge tone="success">Approved</Badge>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{s.datasetSplit}</td>
                    <td className="px-lg py-sm text-text-secondary">{s.boxCount}</td>
                    <td className="px-lg py-sm text-text-secondary">{s.classCount}</td>
                    <td className="px-lg py-sm text-text-secondary">{formatDate(s.approvedAt)}</td>
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
