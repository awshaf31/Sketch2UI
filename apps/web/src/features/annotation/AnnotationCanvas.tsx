import { useCallback, useEffect, useRef, useState } from "react";
import type { BBox, Detection, PagePolygon, ProjectAsset } from "@sketch2ui/shared-types";
import { isContainerClass } from "@sketch2ui/shared-types";
import PageBoundaryOverlay from "../detection/PageBoundaryOverlay.js";

const MIN_BOX_PX = 6;
const HANDLE_SIZE = 8;

type Handle = "nw" | "ne" | "sw" | "se";

type DragState =
  | { kind: "draw"; startX: number; startY: number; currentX: number; currentY: number }
  | { kind: "move"; id: string; grabX: number; grabY: number; original: BBox }
  | { kind: "resize"; id: string; handle: Handle; original: BBox };

interface AnnotationCanvasProps {
  asset: ProjectAsset;
  imageUrl: string;
  detections: Detection[];
  selectedId: string | null;
  activeClass: string;
  onSelect: (id: string | null) => void;
  onCreate: (bbox: BBox) => void;
  onUpdate: (id: string, bbox: BBox) => void;
  onDeleteSelected: () => void;
  /** Section 10.6: the page boundary overlay, when one is known. */
  pageBoundary?: PagePolygon | null;
  boundaryEditable?: boolean;
  onBoundaryChange?: (polygon: PagePolygon) => void;
}

function toPixels(bbox: BBox, asset: ProjectAsset) {
  return {
    x: bbox.x * asset.width,
    y: bbox.y * asset.height,
    width: bbox.width * asset.width,
    height: bbox.height * asset.height,
  };
}

function toNormalized(bboxPx: BBox, asset: ProjectAsset): BBox {
  return {
    x: bboxPx.x / asset.width,
    y: bboxPx.y / asset.height,
    width: bboxPx.width / asset.width,
    height: bboxPx.height / asset.height,
  };
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): BBox {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function applyHandle(original: BBox, handle: Handle, point: { x: number; y: number }): BBox {
  const fixed =
    handle === "nw"
      ? { x: original.x + original.width, y: original.y + original.height }
      : handle === "ne"
        ? { x: original.x, y: original.y + original.height }
        : handle === "sw"
          ? { x: original.x + original.width, y: original.y }
          : { x: original.x, y: original.y };
  return normalizeRect(fixed, point);
}

export default function AnnotationCanvas({
  asset,
  imageUrl,
  detections,
  selectedId,
  activeClass,
  onSelect,
  onCreate,
  onUpdate,
  onDeleteSelected,
  pageBoundary,
  boundaryEditable = false,
  onBoundaryChange,
}: AnnotationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const getImagePoint = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = asset.width / rect.width;
      const scaleY = asset.height / rect.height;
      return {
        x: Math.min(Math.max((e.clientX - rect.left) * scaleX, 0), asset.width),
        y: Math.min(Math.max((e.clientY - rect.top) * scaleY, 0), asset.height),
      };
    },
    [asset.width, asset.height]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        onDeleteSelected();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, onDeleteSelected]);

  // Live drag positions bypass React state churn on the detections array itself.
  const liveOverridesRef = useRef<Record<string, BBox>>({});
  const [, forceRender] = useState(0);

  useEffect(() => {
    const activeDrag = drag;
    if (!activeDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const point = getImagePoint(e);

      if (activeDrag.kind === "draw") {
        setDrag({ ...activeDrag, currentX: point.x, currentY: point.y });
      } else if (activeDrag.kind === "move") {
        const dxPx = point.x - activeDrag.grabX;
        const dyPx = point.y - activeDrag.grabY;
        const moved: BBox = {
          ...activeDrag.original,
          x: activeDrag.original.x + dxPx,
          y: activeDrag.original.y + dyPx,
        };
        liveOverridesRef.current[activeDrag.id] = moved;
        forceRender((n) => n + 1);
      } else if (activeDrag.kind === "resize") {
        const resized = applyHandle(activeDrag.original, activeDrag.handle, point);
        liveOverridesRef.current[activeDrag.id] = resized;
        forceRender((n) => n + 1);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const point = getImagePoint(e);
      if (activeDrag.kind === "draw") {
        const bboxPx = normalizeRect(
          { x: activeDrag.startX, y: activeDrag.startY },
          { x: point.x, y: point.y }
        );
        if (bboxPx.width > MIN_BOX_PX && bboxPx.height > MIN_BOX_PX) {
          onCreate(toNormalized(bboxPx, asset));
        } else {
          onSelect(null);
        }
      } else if (activeDrag.kind === "move" || activeDrag.kind === "resize") {
        const finalBbox = liveOverridesRef.current[activeDrag.id];
        delete liveOverridesRef.current[activeDrag.id];
        if (finalBbox) onUpdate(activeDrag.id, toNormalized(finalBbox, asset));
      }
      setDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, asset]);

  function pixelBBoxFor(detection: Detection): BBox {
    return liveOverridesRef.current[detection.id] ?? toPixels(detection.bbox, asset);
  }

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${asset.width} / ${asset.height}` }}>
      <img
        src={imageUrl}
        alt="Sketch"
        className="pointer-events-none absolute inset-0 h-full w-full"
        draggable={false}
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${asset.width} ${asset.height}`}
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onMouseDown={(e) => {
          if (e.target !== svgRef.current) return;
          const point = getImagePoint(e);
          onSelect(null);
          setDrag({ kind: "draw", startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
        }}
      >
        {detections.map((detection) => {
          const box = pixelBBoxFor(detection);
          const selected = detection.id === selectedId;
          const container = isContainerClass(detection.className);
          // Model-sourced boxes get a distinct colour and a dashed outline, following
          // the same "distinct colour" convention the plan uses for the page boundary
          // (sections 6.4 / 10.6). Correcting one turns it manual, and it restyles.
          const fromModel = detection.source === "model";
          // Section 10.7: a box outside the page boundary is kept and shown dimmed,
          // not deleted. Dragging the boundary to include it makes it fully opaque
          // again with no re-detect.
          const rejected = detection.status === "rejected";
          const stroke = selected
            ? "#f97316"
            : fromModel
              ? "#a855f7"
              : container
                ? "#2563eb"
                : "#10b981";
          return (
            <g key={detection.id} opacity={rejected && !selected ? 0.35 : 1}>
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={
                  selected
                    ? "rgba(249,115,22,0.08)"
                    : fromModel
                      ? "rgba(168,85,247,0.06)"
                      : "rgba(37,99,235,0.05)"
                }
                stroke={stroke}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray={fromModel && !selected ? "6 3" : undefined}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect(detection.id);
                  const point = getImagePoint(e);
                  setDrag({ kind: "move", id: detection.id, grabX: point.x, grabY: point.y, original: box });
                }}
              />
              <text
                x={box.x + 4}
                y={box.y + 14}
                fontSize={12}
                fill={selected ? "#f97316" : fromModel ? "#7e22ce" : "#1f2937"}
                style={{ pointerEvents: "none", fontFamily: "system-ui, sans-serif" }}
              >
                {detection.className}
                {fromModel ? ` ${detection.confidence.toFixed(2)}` : ""}
                {rejected ? " · outside page" : ""}
              </text>
              {selected &&
                (["nw", "ne", "sw", "se"] as Handle[]).map((handle) => {
                  const hx = handle.includes("w") ? box.x : box.x + box.width;
                  const hy = handle.includes("n") ? box.y : box.y + box.height;
                  return (
                    <rect
                      key={handle}
                      x={hx - HANDLE_SIZE / 2}
                      y={hy - HANDLE_SIZE / 2}
                      width={HANDLE_SIZE}
                      height={HANDLE_SIZE}
                      fill="#f97316"
                      style={{ cursor: `${handle}-resize` }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDrag({ kind: "resize", id: detection.id, handle, original: box });
                      }}
                    />
                  );
                })}
            </g>
          );
        })}

        {pageBoundary && (
          <PageBoundaryOverlay
            asset={asset}
            polygon={pageBoundary}
            editable={boundaryEditable}
            onChange={onBoundaryChange ?? (() => {})}
            toImagePoint={getImagePoint}
          />
        )}

        {drag?.kind === "draw" && (
          <rect
            x={Math.min(drag.startX, drag.currentX)}
            y={Math.min(drag.startY, drag.currentY)}
            width={Math.abs(drag.currentX - drag.startX)}
            height={Math.abs(drag.currentY - drag.startY)}
            fill="rgba(249,115,22,0.1)"
            stroke="#f97316"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
      </svg>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        Drawing as: <strong>{activeClass}</strong> · drag to draw · click box to select · Delete to remove
      </p>
    </div>
  );
}
