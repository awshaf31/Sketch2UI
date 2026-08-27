import { Component } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { ErrorState } from "./ErrorState.js";

// DEF-013 — support for the route-level code splitting in App.tsx. Every route is a
// React.lazy() chunk now, which introduces two states a statically-imported route
// never had: the chunk is still downloading, and the chunk failed to download.

export function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-bg text-text-muted"
    >
      <svg
        viewBox="0 0 16 16"
        width="20"
        height="20"
        className="animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

// A failed chunk request is nearly always a stale index.html pointing at hashed assets
// that a newer deploy replaced, so a full reload (not a re-render) is the fix.
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg px-lg">
          <ErrorState
            message="Couldn't load this page. Reload to try again."
            action={
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}
