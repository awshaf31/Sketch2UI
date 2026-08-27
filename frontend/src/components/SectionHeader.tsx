import type { ReactNode } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Section Header. Formalizes the uppercase
// small-caps label pattern already used informally today (InspectorPanel.tsx's `h3`
// className string, repeated six times) into one component.

export function SectionHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("px-lg py-sm text-2xs font-semibold uppercase tracking-wider text-text-muted", className)}>
      {children}
    </h3>
  );
}
