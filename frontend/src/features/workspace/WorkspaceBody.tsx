import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Panel } from "../../components/Panel.js";
import { Button } from "../../components/Button.js";
import { Drawer } from "../../components/Drawer.js";
import { cn } from "../../components/cn.js";

// the 4-region shell: Layers (left, 240px) / Canvas (center, fluid) / Inspector (right,
// 320px), with a bottom dock spanning the full width. This directly replaces the old
// 3-column layout (canvas / tree+inspector sharing one 256px column / a fixed 480px right
// column) that Phase 1 audit's §4 flagged for starving the canvas on a 1366px laptop and
// squeezing the Inspector under the tree. Every slot below still receives the exact same
// feature components with the exact same props as before — this is a layout rearrangement,
// not new functionality.
//
// Phase 2J — at the tablet tier (768–1023px), Layers/Inspector become toggleable overlay
// Drawers instead of fixed columns, and the canvas takes the full width. The
// `layers`/`canvas`/`inspector`/`dock` content itself is identical in both layouts — only
// how it's framed changes.
//
// The dock's height was a fixed 32%/40% with no way to reclaim that space for the canvas —
// resize/collapse was flagged as a later-phase capability. Design audit 2026-08-26: added a
// collapse toggle (state + the button itself live in ProjectWorkspace, next to the dock's
// own Preview/Code tabs) — `dockCollapsed` just picks which height class applies here, so
// this component stays a plain layout shell.
//
// 2026-08-27 — a fixed 40%/32% still left Preview/Code cramped on anything shorter than a
// large desktop display (a real complaint: "can't see full view" of a generated page or a
// longer code file without constant internal scrolling). Added a drag handle on the dock's
// top edge so the height becomes user-adjustable, in addition to the existing collapse
// toggle — the two are independent controls for the same space, not a replacement of one by
// the other. Height is plain component state, not persisted across reloads (same as the
// canvas's own zoom level), and is ignored while `dockCollapsed` — a collapsed dock stays a
// fixed `h-9` regardless of whatever height was last dragged.

interface WorkspaceBodyProps {
  /** The Pages/Layers/Assets navigator.
   *  Was a bare Layers tree before that change; this slot is otherwise unchanged. */
  navigator: ReactNode;
  canvas: ReactNode;
  inspector: ReactNode;
  dock: ReactNode;
  isTablet?: boolean;
  dockCollapsed?: boolean;
}

const MIN_DOCK_PX = 160;
// Leaves room above the dock for the toolbar/status-bar/canvas-toolbar rows plus a
// sliver of visible canvas — a dock that can swallow the ENTIRE body would hide the
// thing it's previewing, which defeats its own purpose.
const MIN_ABOVE_DOCK_PX = 160;

/** Thin drag handle on the dock's top edge. Read-only about layout — it only reports
 * pixel deltas via `onResize`; the height value itself lives in the caller. */
function DockResizeHandle({ onResize }: { onResize: (deltaY: number) => void }) {
  const draggingRef = useRef(false);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      onResize(e.movementY);
    }
    function handleMouseUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize the preview/code panel"
      tabIndex={0}
      onMouseDown={() => {
        draggingRef.current = true;
      }}
      onKeyDown={(e) => {
        // Keyboard alternative to dragging (§ dragging-alternative) — arrow keys move
        // the same handle in fixed steps, Shift for a larger jump.
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onResize(e.shiftKey ? -40 : -8);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onResize(e.shiftKey ? 40 : 8);
        }
      }}
      // 24px hit area (WCAG 2.2 AA target-size minimum for web pointer targets) even
      // though the visible indicator is a 2px line — the box itself is real flex
      // space, not a negative-margin overlap trick, so it can't paint over or under
      // the canvas/dock it sits between.
      className="group flex h-6 shrink-0 cursor-row-resize touch-none select-none items-center justify-center"
    >
      <div className="h-[2px] w-full bg-transparent transition-colors duration-fast group-hover:bg-primary/40 group-focus-visible:bg-primary" />
    </div>
  );
}

export function WorkspaceBody({ navigator, canvas, inspector, dock, isTablet, dockCollapsed }: WorkspaceBodyProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // null = "use the default percentage" (40% desktop / 32% tablet) until the user
  // deliberately drags, mirroring the canvas's own "fit until you zoom" convention.
  const [dockHeightPx, setDockHeightPx] = useState<number | null>(null);

  const resizeDock = useCallback((deltaY: number) => {
    // Dragging the handle UP shrinks deltaY (negative) and should make the dock
    // TALLER — the dock sits below the handle, so height moves opposite to the
    // pointer's own Y delta.
    setDockHeightPx((prev) => {
      const root = rootRef.current;
      const rootHeight = root?.getBoundingClientRect().height ?? Infinity;
      const base = prev ?? root?.querySelector("[data-dock-panel]")?.getBoundingClientRect().height ?? 300;
      const max = Math.max(MIN_DOCK_PX, rootHeight - MIN_ABOVE_DOCK_PX);
      return Math.min(max, Math.max(MIN_DOCK_PX, base - deltaY));
    });
  }, []);

  const dockStyle = dockCollapsed || dockHeightPx === null ? undefined : { height: dockHeightPx };

  if (isTablet) {
    return (
      <div ref={rootRef} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-xs border-b border-border px-md py-xs">
            <Button variant="secondary" size="sm" onClick={() => setLayersOpen(true)}>
              Pages & Layers
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setInspectorOpen(true)}>
              Inspector
            </Button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">{canvas}</div>
        </div>

        {!dockCollapsed && <DockResizeHandle onResize={resizeDock} />}
        <Panel
          data-dock-panel
          bordered="top"
          className={cn("shrink-0 overflow-hidden", dockCollapsed ? "h-9" : !dockHeightPx && "h-[32%]")}
          style={dockStyle}
        >
          {dock}
        </Panel>

        {/* The Navigator carries its own tab strip, so the Drawer no longer needs a
            SectionHeader naming a single panel — all three views are reachable here. */}
        <Drawer open={layersOpen} onClose={() => setLayersOpen(false)} side="left" title="Navigator">
          <div className="flex flex-1 flex-col overflow-hidden">{navigator}</div>
        </Drawer>

        <Drawer open={inspectorOpen} onClose={() => setInspectorOpen(false)} side="right" title="Inspector">
          <div className="flex flex-1 flex-col overflow-auto">{inspector}</div>
        </Drawer>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* 260px (was 240px) to seat the Navigator's three-tab strip without the
            labels crowding. */}
        <Panel bordered="right" className="flex w-[260px] shrink-0 flex-col overflow-hidden">
          {navigator}
        </Panel>

        <div className="flex flex-1 flex-col overflow-hidden">{canvas}</div>

        <Panel bordered="left" className="flex w-80 shrink-0 flex-col overflow-hidden">
          {inspector}
        </Panel>
      </div>

      {!dockCollapsed && <DockResizeHandle onResize={resizeDock} />}
      <Panel
        data-dock-panel
        bordered="top"
        className={cn("shrink-0 overflow-hidden", dockCollapsed ? "h-9" : !dockHeightPx && "h-[40%]")}
        style={dockStyle}
      >
        {dock}
      </Panel>
    </div>
  );
}
