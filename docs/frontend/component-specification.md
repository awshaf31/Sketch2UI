---
title: "Sketch2UI — Component Specification"
deliverable: "Phase 2, Deliverable 6"
---

# Component Specification

Every entry below replaces N hand-written instances of the same pattern (counts from
the Phase 1 audit) with one component. All values reference
[design-tokens.md](design-tokens.md).

## Button

**Replaces** ~30+ hand-rolled instances across every screen (audit §9).

| Aspect | Spec |
|---|---|
| Variants | `primary` (filled `color-primary`), `secondary` (outline `color-border`), `tinted` (outline + subtle fill in a semantic color — Detect/Approve/Export use this with their respective hue), `destructive` (text-only, `color-error` on hover — matches today's Delete link), `ghost` (no border, for icon-only toolbar buttons) |
| Sizes | `sm` (28px height, `text-xs`, used in Inspector footers), `md` (32px height, `text-sm`, default), `lg` (40px height, `text-md`, Dashboard's Create button) |
| States | default, hover, active/pressed, focus-visible (`color-focus-ring`), disabled (40% opacity, no pointer events), loading (label replaced by a present-participle string + inline spinner, exact pattern already used today — "Creating…", "Saving…" — kept, now driven by a shared `loading` prop instead of six separate ternaries) |
| Spacing | Horizontal padding `space-md`–`space-lg` depending on size, `space-xs` between icon and label |
| Typography | `font-sans`, 500 weight |
| Accessibility | Real `<button>` element always; `disabled` attribute (not just visual) when inactive; loading state sets `aria-busy="true"` |
| Radius | `radius-sm` |

## Icon Button

| Aspect | Spec |
|---|---|
| Size | 28px (sm) / 32px (md) hit area, icon centered at `icon-sm`/`icon-md` |
| Variant | `ghost` only — icon buttons never carry a filled background at rest |
| States | Same as Button, plus a distinct `active`/toggled state (`color-primary-subtle` background) for things like a pressed "collapse" chevron |
| Accessibility | **Always** requires an `aria-label` or visually-hidden text — no icon-only button ships without one (direct fix for audit §20's "identical Apply buttons" finding, generalized as a rule) |

## Input / Field

**Replaces** the `rounded border border-gray-300 px-1.5 py-1 text-xs` string
hand-written a dozen+ times in the Inspector alone (audit §10).

| Aspect | Spec |
|---|---|
| Structure | `Field` wraps a `<label>` + control + optional helper/error text — one component owns the label-to-input spacing (`space-xs`) instead of each usage reinventing it |
| Sizes | `sm` (28px, Inspector default), `md` (36px, Dashboard's project-name input) |
| States | default (`color-border`), focus (`color-primary` ring, per [accessibility.md](accessibility.md)), error (`color-error` border + helper text in `color-error`), disabled (`color-surface-sunken` fill), read-only (no border, plain text look — for e.g. Detection confidence display) |
| Typography | `font-sans` for prose fields (Content's text/altText), `font-mono` for data fields (Geometry's x/y/w/h, Style's raw CSS values, href) — per the type direction |
| Accessibility | `<label htmlFor>` always paired (already correct today — preserved, not changed) |

## Select

Same visual shell as Input, native `<select>` underneath (not a custom listbox) —
deliberately: native selects give correct keyboard/screen-reader behavior for free and
every current use case (class picker, display mode, parent dropdown) is a short,
flat option list with no need for search/multi-select/custom rendering.

## Tabs

| Aspect | Spec |
|---|---|
| Structure | Row of text buttons, one `1px` bottom rule (`color-border`) spanning the full tab strip, active tab's own `2px color-primary` underline on top of it |
| States | active, inactive (`color-text-muted`), hover (`color-text-primary`), disabled |
| Used by | Bottom dock (Preview/Code), Code view's HTML/CSS sub-tabs |
| Accessibility | `role="tablist"` / `role="tab"` / `aria-selected`, arrow-key navigation between tabs |

## Badge

| Aspect | Spec |
|---|---|
| Variants | `neutral` (`color-surface-sunken` fill), `tinted` (semantic color at 8–12% fill + full-strength text — used for "Beta," source badges, confidence pills) |
| Size | `text-2xs`/`text-xs`, `radius-pill`, `space-2xs`–`space-xs` padding |
| Content | Text only, or icon + text (never icon-only — a badge is informational, not actionable) |

## Tooltip

| Aspect | Spec |
|---|---|
| Trigger | Hover (200ms delay) or keyboard focus — never click-only, since several current uses are on disabled buttons (e.g. explaining why Export is unavailable) which don't receive click events |
| Shell | `color-surface-raised`, `shadow-elevated`, `radius-sm`, `text-xs`, small arrow/pointer to the trigger |
| Used by | Every icon-only button's accessible-name companion, toolbar action explanations (today's `title="..."` attributes — see [design-to-code-mapping.md](design-to-code-mapping.md) for why these become real tooltips, not native `title`) |

## Dropdown / Popover

| Aspect | Spec |
|---|---|
| Shell | `color-surface-raised`, `shadow-elevated`, `radius-md`, `1px color-border` |
| Used by | Status bar's Exports segment, version selector once >3 versions, canvas legend's collapsed state |
| Dismissal | Click-outside, `Escape` key, or re-triggering the anchor |
| Accessibility | Focus trapped inside while open only if it contains multiple interactive items requiring arrow-key navigation (exports list); a single-purpose popover (legend) does not trap focus |

## Card

**Introduces** the pattern the audit found entirely absent (§11) despite `card` being
a first-class taxonomy class.

| Aspect | Spec |
|---|---|
| Shell | `color-surface`, `1px color-border`, `radius-lg`, `space-lg` padding, `shadow-none` at rest |
| Used by | Dashboard's `ProjectCard` |
| States | hover (`color-border-strong` + `shadow-subtle`), focus-visible (`color-focus-ring`) |

## Panel

The structural container for every workspace region (Layers, Canvas, Inspector, dock).

| Aspect | Spec |
|---|---|
| Shell | `color-surface`, `1px color-border` on the sides facing other panels, `shadow-none` always (per the elevation philosophy — panels never float) |
| Header | `space-lg` horizontal padding, `text-xs`/600 uppercase label, `color-text-muted`, bottom `1px color-border` |

## Dialog

**Introduces** the pattern entirely absent today (§12 — zero modals exist, the only
confirmation is `window.confirm()`).

| Aspect | Spec |
|---|---|
| Shell | `color-surface-raised`, `radius-lg`, `shadow-modal`, centered, `max-width: 440px` (confirm dialogs) or `560px` (any future content dialog) |
| Overlay | `rgba(23,26,33,0.4)` scrim behind the dialog, click-to-dismiss only for non-destructive dialogs |
| Structure | Title (`text-lg`/600) → body (`text-sm`, `color-text-secondary`) → action row (right-aligned, Cancel/secondary then primary-or-destructive) |
| Focus | Traps focus inside; opens with focus on the safer default action (Cancel, for destructive dialogs); `Escape` closes and returns focus to the trigger — full contract in [accessibility.md](accessibility.md) |
| Motion | `motion-slow` (280ms) scrim fade + dialog scale-from-98%, per the animation philosophy |

## Toast

**Introduces** the pattern that replaces `window.alert()` for non-blocking outcomes
(audit §21 — three inconsistent error patterns become one).

| Aspect | Spec |
|---|---|
| Shell | `color-surface-raised`, `shadow-elevated`, `radius-md`, `space-md` padding, semantic-colored left edge (4px) matching its type |
| Variants | `success`, `error`, `info` — no `warning` toast (warnings are inline/persistent, not transient) |
| Position | Bottom-right, stacked, newest on top |
| Duration | 4s auto-dismiss for `success`/`info`, **no auto-dismiss** for `error` (must be manually dismissed — an error the user didn't finish reading shouldn't vanish) |
| Motion | `motion-normal` slide-in from the right + fade |

**Where `window.alert()`/`window.confirm()` calls are retired:** see
[design-to-code-mapping.md](design-to-code-mapping.md) for the exact call-site list in
`ProjectWorkspace.tsx`.

## Empty State

| Aspect | Spec |
|---|---|
| Structure | Centered icon (`icon-lg`, `color-text-muted`) → title (`text-md`/500) → description (`text-sm`, `color-text-muted`) → optional action button |
| Used by | Dashboard (no projects), Layers panel (no tree yet), Inspector (nothing selected) |

## Loading Indicator

| Aspect | Spec |
|---|---|
| Inline spinner | 14–16px, `color-primary` (or `currentColor` inside a button), used inside buttons/chips mid-action |
| Skeleton | Flat `color-surface-sunken` block matching the loaded content's approximate shape — **no shimmer/pulse animation** (see [design-direction.md](design-direction.md)'s motion philosophy) |
| Progress line | 2px `color-primary` indeterminate bar, top-anchored to the surface it describes (preview pane during regeneration) |

## Error State

| Aspect | Spec |
|---|---|
| Inline | `color-error` 8%-tint background, `radius-sm`, `space-sm` padding, `text-sm` message — the single shared pattern replacing Inspector's per-section error blocks, CodePanel's validation list, and Dashboard's create-error text |
| Full-panel | Centered icon + message + Retry button — used when an entire panel's data fetch fails (e.g. Dashboard's project list) |

## Section Header

`text-xs`/600, uppercase, `letter-spacing: 0.04em`, `color-text-muted`, `space-lg`
horizontal padding, `space-sm` vertical — the exact pattern already used informally
today (`InspectorPanel`'s `h3` styling), formalized as one component instead of a
repeated className string.

## Toolbar Control

Generic wrapper for a labeled control group inside a toolbar (e.g. the canvas's zoom
group) — `space-xs` internal gap, `1px color-border` separators between logical
groups within the same toolbar row.

## Tree Node

| Aspect | Spec |
|---|---|
| Row height | 28px, `space-xs` vertical padding |
| Indent | `space-lg` (16px) per depth level — up from today's 14px, aligned to the token scale |
| Icon | New: a small `icon-sm` glyph per UI-IR node type (container vs. leaf), replacing today's bare `font-mono` type label as the primary visual — the mono type label moves to a secondary position, still present |
| Model indicator | `color-detection-model` dot, unchanged meaning |
| Selected | `color-selection-subtle` row background + `color-selection` text — unchanged color choice, now token-driven |
| Collapse/expand | **New**: a chevron for any node with children, `motion-fast` rotate; state is per-node and does not persist across a full tree rebuild (rebuilds happen on every detection change, matching current `buildTreeAndCode` behavior) |

## Detection Label (canvas)

See [canvas-design.md](canvas-design.md) §9 — `font-mono text-2xs`, color matches the
box's current state color.

## Inspector Field

See [inspector-design.md](inspector-design.md) — built from `Field`/`Input`/`Select`
above plus the shared `InspectorSectionFooter`.

## Code Editor Tabs

See [code-preview-design.md](code-preview-design.md) — built from the `Tabs`
component above.

## Preview Controls

See [code-preview-design.md](code-preview-design.md) — segmented-control variant of
`Toolbar Control`.
