import { AppShell, PageHeader } from "../components/AppShell.js";
import { Card } from "../components/Card.js";
import { useAuth } from "../context/AuthContext.js";

// SaaS phase S4 / Phase 6 of the brief ("USER ACCOUNT" — "do not build a large
// settings system"). Deliberately minimal: the auth backend
// (backend/src/modules/auth/auth.routes.ts) has no password-change endpoint today,
// so this page shows only what's real — email and account age — rather than a
// password field wired to nothing. Role is a reserved, unread field
// (see schema.prisma's User.role comment) with no user-facing meaning yet, so it's
// left off this page rather than shown half-explained.

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function Account() {
  const { user } = useAuth();

  return (
    // AppHeader's top nav is replaced by the persistent rail here and on the Dashboard. The
    // page's own content below is unchanged.
    <AppShell maxWidth="max-w-[560px]">
      <PageHeader title="Account" description="Your Sketch2UI account details." />

      <Card className="mt-xl flex flex-col gap-lg">
        <div className="flex flex-col gap-xs">
          <span className="text-xs text-text-secondary">Email</span>
          <span className="text-md text-text-primary">{user?.email}</span>
        </div>
        {user?.createdAt && (
          <div className="flex flex-col gap-xs">
            <span className="text-xs text-text-secondary">Member since</span>
            <span className="text-md text-text-primary">{formatMemberSince(user.createdAt)}</span>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
