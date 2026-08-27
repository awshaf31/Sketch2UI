import type { ReactNode } from "react";
import { cn } from "../../components/cn.js";

// "Shared per-section footer". A literal restyle of the exact state machine every section
// already implemented locally (busy/dirty/ applied ternaries) — the caller still computes
// its own label text (preserving exact strings like "Saved" that e2e/golden-path.spec.ts
// asserts on verbatim) and passes its own Apply/Reset (or Detection's Apply/"Revert to
// model") buttons as `actions`; this component only standardizes the wrapper layout and the
// label's color-by-tone.

export type FooterTone = "muted" | "warning" | "success";

interface InspectorSectionFooterProps {
  label: string;
  tone?: FooterTone;
  actions: ReactNode;
}

const TONE_CLASS: Record<FooterTone, string> = {
  muted: "text-text-muted",
  warning: "text-warning",
  success: "text-success",
};

export function InspectorSectionFooter({ label, tone = "muted", actions }: InspectorSectionFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-border px-md py-sm">
      <span className={cn("text-2xs uppercase tracking-wide", TONE_CLASS[tone])}>{label}</span>
      <div className="flex gap-2xs">{actions}</div>
    </div>
  );
}
