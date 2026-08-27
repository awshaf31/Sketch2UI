import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn.js";
import { IconButton } from "./IconButton.js";

// tablet-width Layers/Inspector overlay drawers. A deliberately minimal sibling to
// Dialog.tsx: Escape + overlay-click to dismiss.
//
// QA audit DEF-005: this previously set `aria-modal="true"` without actually trapping focus
// — Tab could escape the drawer into the page behind the scrim, contradicting what
// `aria-modal` promises assistive tech, and there was no visible close affordance for a
// mouse user who doesn't know Escape or the (also invisible-looking) scrim click dismiss
// it. Now mirrors Dialog.tsx's proven focus-trap contract (focus moves in on open, Tab
// cycles within the panel, focus returns to the trigger on close by any method) and adds a
// visible close button.

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, side, title, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-text-primary/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative z-10 flex h-full w-[280px] flex-col overflow-hidden bg-surface shadow-modal",
          side === "left" ? "mr-auto" : "ml-auto"
        )}
      >
        <IconButton
          aria-label={`Close ${title}`}
          icon={<CloseIcon />}
          size="sm"
          onClick={onClose}
          className="absolute right-xs top-xs z-10"
        />
        {children}
      </div>
    </div>,
    document.body
  );
}
