import type { ReactNode } from "react";
import { cn } from "./cn.js";

// A small square tick + uppercase tracked mono label — the app's structural-annotation
// tag, used wherever a section or card needs a label above/beside its content. Introduced
// during the 2026-08-27 marketing redesign (replacing a pill Badge as a section eyebrow,
// which read as the generic AI-SaaS default) and reused on Dashboard for the same
// "this is a data label, not a headline" role. Not a replacement for Badge — Badge still
// carries real semantic status tones (project status, etc.) elsewhere in the app.

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2xs font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-primary", className)}>
      <span className="h-1.5 w-1.5 shrink-0 bg-primary" aria-hidden="true" />
      {children}
    </div>
  );
}
