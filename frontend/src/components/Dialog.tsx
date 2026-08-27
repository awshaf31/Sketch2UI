import { useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn.js";

// docs/frontend/component-specification.md — Dialog (presentational shell). Full
// focus-trap contract per docs/frontend/accessibility.md: focus moves to the caller's
// chosen initial element on open, Tab cycles within the panel, Escape closes, and
// focus returns to whatever triggered the dialog on close by any method.

interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  /** Which element receives focus on open — the panel itself if omitted. */
  initialFocusRef?: RefObject<HTMLElement>;
  onDismiss: () => void;
  /** Destructive dialogs don't dismiss on an overlay click — an accidental click
   * shouldn't cancel/confirm a delete; Escape and the explicit buttons still work. */
  dismissOnOverlayClick?: boolean;
}

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  title,
  children,
  actions,
  initialFocusRef,
  onDismiss,
  dismissOnOverlayClick = true,
}: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const target = initialFocusRef?.current ?? panelRef.current;
    target?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
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
  }, [open, initialFocusRef, onDismiss]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-lg">
      <div
        className="absolute inset-0 bg-text-primary/40"
        onClick={dismissOnOverlayClick ? onDismiss : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn("relative z-10 w-full max-w-[440px] rounded-lg bg-surface-raised p-xl shadow-modal")}
      >
        <h2 id={titleId} className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        {children && <div className="mt-sm text-sm text-text-secondary">{children}</div>}
        <div className="mt-xl flex justify-end gap-sm">{actions}</div>
      </div>
    </div>,
    document.body
  );
}
