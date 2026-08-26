import { useState } from "react";
import type { ReactNode } from "react";
import { Tab, Tabs } from "../../components/Tabs.js";

// docs/design/FINAL_SAAS_DESIGN_DIRECTION.md §6 (Gap 2) — the workspace's left panel
// becomes one Navigator holding three structural views, per the visual-builder
// reference in uiux/: Pages · Layers · Assets.
//
// A dumb shell on purpose: it owns which tab is showing and nothing else. Each panel
// keeps its own props and its own state, so this file never has to know about pages,
// the UI-IR tree, or assets.
//
// Two decisions worth not re-litigating:
//  - Default tab is Layers. The detect -> review -> correct loop is the product's
//    core, and the tree is where that loop lives.
//  - The selection PERSISTS across page switches rather than resetting. Someone
//    managing pages stays in Pages instead of being thrown back to Layers on every
//    click, which is what a reset would do at exactly the wrong moment.

type NavigatorTab = "pages" | "layers" | "assets";

interface WorkspaceNavigatorProps {
  pages: ReactNode;
  layers: ReactNode;
  assets: ReactNode;
}

export function WorkspaceNavigator({ pages, layers, assets }: WorkspaceNavigatorProps) {
  const [tab, setTab] = useState<NavigatorTab>("layers");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs
        value={tab}
        onChange={(v) => setTab(v as NavigatorTab)}
        aria-label="Workspace navigator"
        className="shrink-0"
      >
        <Tab value="pages">Pages</Tab>
        <Tab value="layers">Layers</Tab>
        <Tab value="assets">Assets</Tab>
      </Tabs>

      {/* Only the active panel is mounted. The tree in particular is the expensive one
          to keep alive, and none of the three hold unsaved input that a remount would
          lose (page rename commits on blur). */}
      <div className="flex-1 overflow-y-auto">
        {tab === "pages" && pages}
        {tab === "layers" && layers}
        {tab === "assets" && assets}
      </div>
    </div>
  );
}
