---
title: "Sketch2UI — Project Workspace Design"
deliverable: "Phase 2, Deliverable 5"
current_implementation: "apps/web/src/pages/ProjectWorkspace.tsx (1,035 lines)"
---

# Project Workspace Design

This is the most important screen in the product and the one the Phase 1 audit
flagged hardest (§4, §16, §22–23): a single 1,035-line component with a fixed
3-column layout (`flex-1` canvas / `w-64` tree+inspector / `w-[480px]` preview-code)
and up to four stacked colored banners above it.

## Proposed IA change — read this before the layout diagram

Today's column order is **canvas → tree+inspector stacked → preview/code**. This
specification proposes a **conventional design-tool arrangement** instead — canvas
centered as the primary work surface, Layers on the left, Inspector on the right, and
Code/Preview moved into a bottom dock:

```
CURRENT                         PROPOSED
┌────────┬──────┬──────────┐    ┌───────────────────────────────┐
│        │ Tree │          │    │ Toolbar                        │
│ Canvas │──────│ Preview/ │    ├───────────────────────────────┤
│ flex-1 │ Insp.│ Code     │    │ Status bar                     │
│        │ w-64 │ w-[480]  │    ├────────┬───────────┬───────────┤
│        │      │          │    │ Layers │  Canvas   │ Inspector │
└────────┴──────┴──────────┘    │ 240px  │  flex-1   │  320px    │
                                 ├────────┴───────────┴───────────┤
                                 │ Code / Preview dock (resizable) │
                                 └───────────────────────────────┘
```

**Why:** this is exactly what Deliverable 5 of this task specifies (Layers left,
Canvas center, Inspector right, Code+Preview as a bottom area), and it independently
fixes two Phase 1 findings: the fixed 480px right column that starves the canvas on a
1366px laptop (§4), and the Inspector being visually squeezed under the tree in a
256px column (§16). Every underlying action, route, and data flow is unchanged — this
is a **panel rearrangement**, not new functionality. See
[design-to-code-mapping.md](design-to-code-mapping.md) for exactly which JSX moves
where.

## Top toolbar

One row, `color-surface` background, `1px solid color-border` bottom edge, `space-md`
vertical padding, `space-lg` horizontal.

| Zone | Content | Notes |
|---|---|---|
| Left | "← Projects" link + project name (`text-lg`/600) | Unchanged from today |
| Right | Action button group | See below |

**Action buttons, left to right** (all existing actions, restyled onto the button
component spec — no new actions, no renamed underlying calls):

| Button | Maps to existing action | Variant |
|---|---|---|
| Detect · Beta | `detectJob.start()` | Secondary, violet-tinted (echoes `color-detection-model`) — kept visually distinct since it triggers an experimental model, matching today's intent |
| Approve for training | `handleApproveTraining()` | Secondary, `color-success`-tinted |
| Export ZIP | `handleExport()` | Secondary, `color-info`-tinted |
| Save version | `handleSaveVersion()` | Primary |

**On "Generate":** the task brief asks for a toolbar "Generate" action. The app has no
separate generate step — `Save version` already calls `api.generateCode()` and
persists the result in one action (`ProjectWorkspace.tsx`'s `handleSaveVersion`), and
every Inspector Apply already regenerates code live before that. This spec does
**not** invent a second, separate "Generate" button with new semantics — doing so
would either duplicate `Save version` or introduce a "generate but don't save" state
that doesn't exist in the API. Instead, `Save version`'s label and tooltip are updated
to "Save version — generates and saves the current code" so its dual role is explicit
in the UI, closing the naming gap without inventing new backend behavior.

**"Preview" is not a toolbar button** — it's the default tab of the bottom dock (see
below), matching current behavior where `rightTab` defaults to `"preview"`.

## Status bar — consolidating four banners into one

The single highest-impact fix identified in the audit (§4, §22): up to four
independently-colored banners (detect status, page boundary, exports, code versions)
currently stack and push the workspace down unpredictably.

**Proposed replacement:** one fixed-height (40px) status bar directly under the
toolbar, divided into left-aligned **segments** that appear/disappear individually but
never add vertical height — the bar's height never changes, only its contents:

```
[● Detecting… 42%]  [Page boundary: detected 91%]  [2 outside page]  [v3 · generated · active]
```

| Segment | Shown when | Source data (unchanged) |
|---|---|---|
| Detect job | A job is running, failed, or just completed with model boxes present | `useDetectionJob` state — same hook, same polling |
| Page boundary | A boundary is known for the asset | `boundary` state — same `getPageBoundary`/`savePageBoundary` calls |
| Rejected count | `rejectedCount > 0` | Same `effectiveDetections` memo |
| Active code version | At least one version exists | Same `versionList`/`activeVersion` state |
| Exports | At least one export exists | Same `exports` state — becomes a small "Exports ▾" popover trigger instead of an inline strip, so it doesn't compete for the fixed-height row when the list grows |

Segments are separated by a `1px color-border` vertical rule, each using its
semantic color as a small leading dot/icon rather than a full-row colored background —
this is the direct fix for the audit's §23 complaint ("saturated banners clash with
the muted chrome around them"). A segment that needs more than one line of
information (the detect-job error message, the full exports list) opens a popover
anchored to its segment rather than expanding the bar itself, so page layout never
jitters based on workspace state — a hard requirement carried over from the audit's
§4 risk callout.

## Layers panel (left)

`width: 240px`, fixed, `1px solid color-border` right edge, `color-surface`
background.

| Element | Spec |
|---|---|
| Header | "Layers" (`text-xs`/600, uppercase, `letter-spacing: 0.04em`, `color-text-muted`) — matches current section-label styling, formalized as a token |
| Body | `UITree` (recursive, unchanged data source: `buildTreeAndCode`'s `tree` output) |
| Empty state | "Draw boxes on the sketch to build the layer tree." — same copy as today's `UITreePanel` empty state, restyled |

Full tree-row spec is in [component-specification.md](component-specification.md)
(`TreeNode`) — collapse/expand behavior is **new** (today's tree has no collapse
affordance) and detailed there, not invented here without traceability.

## Canvas panel (center)

`flex: 1`, the only panel that grows/shrinks with viewport width — this is the direct
fix for the audit's §4 finding that the canvas was the panel starved by two fixed-width
neighbors. Full interaction and visual spec is in
[canvas-design.md](canvas-design.md); this section covers only its place in the shell.

- A slim canvas toolbar sits above the sketch: class picker (unchanged `ClassPicker`),
  zoom controls, and fit-to-screen — zoom/pan are **new** capabilities, specified fully
  in [canvas-design.md](canvas-design.md) and flagged there as new, not existing.
- The canvas itself fills all remaining space, scrollable/pannable when zoomed beyond
  fit.

## Inspector panel (right)

`width: 320px` (up from today's 256px shared with the tree — now the Inspector has
the full width to itself), fixed, `1px solid color-border` left edge.

Full section-by-section spec is in [inspector-design.md](inspector-design.md). At the
shell level: the Inspector becomes **accordion sections** (Detection, Style, Geometry,
Structure, Content, History — same six sections, same order as today's
`InspectorPanel.tsx`) instead of all-expanded-always, directly resolving the audit's
§16 finding.

## Bottom dock — Code / Preview

Replaces today's fixed `w-[480px]` right column. `height: 40%` of the workspace body
by default, **resizable** by dragging its top edge (new capability — see
[responsive-design.md](responsive-design.md) for the behavior below the width that
supports resizing at all), collapsible to a slim tab strip.

Full spec in [code-preview-design.md](code-preview-design.md). At the shell level:
tabs (Preview / Code) sit in the dock's own header row, identical switching behavior
to today's `rightTab` state — same two views, same underlying `PreviewPane`/`CodePanel`
components, just relocated from a side column to a bottom dock.

## Panel relationships — what stays in sync

Unchanged from today, restated for completeness because the layout move must not
break any of it:

- Selecting a detection — on the canvas, in the Layers tree, or nowhere (deselected) —
  is one shared `selectedId` in `projectStore`, driving highlight state in **all
  three** of Canvas, Layers, and Inspector simultaneously. The rearrangement does not
  change this data flow, only where each consumer sits on screen.
- The Inspector has content only when `selectedId` is set; otherwise it shows its
  existing empty-state copy ("Select a component on the canvas or in the tree…").
- The bottom dock's Preview/Code always reflects `activeVersion ?? liveHtml/liveCss` —
  unchanged derivation, unchanged component props.

## Empty workspace (no asset yet)

Unchanged from today: the entire four-region body is replaced by a single centered
`UploadDropzone`, full panel, no toolbar action buttons rendered (matches current
`{!asset && <UploadDropzone />}` branch) except the "← Projects" link.
