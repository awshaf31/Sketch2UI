import { useState } from "react";
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

export function WorkspaceBody({ navigator, canvas, inspector, dock, isTablet, dockCollapsed }: WorkspaceBodyProps) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  if (isTablet) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
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

        <Panel
          bordered="top"
          className={cn("shrink-0 overflow-hidden", dockCollapsed ? "h-9" : "h-[32%]")}
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
    <div className="flex flex-1 flex-col overflow-hidden">
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

      <Panel
        bordered="top"
        className={cn("shrink-0 overflow-hidden", dockCollapsed ? "h-9" : "h-[40%]")}
      >
        {dock}
      </Panel>
    </div>
  );
}
