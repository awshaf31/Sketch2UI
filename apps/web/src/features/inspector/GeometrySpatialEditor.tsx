import { useEffect, useRef, useState } from "react";
import type { BBox } from "@sketch2ui/shared-types";
import { cn } from "../../components/cn.js";

// docs/frontend/SKETCH2UI_REDESIGN_BLUEPRINT_2026-08-27.md — Mockup 1 (Geometry
// spatial editor). Supplementary illustration of the SAME geometryDraft state
// InspectorPanel's numeric x/y/width/height fields already own — this component never
// holds its own copy of the geometry, it only reads `bbox`/`draft` and calls
// `onDraftChange`, exactly like typing into one of those fields already does. Diagram
// is `aria-hidden`: the four numeric fields (rendered by InspectorPanel, unchanged)
// remain the sole accessible/keyboard interaction path (blueprint Accessibility §).
//
// Per-handle field mapping is deliberately simple rather than the anchor-preserving
// corner resize AnnotationCanvas.tsx uses for the sketch canvas: each handle writes
// only the field(s) whose value defines that handle's own position (a corner handle
// touches the two fields at that corner, an edge handle touches the one field for that
// edge) — see the blueprint's Mockup 1 interaction section for the exact spec this
// mirrors.

type GeometryDraft = Record<"x" | "y" | "width" | "height", string>;
type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const DIAGRAM_W = 368;
const DIAGRAM_H = 224;
const INSET = 12;
const INNER_W = DIAGRAM_W - INSET * 2;
const INNER_H = DIAGRAM_H - INSET * 2;
const MIN_SIZE = 0.01;
const HIT_SIZE = 24;
const HANDLE_SIZE = 6;

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_FIELDS: Record<Handle, Array<keyof GeometryDraft>> = {
  nw: ["x", "y"],
  n: ["y"],
  ne: ["y", "width"],
  e: ["width"],
  se: ["width", "height"],
  s: ["height"],
  sw: ["x", "height"],
  w: ["x"],
};

const CURSORS: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

const SHORT_LABEL: Record<keyof GeometryDraft, string> = { x: "x", y: "y", width: "w", height: "h" };

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function readNumber(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

interface EffectiveGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

function effectiveGeometry(bbox: BBox, draft: GeometryDraft): EffectiveGeometry {
  return {
    x: readNumber(draft.x, bbox.x),
    y: readNumber(draft.y, bbox.y),
    width: readNumber(draft.width, bbox.width),
    height: readNumber(draft.height, bbox.height),
  };
}

function handlePosition(handle: Handle, x: number, y: number, w: number, h: number): { x: number; y: number } {
  const left = x;
  const right = x + w;
  const top = y;
  const bottom = y + h;
  const midX = x + w / 2;
  const midY = y + h / 2;
  switch (handle) {
    case "nw":
      return { x: left, y: top };
    case "n":
      return { x: midX, y: top };
    case "ne":
      return { x: right, y: top };
    case "e":
      return { x: right, y: midY };
    case "se":
      return { x: right, y: bottom };
    case "s":
      return { x: midX, y: bottom };
    case "sw":
      return { x: left, y: bottom };
    case "w":
      return { x: left, y: midY };
  }
}

interface DragState {
  handle: Handle;
  startClientX: number;
  startClientY: number;
  scaleX: number;
  scaleY: number;
  base: EffectiveGeometry;
}

interface GeometrySpatialEditorProps {
  /** The raw detection bbox — the "inherit" fallback for any field left blank. */
  bbox: BBox;
  /** Same draft object InspectorPanel's numeric fields read/write. */
  draft: GeometryDraft;
  onDraftChange: (next: GeometryDraft) => void;
  disabled?: boolean;
}

export function GeometrySpatialEditor({ bbox, draft, onDraftChange, disabled }: GeometrySpatialEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<Handle | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Kept fresh every render so the mousemove listener (subscribed only when `drag`
  // changes, not on every keystroke/drag-tick) always merges against the latest draft
  // and calls the latest onDraftChange, without re-subscribing on every value change.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  useEffect(() => {
    if (!drag) return;
    const active = drag;

    function handleMove(e: MouseEvent) {
      const dx = (e.clientX - active.startClientX) / active.scaleX / INNER_W;
      const dy = (e.clientY - active.startClientY) / active.scaleY / INNER_H;

      const fields = HANDLE_FIELDS[active.handle];
      const next = { ...draftRef.current };
      if (fields.includes("x")) next.x = String(round4(clamp(active.base.x + dx, 0, 1)));
      if (fields.includes("y")) next.y = String(round4(clamp(active.base.y + dy, 0, 1)));
      if (fields.includes("width")) next.width = String(round4(clamp(active.base.width + dx, MIN_SIZE, 1)));
      if (fields.includes("height")) next.height = String(round4(clamp(active.base.height + dy, MIN_SIZE, 1)));
      onDraftChangeRef.current(next);
    }

    function handleUp() {
      setDrag(null);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag]);

  function beginDrag(handle: Handle, e: React.MouseEvent) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setDrag({
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      scaleX: rect.width / DIAGRAM_W,
      scaleY: rect.height / DIAGRAM_H,
      base: effectiveGeometry(bbox, draft),
    });
  }

  const eff = effectiveGeometry(bbox, draft);
  const hasOverride = (["x", "y", "width", "height"] as const).some((k) => draft[k].trim() !== "");
  const activeHandle = drag?.handle ?? null;
  const isDragging = activeHandle !== null;
  const overridden = isDragging || hasOverride;

  const boxX = INSET + eff.x * INNER_W;
  const boxY = INSET + eff.y * INNER_H;
  const boxW = eff.width * INNER_W;
  const boxH = eff.height * INNER_H;

  const chipHandle = activeHandle ?? hovered;
  let chip: { x: number; y: number; text: string } | null = null;
  if (chipHandle) {
    const pos = handlePosition(chipHandle, boxX, boxY, boxW, boxH);
    const text = HANDLE_FIELDS[chipHandle].map((f) => `${SHORT_LABEL[f]} ${eff[f].toFixed(4)}`).join("  ");
    const chipW = 16 + text.length * 5;
    chip = { x: clamp(pos.x - chipW / 2, 2, DIAGRAM_W - chipW - 2), y: Math.max(2, pos.y - 26), text };
  }

  return (
    <div className="px-md pb-sm" aria-hidden="true">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`}
        width="100%"
        style={{ maxWidth: DIAGRAM_W, minWidth: 180, display: "block" }}
        className="select-none border border-border bg-surface"
      >
        {/* Page boundary — the same page-boundary token the annotation canvas uses. */}
        <rect
          x={INSET}
          y={INSET}
          width={INNER_W}
          height={INNER_H}
          fill="none"
          strokeWidth={1}
          strokeDasharray="4 3"
          className="stroke-page-boundary"
        />

        {/* Guide lines: x/y direct, plus the two derived margins to the far edges. */}
        <g
          className={cn(isDragging ? "stroke-selection" : "stroke-border-strong")}
          strokeWidth={1}
          strokeDasharray="2 2"
        >
          <line x1={INSET} y1={boxY + boxH / 2} x2={boxX} y2={boxY + boxH / 2} />
          <line x1={boxX + boxW / 2} y1={INSET} x2={boxX + boxW / 2} y2={boxY} />
          <line x1={boxX + boxW} y1={boxY + boxH / 2} x2={INSET + INNER_W} y2={boxY + boxH / 2} />
          <line x1={boxX + boxW / 2} y1={boxY + boxH} x2={boxX + boxW / 2} y2={INSET + INNER_H} />
        </g>

        <text x={(INSET + boxX) / 2} y={boxY + boxH / 2 - 4} textAnchor="middle" fontSize={9} className="fill-text-muted font-mono">
          {eff.x.toFixed(2)}
        </text>
        <text x={boxX + boxW / 2} y={(INSET + boxY) / 2} textAnchor="middle" fontSize={9} className="fill-text-muted font-mono">
          {eff.y.toFixed(2)}
        </text>
        <text
          x={(boxX + boxW + INSET + INNER_W) / 2}
          y={boxY + boxH / 2 - 4}
          textAnchor="middle"
          fontSize={9}
          className="fill-text-muted font-mono"
        >
          {(1 - eff.x - eff.width).toFixed(2)}
        </text>
        <text
          x={boxX + boxW / 2}
          y={(boxY + boxH + INSET + INNER_H) / 2}
          textAnchor="middle"
          fontSize={9}
          className="fill-text-muted font-mono"
        >
          {(1 - eff.y - eff.height).toFixed(2)}
        </text>

        {/* Selected-detection rectangle — dashed/unfilled while inherited, solid/tinted
            once overridden or actively being dragged. */}
        <rect
          x={boxX}
          y={boxY}
          width={boxW}
          height={boxH}
          strokeWidth={1.5}
          strokeDasharray={overridden ? undefined : "4 3"}
          className={overridden ? "stroke-selection fill-selection-subtle" : "stroke-border-strong fill-none"}
        />

        {HANDLES.map((handle) => {
          const pos = handlePosition(handle, boxX, boxY, boxW, boxH);
          const isActive = activeHandle === handle;
          const isHovered = hovered === handle && !isDragging;
          const size = isActive || isHovered ? HANDLE_SIZE + 2 : HANDLE_SIZE;
          return (
            <g key={handle}>
              <rect
                x={pos.x - HIT_SIZE / 2}
                y={pos.y - HIT_SIZE / 2}
                width={HIT_SIZE}
                height={HIT_SIZE}
                fill="transparent"
                style={{ cursor: disabled ? "default" : CURSORS[handle], pointerEvents: disabled ? "none" : "auto" }}
                onMouseDown={(e) => beginDrag(handle, e)}
                onMouseEnter={() => setHovered(handle)}
                onMouseLeave={() => setHovered((h) => (h === handle ? null : h))}
              />
              <rect
                x={pos.x - size / 2}
                y={pos.y - size / 2}
                width={size}
                height={size}
                strokeWidth={1.5}
                className={cn(
                  "pointer-events-none",
                  isActive
                    ? "fill-primary stroke-primary-active"
                    : isHovered
                      ? "fill-selection stroke-selection"
                      : "fill-surface stroke-selection"
                )}
              />
            </g>
          );
        })}

        {chip && (
          <g className="pointer-events-none">
            <rect x={chip.x} y={chip.y} width={16 + chip.text.length * 5} height={16} rx={2} className="fill-text-primary" />
            <text
              x={chip.x + 8 + (chip.text.length * 5) / 2}
              y={chip.y + 11}
              textAnchor="middle"
              fontSize={9}
              className="fill-text-inverse font-mono"
            >
              {chip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
