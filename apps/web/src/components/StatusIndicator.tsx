import type { ReactNode } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Status Indicator. A dot + label pattern
// for the future consolidated StatusBar (workspace-design.md) and any semantic status
// callout — success/warning/error/info plus the app's own brand/selection/violet
// (model-detection) hues, so a job-progress or boundary-confidence line reads
// consistently with the rest of the token system instead of a bespoke colored <div>.

export type StatusTone =
  | "neutral"
  | "brand"
  | "selection"
  | "violet"
  | "boundary"
  | "success"
  | "warning"
  | "error"
  | "info";

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-text-muted",
  brand: "bg-primary",
  selection: "bg-selection",
  violet: "bg-detection-model",
  // Page boundary (canvas-design.md) is its own distinct semantic color — rose, not
  // to be confused with error red or warning amber, even though all three are warm.
  boundary: "bg-page-boundary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
};

interface StatusIndicatorProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

export function StatusIndicator({ tone = "neutral", children, className }: StatusIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-xs text-xs text-text-secondary", className)}>
      <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])} />
      {children}
    </span>
  );
}
