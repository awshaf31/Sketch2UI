import { useState } from "react";
import { cn } from "../../components/cn.js";

// docs/frontend/canvas-design.md §6 — on-canvas legend. New: the color/pattern
// mapping (model=violet dashed, container=blue, manual=emerald, selected=orange,
// outside-page=dimmed) previously existed only as a code comment (Phase 1 audit
// §14/§23/§25's most-cited gap). Collapsed by default to a small "?" trigger so it
// doesn't compete with the sketch for attention until asked for.
//
// Positioned bottom-right by the caller (CanvasPanel) rather than canvas-design.md's
// literal bottom-left, to avoid overlapping AnnotationCanvas's own existing bottom-
// left interaction caption ("Drawing as: … · drag to draw …"), which this phase does
// not remove — the two captions serve different purposes (how to interact vs. what
// the colors mean) and can coexist without touching AnnotationCanvas's own JSX.

const ITEMS: Array<{ label: string; swatch: string }> = [
  { label: "Model", swatch: "border-detection-model border-dashed" },
  { label: "Container", swatch: "border-primary" },
  { label: "Manual", swatch: "border-detection-manual" },
  { label: "Selected", swatch: "border-selection" },
];

export function CanvasLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Show canvas legend"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-pill border border-border bg-surface-raised",
          "text-2xs font-semibold text-text-muted shadow-elevated transition-colors duration-fast hover:text-text-primary",
          className
        )}
      >
        ?
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-md rounded-md border border-border bg-surface-raised",
        "px-md py-xs text-2xs text-text-secondary shadow-elevated",
        className
      )}
    >
      {ITEMS.map((item) => (
        <span key={item.label} className="flex items-center gap-2xs whitespace-nowrap">
          <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-sm border-2 bg-transparent", item.swatch)} />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-2xs whitespace-nowrap">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm border-2 border-page-boundary border-dashed opacity-50" />
        Outside page
      </span>
      <button
        onClick={() => setOpen(false)}
        aria-label="Hide legend"
        className="text-text-muted transition-colors duration-fast hover:text-text-primary"
      >
        ×
      </button>
    </div>
  );
}
