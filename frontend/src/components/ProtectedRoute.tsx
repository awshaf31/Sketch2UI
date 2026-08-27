import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Button } from "./Button.js";
import { ErrorState } from "./ErrorState.js";
import { LinkButton } from "./LinkButton.js";

// Gates every authenticated route (Dashboard, ProjectWorkspace, Account — see
// App.tsx). Renders nothing while auth status is unknown so no project data fetch can
// ever fire before /api/auth/me resolves.
//
// SaaS phase S6 — `requireAdmin` adds a second, additional check for the admin shell.
// This is UX only, not the security boundary: the real gate is server-side
// (requireAdmin.ts on every /api/admin route, per the brief's explicit "do not rely
// on frontend route hiding" rule) — this just avoids showing a broken/empty admin
// page (every fetch would 403) to a signed-in user who isn't one.

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin }: ProtectedRouteProps) {
  const { status, user, refresh } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status === "error") {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg px-lg">
        <ErrorState
          message="Couldn't reach Sketch2UI. Check your connection and try again."
          action={
            <Button variant="secondary" onClick={refresh}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== "admin") {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg px-lg">
        <ErrorState
          message="This page is only available to administrators."
          action={
            <LinkButton to="/app" variant="secondary">
              Back to Projects
            </LinkButton>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
