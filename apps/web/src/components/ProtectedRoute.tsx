import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext.js";
import { Button } from "./Button.js";
import { ErrorState } from "./ErrorState.js";

// Gates the two authenticated app routes (Dashboard, ProjectWorkspace — see App.tsx).
// Renders nothing while auth status is unknown so no project data fetch can ever fire
// before /api/auth/me resolves.

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, refresh } = useAuth();

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

  return <>{children}</>;
}
