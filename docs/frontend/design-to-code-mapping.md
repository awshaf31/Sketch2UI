---
title: "Sketch2UI — Design-to-Code Mapping"
deliverable: "Phase 2, Deliverable 13"
---

# Design-to-Code Mapping

For every design-system component: what exists today, whether to modify or preserve
it, and implementation priority. Priority follows the roadmap's phase order
([frontend-implementation-roadmap.md](frontend-implementation-roadmap.md)) — P0 is
foundational/zero-risk, P3 is highest-risk/last.

| Design component | Existing implementation | Action | Priority |
|---|---|---|---|
| Design tokens | `apps/web/tailwind.config.js` (`theme.extend: {}` — empty) | **Populate** | P0 |
| Button | Inline `className` strings, ~30+ sites across every file | **New** shared component; replace call sites incrementally | P0 |
| Icon Button | Does not exist as a pattern (title-attribute buttons exist, e.g. Inspector's Apply/Reset) | **New** | P0 |
| Field / Input | Inline `className` strings, heaviest in `InspectorPanel.tsx` | **New** shared component | P0 |
| Select | Native `<select>` inline, `ClassPicker.tsx` + several Inspector fields | **Wrap**, don't replace — keep native `<select>` under a styled shell | P0 |
| Badge | Ad hoc (e.g. the "Beta" tag inline in `ProjectWorkspace.tsx`'s header) | **New** | P0 |
| Card | Does not exist — Dashboard uses `<ul>`/`<li>` | **New** | P1 |
| Panel | Ad hoc `<div>` per region, each with its own border/header styling | **New** shared shell, applied to existing regions | P1 |
| Tabs | Inline in `ProjectWorkspace.tsx` (Preview/Code) and `CodePanel.tsx` (HTML/CSS) | **New** shared component; two existing usages migrate to it | P1 |
| Tooltip | `title` attribute only, throughout `InspectorPanel.tsx` and `ProjectWorkspace.tsx` | **New** — replace `title=` with the component (keeps hover behavior, adds keyboard-focus trigger + real ARIA) | P1 |
| Dropdown / Popover | Does not exist | **New** | P2 |
| Dialog | Does not exist (`window.confirm()` only, in `Dashboard.tsx`'s `handleDelete`) | **New**; retire the one `window.confirm()` call site | P1 |
| Toast | Does not exist (`window.alert()` at 6+ call sites in `ProjectWorkspace.tsx`: `handleCreate` catch, `handleUpdate` catch, `handleDeleteSelected` catch, `handleApproveTraining` catch, `handleExport` catch, `handleBoundaryChange` catch, `handleSaveVersion` catch) | **New**; retire every `window.alert()` call site listed | P1 |
| Empty State | Ad hoc text-only per screen (`Dashboard.tsx`'s "No projects yet", `UITreePanel.tsx`'s tree-empty copy, `InspectorPanel.tsx`'s no-selection copy) | **New** shared component; existing copy carries over verbatim | P1 |
| Loading Indicator | Ad hoc text ("Loading…", "Creating…", etc.) throughout | **New** shared primitives; existing copy patterns carry over where they already work (button loading labels), skeletons/progress-lines are additive | P1 |
| Error State | Three different patterns — see the audit's §21 — inline text (`Dashboard.tsx`, `InspectorPanel.tsx`), `window.alert()` (`ProjectWorkspace.tsx`), banner list (`CodePanel.tsx`) | **New** shared component; consolidate all three onto it | P1 |
| Section Header | Repeated `className` string, e.g. `InspectorPanel.tsx`'s `h3` styling | **New** shared component | P1 |
| AppHeader / BrandMark | Does not exist | **New** | P1 |
| WorkspaceToolbar | Inline JSX in `ProjectWorkspace.tsx`'s `<header>` | **Extract** into its own component, restyle | P2 |
| StatusBar (+ 5 segments) | Four separate inline conditional `<div>` blocks in `ProjectWorkspace.tsx` | **Extract and consolidate** — this is the layout's highest-value single change | P2 |
| LayersPanel | Inline `<div className="w-64">` wrapper in `ProjectWorkspace.tsx`, currently shared with Inspector | **Extract**, split from Inspector into its own column | P2 |
| UITree / TreeNode | `features/tree/UITreePanel.tsx` | **Preserve logic, restyle**: add per-type icons + collapse/expand (new) | P2 |
| CanvasPanel | Inline `<div>` wrapper in `ProjectWorkspace.tsx` | **Extract**; add `CanvasToolbar` (new: zoom/pan/fit) and `CanvasLegend` (new) | P3 |
| SketchCanvas | `features/annotation/AnnotationCanvas.tsx` | **Preserve pointer-math and coordinate-transform functions exactly**; restyle stroke/fill colors onto tokens; add zoom/pan as a transform layer around the existing `getImagePoint` scale calculation | P3 |
| PageBoundaryOverlay | `features/detection/PageBoundaryOverlay.tsx` | **Preserve entirely**; restyle stroke/handle colors onto tokens only | P3 |
| ClassPicker | `features/annotation/ClassPicker.tsx` | **Preserve logic**; restyle onto `Select` shell | P0 (small, low-risk, can move early) |
| InspectorPanel (shell) | `features/inspector/InspectorPanel.tsx` (1,050 lines, flat) | **Restructure**: extract each `h3` section into its own render unit under a shared `AccordionSection`; extract the repeated Apply/Reset footer into `InspectorSectionFooter`. **Preserve every handler, validator, and prop contract exactly.** | P3 |
| CodePanel | `features/code/CodePanel.tsx` | **Preserve entirely** (Monaco integration, validation gate, draft/save state machine); change only the `theme` prop (`vs-dark` → light) and surrounding chrome | P2 |
| PreviewPane | `features/preview/PreviewPane.tsx` | **Preserve entirely**, including `sandbox=""` — restyle only the frame chrome around the iframe, add the loading progress line as a sibling element, not a change to the iframe itself | P2 |
| ProjectCreateForm | Inline JSX in `Dashboard.tsx` | **Extract**, restyle onto `Field`/`Button` | P1 |
| ProjectList / ProjectCard | Inline `<ul>/<li>` in `Dashboard.tsx` | **Replace structure** (list → card grid); preserve the exact data (`Project[]`) and actions (open, delete) | P1 |

## e2e test impact — read before touching any DOM structure

Both Playwright suites bind to exact strings today. This table is the concrete list
every implementation phase must check before merging:

| Selector in `e2e/*.spec.ts` | File | Redesign impact |
|---|---|---|
| `getByPlaceholder("New project name")` | golden-path, inspector-overrides | **Keep placeholder text identical** on the new `Field`-based input |
| `getByRole("button", { name: "Create project" })` | golden-path, inspector-overrides | **Keep button text identical** |
| `getByRole("button", { name: /^Detect/ })` | golden-path, inspector-overrides | **Keep "Detect" as the leading word** — the "Beta" badge can move to a separate element as long as the button's accessible name still starts with "Detect" |
| `getByText(/1 box from the detector/)` | golden-path, inspector-overrides | **Keep this exact copy** in the new `DetectJobSegment` |
| `#detection-class` | golden-path, inspector-overrides | **Keep this exact id** on the Detection section's class `<select>` |
| `button[title="Save this class and regenerate the code"]` | golden-path | Today's `title` attribute becomes a real Tooltip + `aria-label` — **keep this exact string** as the `aria-label`/tooltip text so the selector (or its `data-testid` successor, see below) still resolves |
| `getByText("Saved")` | golden-path | **Keep "Saved" as the Detection footer's clean-state caption** |
| `getByRole("button", { name: "Save code version" })` — will become "Save version" per [workspace-design.md](workspace-design.md) | golden-path | **Breaking change, tracked deliberately**: update the test alongside the rename, do not rename silently |
| `getByRole("button", { name: "Export ZIP" })` | golden-path | **Keep identical** |
| `svg g rect` (first rect inside a detection's `<g>`) | inspector-overrides | **Keep this exact DOM shape** for the canvas's per-detection group — the redesign's restyle must not restructure the SVG group/rect nesting order |
| `#geo-width` | inspector-overrides | **Keep this exact id** |
| `button[title="Save this position/size and regenerate the code"]` | inspector-overrides | Same tooltip-string preservation as above |
| `button[title="Clear this component's geometry override and revert to the raw detection bbox"]` | inspector-overrides | Same |
| `#content-text` | inspector-overrides | **Keep this exact id** |
| `getByText(/may not contain/i)` | inspector-overrides | **Keep this substring** in the Content section's validation error message |

**Recommendation carried into the roadmap:** migrate these selectors to `data-testid`
attributes as each component is touched (e.g. `data-testid="detection-class-select"`
alongside the existing `id="detection-class"`, so both the current test and a
`data-testid`-based rewrite pass during the transition), rather than doing a single
big-bang test rewrite. This is called out per-phase in
[frontend-implementation-roadmap.md](frontend-implementation-roadmap.md).

## Reference-identity constraint

`ProjectWorkspace.tsx` defines `EMPTY_STYLE_OVERRIDE` as a module-level constant
specifically so `InspectorPanel`'s `useEffect([selected?.id, currentStyle])` doesn't
see a new object identity on every poll tick and wipe an unsaved draft. Any extraction
of `InspectorPanel`'s sections into separate components must preserve this exact
identity-stability property — a naive extraction that introduces a new inline
`{}`/`[]` literal in a parent's render path for the same purpose would silently
reintroduce the bug this constant exists to prevent.
