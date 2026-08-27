import { useState } from "react";
import type { UINode, UIRoot } from "@sketch2ui/shared-types";
import { cn } from "../../components/cn.js";
import { EmptyState } from "../../components/EmptyState.js";

// Tree Node. Restyled onto tokens; adds a per-type icon (replacing the bare font-mono type
// label as the primary visual — the label moves to a secondary position, still present) and
// a collapse/expand chevron for any node with children (both new).
//
// DOM-shape constraint: e2e/golden-path.spec.ts and e2e/inspector-overrides.spec.ts
// both locate a tree row via `page.locator("ul.p-2 > li > button").first()` — the
// root <ul className="p-2"> and each <li>'s single direct-child <button> are
// preserved EXACTLY. The chevron is a plain <span onClick> nested INSIDE that button
// (not a second sibling <button>), so `<li>`'s direct-child-button count and position
// are unchanged. A <span> has no HTML content-model restriction the way a nested
// <button>/tabindex element would, so this stays valid markup; the tradeoff is the
// chevron is mouse-only for now (stopPropagation keeps a chevron click from also
// selecting the row) — full keyboard tree navigation (arrow keys, →/← to expand/
// collapse) is Phase 2J's accessibility scope, not this one.

interface UITreePanelProps {
  root: UIRoot;
  selectedDetectionId: string | null;
  onSelect: (detectionId: string | null) => void;
  /** Ids of detections produced by the detector, marked so model-derived nodes are
   *  visually distinct from hand-drawn ones (same convention as the canvas). */
  modelDetectionIds: ReadonlySet<string>;
}

type IconFamily = "container" | "text" | "media" | "interactive" | "list";

// A small set of icon families rather than one glyph per taxonomy class (41+ classes)
// — differentiates the tree at a glance without 41 hand-drawn SVGs for a first pass.
// Unlisted/synthetic types (e.g. the layout engine's "group" nodes) fall back to
// "container", a safe default since most of them are structural.
const CONTAINER_TYPES = new Set([
  "page", "header", "section", "footer", "navbar", "sidebar", "form", "card", "table", "group",
]);
const TEXT_TYPES = new Set(["heading", "text", "card_title", "card_text", "testimonial"]);
const MEDIA_TYPES = new Set(["image", "video", "avatar", "logo", "icon", "social_icon"]);
const INTERACTIVE_TYPES = new Set([
  "button", "link", "input", "textarea", "select", "menu_button", "search_box",
  "checkbox", "radio_button", "card_button", "carousel_prev", "carousel_next",
  "carousel_indicator", "nav_item",
]);
const LIST_TYPES = new Set(["list", "list_item", "breadcrumb"]);

function iconFamily(type: string): IconFamily {
  if (TEXT_TYPES.has(type)) return "text";
  if (MEDIA_TYPES.has(type)) return "media";
  if (INTERACTIVE_TYPES.has(type)) return "interactive";
  if (LIST_TYPES.has(type)) return "list";
  return "container";
}

function TypeIcon({ type }: { type: string }) {
  const family = iconFamily(type);
  const shared = {
    width: 12,
    height: 12,
    viewBox: "0 0 14 14",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    "aria-hidden": true as const,
  };
  switch (family) {
    case "text":
      return (
        <svg {...shared} strokeLinecap="round">
          <path d="M2 3h10M2 7h10M2 11h6" />
        </svg>
      );
    case "media":
      return (
        <svg {...shared} strokeLinejoin="round">
          <rect x="1.5" y="2" width="11" height="10" rx="1" />
          <circle cx="5" cy="5.5" r="1.1" />
          <path d="M2 10l3-3 2.5 2.5L11 6l1.5 1.5" />
        </svg>
      );
    case "interactive":
      return (
        <svg {...shared}>
          <rect x="1.5" y="4" width="11" height="6" rx="3" />
        </svg>
      );
    case "list":
      return (
        <svg {...shared} strokeLinecap="round">
          <circle cx="2.3" cy="3.5" r="0.8" fill="currentColor" stroke="none" />
          <path d="M5 3.5h7" />
          <circle cx="2.3" cy="7" r="0.8" fill="currentColor" stroke="none" />
          <path d="M5 7h7" />
          <circle cx="2.3" cy="10.5" r="0.8" fill="currentColor" stroke="none" />
          <path d="M5 10.5h7" />
        </svg>
      );
    default:
      return (
        <svg {...shared}>
          <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
        </svg>
      );
  }
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("transition-transform duration-fast", collapsed && "-rotate-90")}
    >
      <path d="M2.5 3.5L5 6.5L7.5 3.5" />
    </svg>
  );
}

function TreeNode({
  node,
  depth,
  selectedDetectionId,
  onSelect,
  modelDetectionIds,
}: {
  node: UINode;
  depth: number;
  selectedDetectionId: string | null;
  onSelect: (id: string | null) => void;
  modelDetectionIds: ReadonlySet<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const selected = node.sourceDetectionId === selectedDetectionId;
  const fromModel = node.sourceDetectionId !== undefined && modelDetectionIds.has(node.sourceDetectionId);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <button
        onClick={() => onSelect(node.sourceDetectionId ?? null)}
        // →/← expand/collapse, ↑/↓ move focus between visible rows (standard tree-widget
        // keyboard contract). Collapsed subtrees are removed from the DOM entirely (see the
        // `!collapsed` guard below), so "next/previous visible row" is exactly
        // "next/previous `li > button` in document order" within this panel's root <ul> —
        // no separate flattened-row model needs to be tracked.
        onKeyDown={(e) => {
          if (hasChildren) {
            if (e.key === "ArrowRight" && collapsed) {
              e.preventDefault();
              setCollapsed(false);
              return;
            } else if (e.key === "ArrowLeft" && !collapsed) {
              e.preventDefault();
              setCollapsed(true);
              return;
            }
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            const treeRoot = e.currentTarget.closest("ul.p-2");
            if (!treeRoot) return;
            const rows = Array.from(treeRoot.querySelectorAll<HTMLButtonElement>("li > button"));
            const currentIndex = rows.indexOf(e.currentTarget);
            if (currentIndex === -1) return;
            const nextIndex = e.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
            if (nextIndex < 0 || nextIndex >= rows.length) return;
            e.preventDefault();
            rows[nextIndex].focus();
          }
        }}
        style={{ paddingLeft: depth * 16 }}
        aria-expanded={hasChildren ? !collapsed : undefined}
        className={cn(
          "flex w-full items-center gap-xs rounded-sm px-xs py-xs text-left text-sm transition-colors duration-fast hover:bg-surface-sunken",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
          selected ? "bg-selection-subtle text-selection" : fromModel ? "text-detection-model" : "text-text-secondary"
        )}
      >
        <span
          aria-hidden="true"
          onClick={(e) => {
            if (!hasChildren) return;
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            hasChildren && "text-text-muted hover:text-text-primary"
          )}
        >
          {hasChildren && <ChevronIcon collapsed={collapsed} />}
        </span>
        {fromModel && (
          <span
            title="Detected by the model"
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-detection-model"
          />
        )}
        <span className="shrink-0 text-text-muted">
          <TypeIcon type={node.type} />
        </span>
        <span className="truncate font-mono text-2xs text-text-muted">{node.type}</span>
        {node.layout && (
          <span className="shrink-0 rounded-sm bg-surface-sunken px-2xs text-2xs uppercase text-text-muted">
            {node.layout.display}
            {node.layout.display === "grid" ? ` ${node.layout.columns}` : ""}
          </span>
        )}
      </button>
      {hasChildren && !collapsed && (
        // A small constant offset, not depth-based — the child buttons already carry
        // the real (absolute, per-depth) indentation via their own inline
        // `paddingLeft`, so this line must stay independent of `depth` or the two
        // would stack and double the indentation at every nesting level.
        <ul className="ml-1.5 border-l border-border">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedDetectionId={selectedDetectionId}
              onSelect={onSelect}
              modelDetectionIds={modelDetectionIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function UITreePanel({
  root,
  selectedDetectionId,
  onSelect,
  modelDetectionIds,
}: UITreePanelProps) {
  if (root.children.length === 0) {
    return (
      <EmptyState
        title="No components yet"
        description="Draw boxes on the sketch to build the UI tree."
      />
    );
  }

  return (
    <ul className="p-2">
      {root.children.map((child) => (
        <TreeNode
          key={child.id}
          node={child}
          depth={0}
          selectedDetectionId={selectedDetectionId}
          onSelect={onSelect}
          modelDetectionIds={modelDetectionIds}
        />
      ))}
    </ul>
  );
}
