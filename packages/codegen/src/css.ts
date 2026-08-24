import type { UINode, UIRoot } from "@sketch2ui/shared-types";

// CSS generation engine — plan section 14. Token system, flex/grid layout heuristics
// over absolute positioning, and a mobile responsive fallback.

const BASE_CSS = `:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #1f2937;
  background: #ffffff;
  line-height: 1.5;
}

img {
  max-width: 100%;
  display: block;
}

/* Emitted unconditionally: .ui-logo-image is applied to an <img> nested inside a logo
   anchor, so it is not a node type and would not be picked up by used-class scanning. */
.ui-logo-image {
  max-height: 48px;
  width: auto;
}`;

// Default visual styling per component type, keyed by the "ui-" class name emitted in html.ts.
const COMPONENT_BASE_CSS: Record<string, string> = {
  "ui-header": "display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-4) var(--space-6);",
  "ui-footer": "padding: var(--space-6); text-align: center; color: #6b7280;",
  "ui-navbar": "display: flex; align-items: center; gap: var(--space-5); list-style: none;",
  "ui-nav-item": "color: inherit; text-decoration: none;",
  "ui-carousel": "position: relative; overflow: hidden;",
  "ui-breadcrumb": "display: flex; align-items: center; gap: var(--space-2); font-size: 0.875rem; color: #6b7280;",
  "ui-section": "padding: var(--space-6) 6vw;",
  "ui-sidebar": "padding: var(--space-5);",
  "ui-card": "padding: var(--space-4); border: 1px solid #ddd; border-radius: 12px;",
  "ui-table": "width: 100%; border-collapse: collapse;",
  "ui-form": "display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4);",
  "ui-newsletter": "display: flex; gap: var(--space-3);",
  "ui-list": "list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);",
  "ui-button": "border: 0; padding: 0.75rem 1rem; border-radius: 8px; cursor: pointer; background: #1f2937; color: #fff; font: inherit;",
  "ui-card-button": "border: 0; padding: 0.6rem 0.9rem; border-radius: 8px; cursor: pointer; background: #1f2937; color: #fff; font: inherit;",
  "ui-menu-button": "border: 0; background: transparent; cursor: pointer; font-size: 1.5rem;",
  "ui-carousel-prev": "border: 0; background: transparent; cursor: pointer; font-size: 1.25rem;",
  "ui-carousel-next": "border: 0; background: transparent; cursor: pointer; font-size: 1.25rem;",
  "ui-carousel-indicator": "display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #d1d5db;",
  "ui-input": "padding: var(--space-3); border: 1px solid #d1d5db; border-radius: 8px; font: inherit;",
  "ui-search-box": "padding: var(--space-3); border: 1px solid #d1d5db; border-radius: 8px; font: inherit;",
  "ui-checkbox": "width: 1rem; height: 1rem; accent-color: #1f2937;",
  "ui-radio-button": "width: 1rem; height: 1rem; accent-color: #1f2937;",
  "ui-textarea": "padding: var(--space-3); border: 1px solid #d1d5db; border-radius: 8px; font: inherit; min-height: 6rem;",
  "ui-select": "padding: var(--space-3); border: 1px solid #d1d5db; border-radius: 8px; font: inherit;",
  "ui-heading": "margin: 0 0 var(--space-3) 0;",
  "ui-card-title": "margin: 0 0 var(--space-2) 0;",
  "ui-text": "margin: 0 0 var(--space-3) 0; color: #4b5563;",
  "ui-card-text": "margin: 0 0 var(--space-3) 0; color: #4b5563;",
  "ui-link": "color: #2563eb; text-decoration: none;",
  "ui-social-icon": "display: inline-block; width: 1.5rem; height: 1.5rem; border: 1.5px solid #adb5bd; border-radius: 50%; background: #f1f3f5; color: #4b5563; text-decoration: none;",
  "ui-logo": "font-weight: 700; text-decoration: none; color: inherit;",
  "ui-avatar": "width: 48px; height: 48px; border-radius: 50%; object-fit: cover;",
  // Symbolic by decision (crops are illegible at icon size) — but must actually be
  // visible; these previously rendered as empty zero-content boxes.
  "ui-icon": "display: inline-block; width: 1.25rem; height: 1.25rem; border: 1.5px solid #adb5bd; border-radius: 4px; background: #f1f3f5;",
  "ui-image": "width: 100%; border-radius: 8px;",
  "ui-video": "width: 100%; border-radius: 8px;",
  "ui-map": "width: 100%; min-height: 240px; background: #e5e7eb; border-radius: 8px;",
  "ui-divider": "border: none; border-top: 1px solid #e5e7eb; margin: var(--space-4) 0;",
  "ui-testimonial": "margin: 0; padding: var(--space-4); border-left: 3px solid #d1d5db; font-style: italic; color: #4b5563;",
};

function toClassName(type: string): string {
  return `ui-${type.replace(/_/g, "-")}`;
}

interface LayoutRule {
  selector: string;
  declarations: string[];
  isGrid: boolean;
  isRowFlex: boolean;
}

function layoutRuleFor(selector: string, layout: UINode["layout"]): LayoutRule | null {
  if (!layout) return null;

  const declarations: string[] = [];
  const gap = layout.gap ?? 16;

  if (layout.display === "grid") {
    declarations.push("display: grid;");
    declarations.push(`grid-template-columns: repeat(${layout.columns ?? 1}, minmax(0, 1fr));`);
    declarations.push(`gap: ${gap}px;`);
  } else if (layout.display === "flex") {
    declarations.push("display: flex;");
    if (layout.direction === "column") {
      declarations.push("flex-direction: column;");
    } else {
      declarations.push("align-items: center;");
    }
    declarations.push(`gap: ${gap}px;`);
  }

  if (declarations.length === 0) return null;

  return {
    selector,
    declarations,
    isGrid: layout.display === "grid",
    isRowFlex: layout.display === "flex" && layout.direction !== "column",
  };
}

function collectLayoutRules(node: UINode, out: LayoutRule[]): void {
  const rule = layoutRuleFor(`#${node.id}`, node.layout);
  if (rule) out.push(rule);

  for (const child of node.children) {
    collectLayoutRules(child, out);
  }
}

/**
 * Per-node style overrides — plan §6.7 / §17.3. Walks the tree collecting a `#<id>`
 * rule for every node whose `style` map has entries, and emits them AFTER the layout
 * blocks so the cascade lets a manual override win over the auto-inferred layout at
 * equal specificity. A card's manual `padding` therefore replaces the component-block
 * padding without stripping the grid layout its parent group emits.
 *
 * Properties are dash-cased CSS names (`font-size`, `text-align`) so the object is a
 * literal declaration set — the same shape the inspector's controls produce and the
 * only shape the fixture files store. Values are inserted verbatim; validation lives at
 * the write boundary in the API, not here.
 */
function collectStyleOverrideBlocks(node: UINode, out: string[]): void {
  const entries = Object.entries(node.style ?? {});
  if (entries.length > 0) {
    const decls = entries.map(([prop, value]) => `  ${prop}: ${value};`).join("\n");
    out.push(`#${node.id} {\n${decls}\n}`);
  }
  for (const child of node.children) collectStyleOverrideBlocks(child, out);
}

function usedClasses(node: UINode, out: Set<string>): void {
  out.add(toClassName(node.type));
  for (const child of node.children) usedClasses(child, out);
}

export function generateCSS(root: UIRoot): string {
  const classes = new Set<string>();
  for (const child of root.children) usedClasses(child, classes);

  const componentBlocks = [...classes]
    .filter((cls) => COMPONENT_BASE_CSS[cls])
    .map((cls) => `.${cls} {\n  ${COMPONENT_BASE_CSS[cls]}\n}`);

  const layoutRules: LayoutRule[] = [];
  const rootRule = layoutRuleFor("body", root.layout);
  if (rootRule) layoutRules.push(rootRule);
  for (const child of root.children) collectLayoutRules(child, layoutRules);

  const layoutBlocks = layoutRules.map(
    (rule) => `${rule.selector} {\n  ${rule.declarations.join("\n  ")}\n}`
  );

  // Responsive fallback — plan section 14.7: collapse grids and row-flex containers on mobile.
  const responsiveDeclarations = layoutRules
    .filter((rule) => rule.isGrid || rule.isRowFlex)
    .map((rule) => {
      if (rule.isGrid) {
        return `  ${rule.selector} {\n    grid-template-columns: 1fr;\n  }`;
      }
      return `  ${rule.selector} {\n    flex-wrap: wrap;\n  }`;
    });

  const responsiveBlock =
    responsiveDeclarations.length > 0
      ? `@media (max-width: 768px) {\n${responsiveDeclarations.join("\n\n")}\n}`
      : "";

  // Style-inspector overrides come LAST so they win the cascade over both the component
  // base (.ui-card) and the layout rules (#node-id from layoutRuleFor). Responsive block
  // still comes after these — mobile collapse of a grid or row-flex needs to beat a
  // desktop override, or the mobile view would silently ignore the media query.
  const overrideBlocks: string[] = [];
  for (const child of root.children) collectStyleOverrideBlocks(child, overrideBlocks);

  return [BASE_CSS, ...componentBlocks, ...layoutBlocks, ...overrideBlocks, responsiveBlock]
    .filter(Boolean)
    .join("\n\n") + "\n";
}
