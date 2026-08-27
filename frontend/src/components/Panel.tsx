import type { ReactNode } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Panel. The structural shell for every
// workspace region (Layers, Canvas, Inspector, dock — see workspace-design.md).
// `shadow-none` always, per the elevation philosophy: panels are delineated by border,
// never shadow. Not applied to ProjectWorkspace's existing regions in this phase
// (Step 8) — available for 2D onward.

interface PanelProps {
  children: ReactNode;
  className?: string;
  bordered?: "all" | "right" | "left" | "top" | "bottom" | "none";
}

const BORDER_CLASSES: Record<NonNullable<PanelProps["bordered"]>, string> = {
  all: "border border-border",
  right: "border-r border-border",
  left: "border-l border-border",
  top: "border-t border-border",
  bottom: "border-b border-border",
  none: "",
};

export function Panel({ children, className, bordered = "all" }: PanelProps) {
  return <div className={cn("bg-surface shadow-none", BORDER_CLASSES[bordered], className)}>{children}</div>;
}
