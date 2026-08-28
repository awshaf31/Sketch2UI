import { IconButton } from "../../components/IconButton.js";
import { Tooltip } from "../../components/Tooltip.js";
import { cn } from "../../components/cn.js";

// Explicit Select/Draw Box/Delete/Undo/Redo cluster — the reference design's canvas
// toolbar. Sits to the LEFT of the existing zoom cluster (CanvasToolbar.tsx), which this
// deliberately doesn't touch or absorb: zoom is a viewport concern, this is an editing-
// mode concern, and CanvasPanel.tsx already renders them side by side in one row.
//
// Select/Draw Box is a real mode toggle (see AnnotationCanvas.tsx's `mode` prop), not
// just a label — but it defaults to "draw" so nothing about today's drag-to-create
// behavior changes for anyone who never touches it.

function CursorIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M3 2.5l9 9-3.6.6-1.4 3.4-4-13z" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DrawBoxIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="9" rx="1" strokeDasharray="2.2 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.6 8.4a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-8.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 4.5v3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.4 8A5 5 0 1 1 5.5 12" strokeLinecap="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M12 4.5v3.5H8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.6 8A5 5 0 1 0 10.5 12" strokeLinecap="round" />
    </svg>
  );
}

interface CanvasEditToolbarProps {
  mode: "select" | "draw";
  onModeChange: (mode: "select" | "draw") => void;
  canDelete: boolean;
  onDelete: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function CanvasEditToolbar({
  mode,
  onModeChange,
  canDelete,
  onDelete,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CanvasEditToolbarProps) {
  return (
    <div className="flex items-center gap-2xs rounded-sm border border-border px-2xs py-2xs">
      <Tooltip content="Select — click a box to select it">
        <IconButton
          aria-label="Select tool"
          size="sm"
          icon={<CursorIcon />}
          active={mode === "select"}
          onClick={() => onModeChange("select")}
        />
      </Tooltip>
      <Tooltip content="Draw Box — drag on the sketch to add a component">
        <IconButton
          aria-label="Draw Box tool"
          size="sm"
          icon={<DrawBoxIcon />}
          active={mode === "draw"}
          onClick={() => onModeChange("draw")}
        />
      </Tooltip>
      <span aria-hidden="true" className={cn("h-4 w-px shrink-0 bg-border")} />
      <Tooltip content="Delete the selected box">
        <IconButton aria-label="Delete selected box" size="sm" icon={<TrashIcon />} onClick={onDelete} disabled={!canDelete} />
      </Tooltip>
      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
      <Tooltip content="Undo (Ctrl/Cmd+Z)">
        <IconButton aria-label="Undo" size="sm" icon={<UndoIcon />} onClick={onUndo} disabled={!canUndo} />
      </Tooltip>
      <Tooltip content="Redo (Ctrl/Cmd+Shift+Z)">
        <IconButton aria-label="Redo" size="sm" icon={<RedoIcon />} onClick={onRedo} disabled={!canRedo} />
      </Tooltip>
    </div>
  );
}
