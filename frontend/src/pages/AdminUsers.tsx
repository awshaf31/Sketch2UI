import { useEffect, useState } from "react";
import type { AdminUserSummary } from "../services/api.js";
import { api } from "../services/api.js";
import { AdminHeader } from "../components/AdminHeader.js";
import { Badge } from "../components/Badge.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Button } from "../components/Button.js";

// SaaS phase S7 — Admin Users. Read-only by design (brief Phase 9: "Admin actions
// should be limited to real supported functionality" / "Do not give admin arbitrary
// password access"). No Status column — there is no deactivation concept anywhere in
// this app, and a column that would read "Active" on every single row forever tells
// an admin nothing; adding one would mean either fabricating a status this app
// doesn't track or building a real deactivation feature this phase doesn't need. No
// role-change control — that stays a deliberate, out-of-band operation
// (backend/scripts/promote-admin.ts), not a self-service admin-UI button.

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    api
      .adminListUsers()
      .then(setUsers)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="min-h-full bg-bg">
      <AdminHeader />
      <div className="mx-auto max-w-[960px] px-lg pb-3xl pt-3xl">
        <h1 className="text-xl font-semibold text-text-primary">Users</h1>
        <p className="mt-2xs text-sm text-text-secondary">Every account on the platform.</p>

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
        ) : users ? (
          <Card className="mt-xl overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-text-muted">
                  <th className="px-lg py-sm font-medium">Email</th>
                  <th className="px-lg py-sm font-medium">Role</th>
                  <th className="px-lg py-sm font-medium">Created</th>
                  <th className="px-lg py-sm font-medium">Projects</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-lg py-sm text-text-primary">{u.email}</td>
                    <td className="px-lg py-sm">
                      <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{u.role}</Badge>
                    </td>
                    <td className="px-lg py-sm text-text-secondary">{formatDate(u.createdAt)}</td>
                    <td className="px-lg py-sm font-mono text-text-secondary">{u.projectCount}</td>
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
