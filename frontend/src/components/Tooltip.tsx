import { cloneElement, useId, useState } from "react";
import type { FocusEvent, MouseEvent, ReactElement } from "react";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Tooltip foundation. Triggers on hover
// AND keyboard focus (never click-only — several current uses, e.g. Export ZIP's
// title= while disabled, are on buttons that may not be clickable). This is the
// foundation only: simple centered placement, no collision/flip logic yet. Intended
// to eventually replace the app's `title="..."` attributes (see
// docs/frontend/design-to-code-mapping.md's e2e-selector table for why that swap must
// preserve the exact existing strings) — not wired into any call site in this phase.

interface TooltipProps {
  content: string;
  children: ReactElement<Record<string, unknown>>;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  const trigger = cloneElement(children, {
    "aria-describedby": id,
    onMouseEnter: (e: MouseEvent) => {
      show();
      (children.props.onMouseEnter as ((e: MouseEvent) => void) | undefined)?.(e);
    },
    onMouseLeave: (e: MouseEvent) => {
      hide();
      (children.props.onMouseLeave as ((e: MouseEvent) => void) | undefined)?.(e);
    },
    onFocus: (e: FocusEvent) => {
      show();
      (children.props.onFocus as ((e: FocusEvent) => void) | undefined)?.(e);
    },
    onBlur: (e: FocusEvent) => {
      hide();
      (children.props.onBlur as ((e: FocusEvent) => void) | undefined)?.(e);
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap",
            "rounded-sm bg-text-primary px-sm py-2xs text-2xs text-text-inverse shadow-elevated",
            side === "top" ? "bottom-full mb-xs" : "top-full mt-xs"
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
