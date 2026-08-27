import { useCallback, useEffect, useRef, useState } from "react";
import type { BBox, Detection, PagePolygon, ProjectAsset } from "@sketch2ui/shared-types";
import { isContainerClass } from "@sketch2ui/shared-types";
import PageBoundaryOverlay from "../detection/PageBoundaryOverlay.js";
import { cn } from "../../components/cn.js";

const MIN_BOX_PX = 6;
const HANDLE_SIZE = 8;

// every detection state is encoded on at least two channels (color + stroke
// pattern/weight/opacity), never color alone; this table is the same state→color mapping
// the app already had, expressed as Tailwind's fill-*/stroke-* utilities against the token
// palette instead of hardcoded hex literals repeated at each call site. A detection's label
// text now matches its own box color exactly (the original hardcoded a separate flat
// gray/#7e22ce for text regardless of class) — a small, deliberate consistency improvement,
// not a functional change.
type DetectionTone = "selected" | "model" | "container" | "manual";

function detectionTone(detection: Detection, selected: boolean): DetectionTone {
  if (selected) return "selected";
  if (detection.source === "model") return "model";
  return isContainerClass(detection.className) ? "container" : "manual";
}

const STROKE_CLASS: Record<DetectionTone, string> = {
  selected: "stroke-selection",
  model: "stroke-detection-model",
  container: "stroke-primary",
  manual: "stroke-detection-manual",
};

// Color only — NOT combined with Tailwind's `/<n>` opacity-modifier shorthand. That
// shorthand only compiles for values in Tailwind's default opacity scale (multiples of
// 5); `fill-selection/8` and `fill-detection-model/6` silently failed to generate any
// CSS at all, so the browser fell back to SVG's own built-in default — solid opaque
// black — for every "selected" and "model" box (the two most common tones). That
// silent failure is the confirmed root cause of detections rendering as large solid
// black regions instead of a subtle tint. Fill-opacity below is applied as a plain
// numeric SVG prop instead, which needs no CSS generation step at all and can't
// silently vanish the same way for any future opacity value.
const FILL_CLASS: Record<DetectionTone, string> = {
  selected: "fill-selection",
  model: "fill-detection-model",
  container: "fill-primary",
  manual: "fill-detection-manual",
};

const FILL_OPACITY: Record<DetectionTone, number> = {
  selected: 0.08,
  model: 0.06,
  container: 0.05,
  manual: 0.05,
};

const TEXT_FILL_CLASS: Record<DetectionTone, string> = {
  selected: "fill-selection",
  model: "fill-detection-model",
  container: "fill-primary",
  manual: "fill-detection-manual",
};

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
  // Design audit 2026-08-26: a real 21-detection sketch made every box's always-on "class
  // 0.NN" label unreadable clutter, especially in dense grids. Confidence now only shows
  // for the selected or hovered detection — every box still gets a lightweight class label
  // at rest, so scanning still works, just without the constant number noise.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // keyboard nudge for the selected detection: arrow keys move it by a 1px-equivalent step,
  // Shift+arrow by 10px. A new, separate effect (not folded into the delete handler above)
  // so this addition is easy to review and revert independently of the existing
  // keyboard-delete behavior. Reuses the same `onUpdate` callback the mouse-drag path
  // already calls — no new mutation surface.
  useEffect(() => {
    function handleArrowNudge(e: KeyboardEvent) {
      if (!selectedId) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA") return;
      const detection = detections.find((d) => d.id === selectedId);
      if (!detection) return;
      e.preventDefault();

      const stepX = (e.shiftKey ? 10 : 1) / asset.width;
      const stepY = (e.shiftKey ? 10 : 1) / asset.height;
      let { x, y } = detection.bbox;
      if (e.key === "ArrowUp") y -= stepY;
      if (e.key === "ArrowDown") y += stepY;
      if (e.key === "ArrowLeft") x -= stepX;
      if (e.key === "ArrowRight") x += stepX;
      // Keep the box fully on the sketch, matching the drag path's implicit bound.
      x = Math.min(Math.max(x, 0), Math.max(0, 1 - detection.bbox.width));
      y = Math.min(Math.max(y, 0), Math.max(0, 1 - detection.bbox.height));

      onUpdate(selectedId, { ...detection.bbox, x, y });
    }
    window.addEventListener("keydown", handleArrowNudge);
    return () => window.removeEventListener("keydown", handleArrowNudge);
  }, [selectedId, detections, asset.width, asset.height, onUpdate]);

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
        // A resize dragged past (or onto) its own fixed corner collapses to near-zero
        // size. The backend doesn't reject this (no width/height validation on the
        // detection PATCH route), so an unguarded commit would silently persist an
        // invisible, effectively unselectable detection. Drop the gesture instead —
        // deleting the live override above already reverts the box to its pre-drag
        // bbox with no network call.
        if (finalBbox && finalBbox.width > MIN_BOX_PX && finalBbox.height > MIN_BOX_PX) {
          onUpdate(activeDrag.id, toNormalized(finalBbox, asset));
        }
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

  // SVG paints later elements on top, and a filled (even low-opacity) rect intercepts
  // pointer events across its whole area — so whichever detection happens to come
  // LATER in `detections` wins every click in an overlap, regardless of which one is
  // visually "inside" the other. A large container (e.g. "section") that happens to be
  // ordered after a small nested one (e.g. a "button" fully inside it) then makes that
  // inner detection permanently unclickable, since the container's rect always paints
  // over it. Sorting smaller-on-top fixes this without touching any stored order,
  // geometry, or the `detections` prop itself (this is a render-order-only derived
  // list, never written back).
  //
  // Deliberately NOT also forcing the selected detection to render on top regardless
  // of size: an earlier version of this fix did that (to keep resize handles from
  // ever being occluded), but it silently reintroduces the exact bug this fix exists
  // to solve — once a large box is selected, it would permanently block clicking
  // through to any smaller box nested inside it, which is precisely the "can't select
  // the thing inside" complaint. A nested child is by definition inside its parent's
  // edges, so it essentially never overlaps the parent's corner handles in practice;
  // that small risk is far better than reintroducing the original bug.
  const renderOrder = [...detections].sort(
    (a, b) => b.bbox.width * b.bbox.height - a.bbox.width * a.bbox.height
  );

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
        role="application"
        aria-label={`Sketch annotation canvas, ${detections.length} detection${detections.length === 1 ? "" : "s"}. Tab to a detection to focus it, Enter to select, arrow keys to nudge the selected one.`}
        onMouseDown={(e) => {
          if (e.target !== svgRef.current) return;
          const point = getImagePoint(e);
          onSelect(null);
          setDrag({ kind: "draw", startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
        }}
      >
        {renderOrder.map((detection) => {
          const box = pixelBBoxFor(detection);
          const selected = detection.id === selectedId;
          // Model-sourced boxes get a distinct colour and a dashed outline, following
          // the same "distinct colour" convention the plan uses for the page boundary
          // (sections 6.4 / 10.6). Correcting one turns it manual, and it restyles.
          const fromModel = detection.source === "model";
          // Section 10.7: a box outside the page boundary is kept and shown dimmed,
          // not deleted. Dragging the boundary to include it makes it fully opaque
          // again with no re-detect.
          const rejected = detection.status === "rejected";
          const tone = detectionTone(detection, selected);
          // Rejected (outside the page boundary) detections read as unambiguously
          // "excluded" — true neutral gray, not just a dimmer version of their own
          // class color — while still keeping the opacity dip below for a second,
          // independent signal (the "at least two channels" rule).
          const muted = rejected && !selected;
          const strokeClass = muted ? "stroke-text-muted" : STROKE_CLASS[tone];
          const fillClass = muted ? "fill-text-muted" : FILL_CLASS[tone];
          const fillOpacity = muted ? 0.05 : FILL_OPACITY[tone];
          const textClass = muted ? "fill-text-muted" : TEXT_FILL_CLASS[tone];
          const hovered = detection.id === hoveredId;
          // Confidence is detail, not identity — only worth showing once a detection
          // has the user's attention. At rest, every box still gets its class name so
          // scanning many detections at once still works, just without the clutter of
          // 20+ decimal scores fighting for space in a dense sketch.
          const showConfidence = fromModel && (selected || hovered);
          return (
            <g
              key={detection.id}
              opacity={rejected && !selected ? 0.35 : 1}
              onMouseEnter={() => setHoveredId(detection.id)}
              onMouseLeave={() => setHoveredId((current) => (current === detection.id ? null : current))}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                className={cn(fillClass, "focus-visible:outline focus-visible:outline-2 focus-visible:outline-selection", strokeClass)}
                fillOpacity={fillOpacity}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray={fromModel && !selected ? "6 3" : undefined}
                tabIndex={0}
                role="button"
                aria-pressed={selected}
                aria-label={`${detection.className}${fromModel ? `, model-detected, ${Math.round(detection.confidence * 100)}% confidence` : ", manual"}${rejected ? ", outside page" : ""}`}
                onFocus={() => setHoveredId(detection.id)}
                onBlur={() => setHoveredId((current) => (current === detection.id ? null : current))}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSelect(detection.id);
                  const point = getImagePoint(e);
                  setDrag({ kind: "move", id: detection.id, grabX: point.x, grabY: point.y, original: box });
                }}
                onKeyDown={(e) => {
                  // Tab already reaches every detection via native focus order (each
                  // rect is a real tabbable element) — this only handles activating
                  // the focused one, matching the "focus ≠ select" convention the rest
                  // of the app already uses (e.g. a focused button isn't "clicked").
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(detection.id);
                  }
                }}
              />
              <text
                x={box.x + 4}
                y={box.y + 14}
                className={cn(
                  "pointer-events-none stroke-surface font-mono text-2xs",
                  textClass,
                  !selected && !hovered && "opacity-70"
                )}
                style={{ paintOrder: "stroke", strokeWidth: 3, strokeLinejoin: "round" }}
              >
                {detection.className}
                {showConfidence ? ` ${detection.confidence.toFixed(2)}` : ""}
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
                      className="fill-selection focus-visible:outline focus-visible:outline-2 focus-visible:outline-selection"
                      style={{ cursor: `${handle}-resize` }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Resize ${detection.className} from the ${handle.toUpperCase()} corner. Arrow keys move this corner; hold Shift to move it further.`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDrag({ kind: "resize", id: detection.id, handle, original: box });
                      }}
                      // QA audit DEF-011: resize had no keyboard path at all. Mirrors the
                      // whole-box arrow-nudge handler above — same step sizes
                      // (1px-equivalent, 10px with Shift), same "commit immediately, no
                      // drag state" model — but moves only THIS corner, via the same
                      // `applyHandle` function the mouse-drag resize path already uses, so
                      // a keyboard resize from a given corner behaves identically to
                      // dragging that corner by the same amount. `stopPropagation` is
                      // required: without it this keydown would also bubble to the
                      // window-level arrow-nudge listener above and move the WHOLE box on
                      // top of this resize.
                      onKeyDown={(e) => {
                        if (
                          e.key !== "ArrowUp" &&
                          e.key !== "ArrowDown" &&
                          e.key !== "ArrowLeft" &&
                          e.key !== "ArrowRight"
                        ) {
                          return;
                        }
                        e.preventDefault();
                        e.stopPropagation();
                        const step = e.shiftKey ? 10 : 1;
                        let point = { x: hx, y: hy };
                        if (e.key === "ArrowUp") point = { ...point, y: point.y - step };
                        if (e.key === "ArrowDown") point = { ...point, y: point.y + step };
                        if (e.key === "ArrowLeft") point = { ...point, x: point.x - step };
                        if (e.key === "ArrowRight") point = { ...point, x: point.x + step };
                        point = {
                          x: Math.min(Math.max(point.x, 0), asset.width),
                          y: Math.min(Math.max(point.y, 0), asset.height),
                        };
                        const resized = applyHandle(box, handle, point);
                        // Same collapse guard the mouse-drag resize commit uses (see
                        // handleMouseUp above) — a handle nudged past its own fixed
                        // corner must not persist a near-zero-size, unselectable box.
                        if (resized.width > MIN_BOX_PX && resized.height > MIN_BOX_PX) {
                          onUpdate(detection.id, toNormalized(resized, asset));
                        }
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
            className="fill-selection/10 stroke-selection"
            strokeDasharray="4 3"
            strokeWidth={1.5}
          />
        )}
      </svg>
      <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-text-primary/60 px-2 py-1 text-xs text-text-inverse">
        Drawing as: <strong>{activeClass}</strong> · drag to draw · click box to select · Delete to remove
      </p>
    </div>
  );
}
