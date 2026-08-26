import { useCallback, useEffect, useRef, useState } from "react";
import type { BBox, Detection, PagePolygon, ProjectAsset } from "@sketch2ui/shared-types";
import AnnotationCanvas from "./AnnotationCanvas.js";
import ClassPicker from "./ClassPicker.js";
import { CanvasLegend } from "./CanvasLegend.js";
import { CanvasToolbar } from "./CanvasToolbar.js";

// docs/frontend/workspace-design.md "Canvas panel (center)" + canvas-design.md
// §11–13 — extracted from ProjectWorkspace.tsx's inline canvas column, now owning
// zoom/pan/fit state locally (a pure view concern with no server dependency, so it
// doesn't belong in ProjectWorkspace's already-large state list).
//
// Zoom is implemented WITHOUT any change to AnnotationCanvas.tsx's pointer math:
// AnnotationCanvas's root is `w-full` with an aspect-ratio, so it already renders at
// whatever pixel width its parent gives it. Zoom here just sets that parent's width to
// `asset.width * zoom` inside a scrollable container — AnnotationCanvas's own
// `getImagePoint` already derives its screen-to-image scale from
// `getBoundingClientRect()`, which reflects that rendered size automatically. This is
// the reason canvas-design.md's zoom/pan capability could be added with zero edits to
// the coordinate-transform functions the Phase 1 audit flagged as "hard-won, correct."

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const FIT_MARGIN = 0.96;
// Matches the `lg` spacing token (tailwind.config.js) — the floor this canvas always
// keeps around the sketch, and the amount actually used once zoomed content no longer
// fits (see the centering comment below).
const BASE_PADDING_PX = 16;

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
}

interface CanvasPanelProps {
  asset: ProjectAsset;
  imageUrl: string;
  detections: Detection[];
  selectedId: string | null;
  activeClass: string;
  onActiveClassChange: (className: string) => void;
  onSelect: (id: string | null) => void;
  onCreate: (bbox: BBox) => void;
  onUpdate: (id: string, bbox: BBox) => void;
  onDeleteSelected: () => void;
  pageBoundary?: PagePolygon | null;
  boundaryEditable?: boolean;
  onBoundaryChange?: (polygon: PagePolygon) => void;
}

export function CanvasPanel({
  asset,
  imageUrl,
  detections,
  selectedId,
  activeClass,
  onActiveClassChange,
  onSelect,
  onCreate,
  onUpdate,
  onDeleteSelected,
  pageBoundary,
  boundaryEditable,
  onBoundaryChange,
}: CanvasPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  // Measured scroll-container size, used to compute centering padding below. Kept in
  // state (not read directly at render time) because the container's size can change
  // for reasons that have nothing to do with zoom — a tablet drawer opening, the dock
  // resizing — and only a ResizeObserver callback (not the render phase) sees that.
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // Tracks whether the user has explicitly changed zoom for the CURRENT asset, so a
  // later container-resize re-fit (below) never fights a deliberate zoom choice —
  // only the automatic, no-manual-input fit path is resize-reactive.
  const userAdjustedZoomRef = useRef(false);

  function fitToScreen() {
    const el = scrollRef.current;
    if (!el || asset.width === 0 || asset.height === 0) return;
    const widthRatio = (el.clientWidth * FIT_MARGIN) / asset.width;
    const heightRatio = (el.clientHeight * FIT_MARGIN) / asset.height;
    setZoom(clampZoom(Math.min(widthRatio, heightRatio)));
    userAdjustedZoomRef.current = false;
  }

  // Default zoom is fit-to-screen the first time an asset is shown (canvas-design.md
  // "Fit-to-screen").
  useEffect(() => {
    userAdjustedZoomRef.current = false;
    const raf = requestAnimationFrame(fitToScreen);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  // Re-fit whenever the scroll container's own measured size changes (window resize,
  // a tablet drawer opening/closing, the dock height changing) — the one-shot rAF fit
  // above can run before the surrounding shell has finished its own layout pass, so a
  // resize-reactive re-fit is what actually keeps the sketch filling the available
  // space rather than sticking to a stale early measurement. Skipped once the user has
  // manually zoomed this asset — a later resize should never silently override a
  // deliberate zoom choice (same explicit-over-ambient rule the fit-once comment
  // above already followed).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
      if (!userAdjustedZoomRef.current) fitToScreen();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.id]);

  const zoomBy = useCallback((delta: number) => {
    userAdjustedZoomRef.current = true;
    setZoom((z) => clampZoom(z + delta));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomBy(-ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        userAdjustedZoomRef.current = true;
        setZoom(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // A native (non-passive) DOM listener, not React's JSX `onWheel` — React attaches
  // wheel handlers as passive by default (since React 17), so preventDefault() inside
  // a synthetic onWheel handler is a silent no-op (surfaces only as a console warning:
  // "Unable to preventDefault inside passive event listener invocation") and the
  // browser's own page-zoom on Cmd/Ctrl+wheel would still fire alongside our canvas
  // zoom. Attaching directly with { passive: false } is required to actually suppress it.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleWheel(e: WheelEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  return (
    <>
      <div className="flex items-center justify-between gap-sm border-b border-border px-md py-sm">
        <div className="flex items-center gap-sm">
          <span className="text-xs text-text-muted">New box class:</span>
          <ClassPicker value={activeClass} onChange={onActiveClassChange} />
        </div>
        <CanvasToolbar zoom={zoom} onZoomIn={() => zoomBy(ZOOM_STEP)} onZoomOut={() => zoomBy(-ZOOM_STEP)} onFit={fitToScreen} />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          // Centering degrades to a flat BASE_PADDING_PX (not a flexbox center) once
          // the zoomed content no longer fits — flex/grid centering of overflowing
          // content scrolls asymmetrically from the center outward in most browsers,
          // which read as "scrolling/zoom feels stuck" (reported directly against the
          // earlier flex-centered version). Padding-based centering has no such
          // quirk: it's ordinary block layout, so `overflow: auto` always scrolls
          // linearly from the true top-left, exactly like before zoom/centering
          // existed, and only ADDS breathing room when there's room to add it.
          className="h-full overflow-auto bg-surface-sunken"
          style={{
            paddingLeft: Math.max(BASE_PADDING_PX, (containerSize.width - asset.width * zoom) / 2),
            paddingRight: Math.max(BASE_PADDING_PX, (containerSize.width - asset.width * zoom) / 2),
            paddingTop: Math.max(BASE_PADDING_PX, (containerSize.height - asset.height * zoom) / 2),
            paddingBottom: Math.max(BASE_PADDING_PX, (containerSize.height - asset.height * zoom) / 2),
          }}
        >
          <div style={{ width: asset.width * zoom }}>
            <AnnotationCanvas
              asset={asset}
              imageUrl={imageUrl}
              detections={detections}
              selectedId={selectedId}
              activeClass={activeClass}
              onSelect={onSelect}
              onCreate={onCreate}
              onUpdate={onUpdate}
              onDeleteSelected={onDeleteSelected}
              pageBoundary={pageBoundary}
              boundaryEditable={boundaryEditable}
              onBoundaryChange={onBoundaryChange}
            />
          </div>
        </div>
        {/* Sibling of the scroll container, not a child of it, so the legend stays
            pinned to the viewport corner while the zoomed sketch scrolls underneath. */}
        <CanvasLegend className="absolute bottom-lg right-lg z-10" />
      </div>
    </>
  );
}
