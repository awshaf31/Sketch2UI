import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../../components/cn.js";

// docs/frontend/inspector-design.md — "Shell: accordion, not always-expanded".
// Uncontrolled: each section owns its own open/closed state locally. Because the six
// AccordionSection instances in InspectorPanel are never remounted when `selected`
// changes upstream (only their children's data does), a user's open/closed choice per
// section naturally persists across selecting a different detection, rather than
// resetting every time — no extra state-sync needed for that to be true.

export type AccordionDot = "applied" | "dirty" | null;

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  dot?: AccordionDot;
  children: ReactNode;
}

const DOT_CLASS: Record<Exclude<AccordionDot, null>, string> = {
  applied: "bg-selection",
  dirty: "bg-warning",
};

export function AccordionSection({ title, defaultOpen = false, dot = null, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-xs px-md py-sm text-left text-2xs font-semibold uppercase tracking-wider text-text-muted transition-colors duration-fast hover:bg-surface-sunken hover:text-text-secondary",
          open && "bg-surface-sunken"
        )}
      >
        <svg
          viewBox="0 0 10 10"
          width="9"
          height="9"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-fast", !open && "-rotate-90")}
        >
          <path d="M2.5 3.5L5 6.5L7.5 3.5" />
        </svg>
        <span className="flex-1">{title}</span>
        {dot && <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[dot])} />}
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-normal",
          open ? "grid-rows-[1fr] bg-surface-sunken" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
