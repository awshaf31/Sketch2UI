import { useCallback, useEffect, useRef, useState } from "react";
import type { BBox, PagePolygon, ProjectAsset } from "@sketch2ui/shared-types";
import { bboxToPolygon, polygonBounds } from "@sketch2ui/shared-types";

// Page boundary overlay — plan section 10.6 ("show page boundary in a distinct color…
// allow the user to resize the boundary") and 10.3 Strategy C (manual fallback).
//
// Editing reuses the drag/resize interaction already established by AnnotationCanvas
// rather than introducing a second editor: this is one special region, not a new tool.
// Dragging edits the polygon's axis-aligned bounds, which is the right affordance for
// correcting a boundary; a detected quad may be slightly skewed and is rendered as such
// until the user touches it.

const HANDLE_SIZE = 10;
const MIN_SIZE = 0.02;

type Handle = "nw" | "ne" | "sw" | "se";

type Drag =
  | { kind: "move"; grabX: number; grabY: number; original: BBox }
  | { kind: "resize"; handle: Handle; original: BBox };

interface PageBoundaryOverlayProps {
  asset: ProjectAsset;
  polygon: PagePolygon;
  editable: boolean;
  onChange: (polygon: PagePolygon) => void;
  /** Image-space point from a mouse event, supplied by the parent canvas. */
  toImagePoint: (e: MouseEvent | React.MouseEvent) => { x: number; y: number };
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): BBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export default function PageBoundaryOverlay({
  asset,
  polygon,
  editable,
  onChange,
  toImagePoint,
}: PageBoundaryOverlayProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const liveRef = useRef<BBox | null>(null);
  const [, forceRender] = useState(0);

  const toNormalized = useCallback(
    (p: { x: number; y: number }) => ({ x: p.x / asset.width, y: p.y / asset.height }),
    [asset.width, asset.height]
  );

  useEffect(() => {
    const active = drag;
    if (!active) return;

    const handleMove = (e: MouseEvent) => {
      const point = toNormalized(toImagePoint(e));

      if (active.kind === "move") {
        const dx = point.x - active.grabX;
        const dy = point.y - active.grabY;
        liveRef.current = {
          ...active.original,
          x: clamp01(active.original.x + dx),
          y: clamp01(active.original.y + dy),
        };
      } else {
        const o = active.original;
        const fixed =
          active.handle === "nw"
            ? { x: o.x + o.width, y: o.y + o.height }
            : active.handle === "ne"
              ? { x: o.x, y: o.y + o.height }
              : active.handle === "sw"
                ? { x: o.x + o.width, y: o.y }
                : { x: o.x, y: o.y };
        const next = normalizeRect(fixed, { x: clamp01(point.x), y: clamp01(point.y) });
        liveRef.current = {
          x: next.x,
          y: next.y,
          width: Math.max(next.width, MIN_SIZE),
          height: Math.max(next.height, MIN_SIZE),
        };
      }
      forceRender((n) => n + 1);
    };

    const handleUp = () => {
      const finalBox = liveRef.current;
      liveRef.current = null;
      setDrag(null);
      if (finalBox) onChange(bboxToPolygon(finalBox));
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [drag, onChange, toImagePoint, toNormalized]);

  // While dragging, show the live axis-aligned rect; otherwise the polygon as detected
  // (which may be a slightly skewed quad).
  const live = liveRef.current;
  const points = live ? bboxToPolygon(live) : polygon;
  const pixelPoints = points
    .map(([x, y]) => `${x * asset.width},${y * asset.height}`)
    .join(" ");

  const bounds = polygonBounds(points);
  const px = {
    x: bounds.x * asset.width,
    y: bounds.y * asset.height,
    width: bounds.width * asset.width,
    height: bounds.height * asset.height,
  };

  return (
    <g>
      {/* Everything outside the boundary is dimmed, so the page region reads as the
          area in play. evenodd punches the polygon out of a full-frame rect. */}
      <path
        d={`M0,0 H${asset.width} V${asset.height} H0 Z M${points
          .map(([x, y]) => `${x * asset.width},${y * asset.height}`)
          .join(" L")} Z`}
        fillRule="evenodd"
        fill="rgba(15,23,42,0.30)"
        style={{ pointerEvents: "none" }}
      />
      <polygon
        points={pixelPoints}
        fill="none"
        stroke="#e11d48"
        strokeWidth={3}
        strokeDasharray="10 5"
        style={{ pointerEvents: editable ? "auto" : "none", cursor: editable ? "move" : "default" }}
        onMouseDown={(e) => {
          if (!editable) return;
          e.stopPropagation();
          const point = toNormalized(toImagePoint(e));
          setDrag({ kind: "move", grabX: point.x, grabY: point.y, original: bounds });
        }}
      />
      {editable &&
        (["nw", "ne", "sw", "se"] as Handle[]).map((handle) => {
          const hx = handle.includes("w") ? px.x : px.x + px.width;
          const hy = handle.includes("n") ? px.y : px.y + px.height;
          return (
            <rect
              key={handle}
              x={hx - HANDLE_SIZE / 2}
              y={hy - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill="#e11d48"
              stroke="#fff"
              strokeWidth={1.5}
              style={{ cursor: `${handle}-resize` }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDrag({ kind: "resize", handle, original: bounds });
              }}
            />
          );
        })}
    </g>
  );
}
