import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn.js";

// docs/frontend/responsive-design.md — tablet-width Layers/Inspector overlay drawers.
// A deliberately minimal sibling to Dialog.tsx: Escape + overlay-click to dismiss, but
// no full focus-trap — same "foundation, not finished" scoping precedent as Tooltip
// (2A), ExportsPopover (2D), and CanvasLegend (2E), each of which shipped the common
// case first rather than a complete widget on the first pass.

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side: "left" | "right";
  title: string;
  children: ReactNode;
}

export function Drawer({ open, onClose, side, title, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-text-primary/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex h-full w-[280px] flex-col overflow-hidden bg-surface shadow-modal",
          side === "left" ? "mr-auto" : "ml-auto"
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
