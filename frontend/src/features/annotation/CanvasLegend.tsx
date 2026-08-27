import { useState } from "react";
import { cn } from "../../components/cn.js";

// on-canvas legend. New: the color/pattern mapping (model=violet dashed, container=blue,
// manual=emerald, selected=orange, outside-page=dimmed) previously existed only as a code
// comment (Phase 1 audit §14/§23/§25's most-cited gap). Collapsed by default to a small "?"
// trigger so it doesn't compete with the sketch for attention until asked for.
//
// Positioned bottom-right by the caller (CanvasPanel) rather than the design's literal
// bottom-left, to avoid overlapping AnnotationCanvas's own existing bottom- left
// interaction caption ("Drawing as: … · drag to draw …"), which this phase does not remove
// — the two captions serve different purposes (how to interact vs. what the colors mean)
// and can coexist without touching AnnotationCanvas's own JSX.

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
        "relative flex flex-wrap items-center gap-md rounded-md border border-border bg-surface-raised",
        "px-md py-xs text-2xs text-text-secondary shadow-elevated",
        className
      )}
    >
      {/* The same corner-bracket mark BrandMark.tsx uses for the app's identity —
          fitting here since this panel is literally the canvas's own color key. */}
      <span className="pointer-events-none absolute -left-px -top-px h-2.5 w-2.5 border-l-2 border-t-2 border-primary" aria-hidden="true" />
      <span className="pointer-events-none absolute -right-px -top-px h-2.5 w-2.5 border-r-2 border-t-2 border-primary" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-2.5 w-2.5 border-b-2 border-l-2 border-primary" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-2.5 w-2.5 border-b-2 border-r-2 border-primary" aria-hidden="true" />
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
