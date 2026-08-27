import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Tabs. Replaces the Preview/Code and
// HTML/CSS tab strips' hand-written pattern (ProjectWorkspace.tsx, CodePanel.tsx) with
// one accessible primitive: role="tablist"/"tab", aria-selected, arrow-key navigation.
// Not wired into either call site yet (that's 2D/2H per the roadmap) — this is the
// foundation those phases consume.

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  "aria-label": string;
}

export function Tabs({ value, onChange, children, className, ...rest }: TabsProps) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<TabProps>[];

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const index = items.findIndex((item) => item.props.value === value);
    if (index === -1) return;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + items.length) % items.length;
    const next = items[nextIndex];
    if (next) {
      onChange(next.props.value);
      // Visual QA 2026-08-26: onChange alone updates aria-selected/tabIndex on the
      // NEXT render, but leaves actual DOM focus sitting on the button the user just
      // arrowed away from — which has just dropped to tabIndex=-1. WAI-ARIA's roving-
      // tabindex pattern for tabs requires focus to move WITH selection; without this
      // a screen reader keeps announcing the old, now-unselected tab, and a further
      // Tab press exits the tablist from the wrong position. The buttons already exist
      // in the DOM regardless of selection state, so focusing by index here is safe
      // even though their tabIndex/aria-selected attributes haven't re-rendered yet.
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div role="tablist" onKeyDown={handleKeyDown} className={cn("flex border-b border-border", className)} {...rest}>
      {items.map((item) =>
        cloneElement(item, {
          key: item.props.value,
          selected: item.props.value === value,
          onSelect: () => onChange(item.props.value),
        })
      )}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}

export function Tab({ children, selected, onSelect }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "px-md py-sm text-xs font-medium uppercase tracking-wide transition-colors duration-fast",
        selected ? "border-b-2 border-primary text-text-primary" : "text-text-muted hover:text-text-secondary"
      )}
    >
      {children}
    </button>
  );
}
