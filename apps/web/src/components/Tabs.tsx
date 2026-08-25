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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const index = items.findIndex((item) => item.props.value === value);
    if (index === -1) return;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = items[(index + delta + items.length) % items.length];
    if (next) onChange(next.props.value);
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
