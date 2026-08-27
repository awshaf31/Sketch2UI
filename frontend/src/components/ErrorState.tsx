import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Error State (full-panel variant). Used when an entire panel's data fetch fails, e.g.
// Dashboard's project list — distinct from the inline error-text pattern used for a single
// failed action (kept as plain text at its call site, since that's "replacing nothing
// structural").

interface ErrorStateProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ message, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-sm rounded-md border border-error/30 bg-error-subtle px-lg py-2xl text-center",
        className
      )}
    >
      <p className="text-sm text-error">{message}</p>
      {action}
    </div>
  );
}
