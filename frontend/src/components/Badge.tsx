import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Badge. Formalizes the "Beta" tag / source badges / confidence pills that exist today as
// one-off inline className strings (e.g. the header's "Beta" span in ProjectWorkspace.tsx)
// into one component.

export type BadgeTone = "neutral" | "brand" | "selection" | "violet" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-text-secondary",
  brand: "bg-primary-subtle text-primary-active",
  selection: "bg-selection-subtle text-selection",
  violet: "bg-detection-model/10 text-detection-model",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  error: "bg-error-subtle text-error",
  info: "bg-info-subtle text-info",
};

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2xs whitespace-nowrap rounded-pill px-sm py-2xs text-2xs font-semibold uppercase tracking-wide",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
