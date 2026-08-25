---
title: "Sketch2UI — Code + Preview Design"
deliverable: "Phase 2, Deliverable 9"
current_implementation: "apps/web/src/features/code/CodePanel.tsx, features/preview/PreviewPane.tsx"
---

# Code + Preview Design

Relocates from a fixed 480px right column to the workspace's bottom dock (see
[workspace-design.md](workspace-design.md)); the components' internal behavior,
props, and data contracts are unchanged.

## Dock header

| Element | Spec |
|---|---|
| Tabs | "Preview" / "Code" — unchanged switching logic (`rightTab` state), restyled onto the system `Tabs` component, active indicator = `color-primary` underline (replacing today's orange, since orange is now reserved for selection-state only) |
| Version label | `activeVersionLabel` (`v3 · generated` etc.) — unchanged data, `font-mono text-xs`, `color-text-muted`, right-aligned in the header row |
| Collapse/expand | New: a chevron control to collapse the dock to just its header strip (freeing full height for Canvas+Layers+Inspector) — the dock remembers its last height and restores it on re-expand |
| Resize handle | New: drag the dock's top edge to resize; min height 120px, max height 70% of workspace body |

## HTML / CSS tabs (Code view)

| Element | Spec |
|---|---|
| Tab strip | "HTML" / "CSS" sub-tabs inside the Code view, unchanged from today's `CodePanel` internal `tab` state |
| Editor | Monaco, unchanged integration (`@monaco-editor/react`) |
| Theme | **Changed**: Monaco now uses a **light** theme (`vs`, or a custom theme matching `color-surface`/`color-border`/`color-text-primary`) instead of the hardcoded `vs-dark` — this directly resolves the audit's §17/§21 finding that the editor was the one permanently-dark surface in an otherwise all-light app. If a dark mode is ever introduced app-wide, Monaco switches with it (`vs-dark` under a future dark theme) — out of scope for this phase, noted for continuity |
| Read-only mode | Unchanged: editor is read-only until "Edit code" is pressed |
| Editing mode | Unchanged: draft state (`draftHtml`/`draftCss`) diverges from the live `html`/`css` props until Save or Cancel |

## Save / validation

| Element | Spec |
|---|---|
| Save button | "Save edit" — unchanged, disabled unless dirty, label becomes "Saving…" while in flight |
| Validation gate | Unchanged: `validateGeneratedCode()` runs client-side before any network call; a failure blocks Save entirely and never reaches the server — this is a correctness safeguard per [README.md](README.md)'s non-negotiable table, not a styling concern |
| Validation errors | Restyled from a plain red banner list to the system inline-error block (`color-error` 8%-tint background, `radius-sm`), same content: `{code}: {message}` per issue |
| Server error | Same slot, same restyle — unchanged that a server-side rejection surfaces here rather than as an `alert()` |
| Cancel | Unchanged: discards the draft, reverts to the live `html`/`css` props |

## Version selector

Today this is a horizontal strip of pill buttons above the workspace body
(`versionList.map(...)`). Relocated into the dock header as a dropdown
(`VersionSelect`) once more than ~3 versions exist, to avoid the strip growing
unboundedly wide — same underlying data (`versionList`, `activeVersionEntry`), same
`handleActivateVersion` call, same "edited" entries shown in italic. At 3 or fewer
versions, the pill-row presentation is kept (no dropdown needed at that scale) —
so early in a project's life the change is purely visual (color/spacing tokens), and
the dropdown only appears once it would actually help.

| State | Spec |
|---|---|
| Active version | Filled `color-primary` chip/row |
| Inactive version | Outline chip/row, `color-border` |
| Edited source | Italic label — unchanged convention |
| Activating | Chip shows a small inline spinner, disabled — new, replaces no prior feedback (today activation has no loading indicator at all) |

## Preview view

| Element | Spec |
|---|---|
| Viewport toggle | Desktop / Tablet / Mobile — unchanged three presets and pixel widths (100% / 768px / 375px), restyled onto the system segmented-control pattern |
| iframe | **Unchanged**: `sandbox=""`, `srcDoc`-fed, no `allow-scripts` — this is the app's one deliberate security boundary and is explicitly preserved per [README.md](README.md) |
| Asset resolution | Unchanged: `resolveAssetPath` rewrite for stored versions, absolute crop URLs for live regeneration |
| Frame chrome | New, purely decorative: a thin `color-border` frame around the iframe sized to the selected viewport, with a small `font-mono text-2xs` width label ("375px") above it — makes the viewport switch legible without changing any iframe behavior |

## Preview loading

**New** — today there is no loading indicator between "Apply/Save just fired" and "the
new HTML/CSS actually appears in the iframe" (the `srcDoc` swap is effectively
instant in practice, but the request round-trip that produces the new `html`/`css`
props is not). A thin `color-primary` progress line at the top of the preview pane
appears while any Inspector Apply, version activation, or code save is in flight —
reuses the same busy signals already computed in `ProjectWorkspace.tsx`
(`applyingStyle || applyingContent || ...`), no new state.

## Preview error

**New** — if `html`/`css` end up empty (e.g. `asset` is set but detections produced no
active nodes), the iframe area shows a centered message: "Nothing to preview yet — add
a component to the sketch." This does not change `PreviewPane`'s contract (it still
always renders *something* for whatever `html`/`css` it's given); the empty-state copy
is a small addition inside the composed document sent to `srcDoc`, so the sandbox
boundary is untouched.

## Zoom / device controls — explicitly not added here

Deliverable 9 does not ask for preview zoom beyond the three fixed viewport presets,
and the current implementation doesn't have one either. This spec keeps the
three-preset model rather than inventing a free-zoom preview control, which the
[canvas-design.md](canvas-design.md) zoom spec (a genuinely new capability, explicitly
flagged there) should not be confused with.
