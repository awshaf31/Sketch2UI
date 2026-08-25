import { IconButton } from "../../components/IconButton.js";

// docs/frontend/canvas-design.md §11–12 — zoom + fit-to-screen. New capability, not
// present in the app before Phase 2E: the canvas previously had no zoom control at
// all (only the live-preview pane had viewport presets). Percentage readout uses
// font-mono per the type direction (it's data, not prose).

function ZoomOutIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M5 7h4M11 11l3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="7" cy="7" r="5" />
      <path d="M7 5v4M5 7h4M11 11l3.5 3.5" strokeLinecap="round" />
    </svg>
  );
}

function FitScreenIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        d="M2 6V3.5A1.5 1.5 0 0 1 3.5 2H6M14 6V3.5A1.5 1.5 0 0 0 12.5 2H10M2 10v2.5A1.5 1.5 0 0 0 3.5 14H6M14 10v2.5a1.5 1.5 0 0 1-1.5 1.5H10"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface CanvasToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}

export function CanvasToolbar({ zoom, onZoomIn, onZoomOut, onFit }: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-2xs">
      <IconButton aria-label="Zoom out" size="sm" icon={<ZoomOutIcon />} onClick={onZoomOut} />
      <span className="w-11 text-center font-mono text-xs text-text-secondary">{Math.round(zoom * 100)}%</span>
      <IconButton aria-label="Zoom in" size="sm" icon={<ZoomInIcon />} onClick={onZoomIn} />
      <IconButton aria-label="Fit sketch to screen" size="sm" icon={<FitScreenIcon />} onClick={onFit} />
    </div>
  );
}
