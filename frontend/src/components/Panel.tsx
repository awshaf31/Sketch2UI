import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

// Panel. The structural shell for every workspace region (Layers, Canvas, Inspector, dock).
// `shadow-none` always, per the elevation philosophy: panels are delineated by border,
// never shadow. Not applied to ProjectWorkspace's existing regions in this phase (Step 8) —
// available for 2D onward.

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
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

export function Panel({ children, className, bordered = "all", ...rest }: PanelProps) {
  return (
    <div className={cn("bg-surface shadow-none", BORDER_CLASSES[bordered], className)} {...rest}>
      {children}
    </div>
  );
}
