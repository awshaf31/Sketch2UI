---
title: "Sketch2UI — Design Tokens"
deliverable: "Phase 2, Deliverable 2"
implements: "tailwind.config.js theme.extend — currently empty (Phase 1 audit §5)"
---

# Design Tokens

All values below are meant to land in `apps/web/tailwind.config.js`'s `theme.extend`
(as the implementation target — see
[design-to-code-mapping.md](design-to-code-mapping.md)). Token names are the
semantic/CSS-custom-property names; the Tailwind key is the suggested utility suffix.

## Colors

### Neutrals — surfaces, borders, text

| Token | Value | Tailwind key | Use |
|---|---|---|---|
| `color-bg` | `#f4f5f7` | `bg` | App background behind all panels |
| `color-surface` | `#ffffff` | `surface` | Panel, card, input background |
| `color-surface-raised` | `#ffffff` | `surface-raised` | Modal/dropdown/popover background (same white, differentiated by `shadow-elevated`/`shadow-modal`, not a darker fill) |
| `color-surface-sunken` | `#eef0f4` | `surface-sunken` | Code editor gutter, table header row, disabled-field fill |
| `color-border` | `#dde1e8` | `border` | Default hairline — panel edges, dividers, input borders |
| `color-border-strong` | `#c3c9d4` | `border-strong` | Emphasized divider — major region boundaries (toolbar/canvas split), focus-adjacent outlines |
| `color-text-primary` | `#171a21` | `text-primary` | Headings, primary body text, values |
| `color-text-secondary` | `#4b5262` | `text-secondary` | Labels, secondary body text |
| `color-text-muted` | `#5d6679` | `text-muted` | Captions, placeholders, disabled text, timestamps (corrected from `#848da0`, which failed WCAG AA — see `docs/qa/MASTER_DEFECT_REGISTER.md` DEF-003) |
| `color-text-inverse` | `#ffffff` | `text-inverse` | Text on filled primary/dark surfaces |

Neutrals carry a very slight cool (blue) bias rather than pure gray — consistent with
the brand blue below, so the whole palette reads as chosen rather than default (Phase
1 audit §6 flags exactly this drift when colors are picked ad hoc per component).

### Brand & selection

| Token | Value | Tailwind key | Use |
|---|---|---|---|
| `color-primary` | `#2f5fdd` | `primary` | Primary buttons, links, active-tab indicator, focus rings, **and** the canvas's structural-container detection color (see rationale below) |
| `color-primary-hover` | `#2650bd` | `primary-hover` | Primary button/link hover |
| `color-primary-active` | `#1f429a` | `primary-active` | Primary button pressed |
| `color-primary-subtle` | `#e9eefc` | `primary-subtle` | Soft background for primary-tinted chips, selected-tab background, info-adjacent fills |
| `color-selection` | `#f97316` | `selection` | **Reserved exclusively** for "this is selected" — the selected canvas box, the selected tree row, a selected list item. Never used for a button or a brand moment. |
| `color-selection-subtle` | `#fef1e6` | `selection-subtle` | Selected row/card background wash |

**Why brand blue doubles as the canvas's container color:** `page`, `header`,
`section`, `footer`, `card`, `form`, `navbar`, `sidebar`, `table` — the structural
container classes — are literally the skeleton the whole product is built around.
Reusing the one brand color for "this is structural" is a deliberate reinforcement,
not the kind of incidental collision the audit flagged with orange (§6, §23): orange
today means "active tab" in one place and "selected box" in another, with no shared
logic between the two. Blue meaning "brand action" and "structural container" **is**
the same idea in both places — precision/foundation — so the reuse strengthens the
system instead of diluting it. Selection gets its own dedicated hue (formalized
orange) specifically so it never has to compete with either meaning.

### Detection & canvas state (structurally meaningful — see [canvas-design.md](canvas-design.md))

| Token | Value | Tailwind key | Meaning | Carried over from |
|---|---|---|---|---|
| `color-detection-model` | `#8b5cf6` | `detection-model` | Model-sourced, uncorrected box | existing `#a855f7` |
| `color-detection-manual` | `#10b981` | `detection-manual` | Manual / leaf (non-container) box | existing `#10b981`, unchanged |
| `color-detection-container` | `color-primary` (`#2f5fdd`) | — | Container-class box | existing `#2563eb`, now = brand |
| `color-detection-selected` | `color-selection` (`#f97316`) | — | Selected box (any source/class) | existing `#f97316`, now formalized |
| `color-page-boundary` | `#e11d48` | `page-boundary` | Page boundary polygon + handles | existing `#e11d48`, unchanged |
| `color-rejected-overlay` | `rgba(23,26,33,0.35)` | — | Opacity applied to a rejected (outside-boundary) box — **not** a new hue, per the audit's approval of pattern-plus-opacity over a color-only signal | existing 0.35 opacity, unchanged |

These five hues are carried forward almost unchanged from the current implementation
on purpose (Phase 1 audit §27 — "color is data, not decoration"): they are the only
encoding of detection source/class/state on the canvas today, and changing them would
break users' learned associations for no design benefit. What changes is that they
become named tokens instead of hex literals inline in JSX, and get a documented,
on-screen legend (see [canvas-design.md](canvas-design.md)) instead of living only in
code comments.

### Status

| Token | Value | Subtle bg | Use |
|---|---|---|---|
| `color-success` | `#047857` | `#e4f5ee` | Confirmed/applied/completed states — "Approved for training," a version saved successfully |
| `color-warning` | `#b45309` | `#faf0dc` | Unsaved/dirty states, non-blocking cautions (e.g. "1 box outside the page boundary") |
| `color-error` | `#dc2626` | `#fdecec` | Validation failures, failed requests, destructive-action emphasis |
| `color-info` | `#0284c7` | `#e6f4fc` | Neutral informational banners (job progress, export list) — carries forward the existing "sky" hue used for exports today |

Status colors are a **separate token group from detection colors** even where hues are
adjacent (e.g. `color-success` and `color-detection-manual` are both green-family) —
per the direction's principle that semantic color and canvas-state color answer
different questions and must never be the same token, even when a hue coincidentally
matches. `color-error` and `color-page-boundary` are deliberately differentiated (true
red vs. rose/magenta) for the same reason, and never appear in the same visual context
(page-boundary is always a canvas overlay; error is always text/banner), so the
closeness in hue carries no real ambiguity risk.

### Focus

| Token | Value | Use |
|---|---|---|
| `color-focus-ring` | `color-primary` at 100% + 2px offset | Every focusable element — see [accessibility.md](accessibility.md) for the exact ring spec |

## Typography

Families (Google Fonts, both already free/open — see
[design-direction.md](design-direction.md) for rationale):

```
--font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
--font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace;
```

### Scale

| Token | Size | Line-height | Weight | Typical use |
|---|---|---|---|---|
| `text-2xs` | 11px | 1.4 | 400/500 | Canvas box labels, deepest tree-node meta text — **the floor; nothing in the app renders smaller** |
| `text-xs` | 12px | 1.4 | 400/500 | Badges, captions, timestamps, section eyebrow labels |
| `text-sm` | 13px | 1.5 | 400/500 | Default UI text — buttons, inputs, list rows, tree rows |
| `text-base` | 14px | 1.5 | 400 | Inspector field values, panel body copy |
| `text-md` | 16px | 1.6 | 400 | Dashboard body copy, project descriptions |
| `text-lg` | 18px | 1.3 | 600 | Panel/section titles ("Inspector," "Layers") |
| `text-xl` | 22px | 1.25 | 600 | Page-level heading (Dashboard H1, project name in workspace header) |
| `text-2xl` | 28px | 1.2 | 600 | Reserved — empty-state hero text only, used sparingly |

Code/data typography always uses `font-mono` at `text-2xs`–`text-sm` depending on
context (canvas coordinate readout = `text-2xs`; Monaco editor body = 13px, its own
internal scale). Never mix mono into prose sentences except for literal file/class
names, which get `font-mono` inline within `font-sans` running text.

## Spacing

Base unit: 4px. All values below are usable directly as Tailwind's default spacing
scale already provides them — the point of naming them here is to fix which one is
*correct* for which context, not to invent new numbers.

| Token | Value | Use |
|---|---|---|
| `space-2xs` | 2px | Icon-to-text gap inside a compact badge |
| `space-xs` | 4px | Between a label and its input; between stacked micro-elements |
| `space-sm` | 8px | Default gap inside a control row (e.g. toolbar button group) |
| `space-md` | 12px | Default padding inside a compact control (button, input) |
| `space-lg` | 16px | Panel internal padding; gap between related field groups |
| `space-xl` | 24px | Gap between Inspector sections; Dashboard form-to-list gap |
| `space-2xl` | 32px | Gap between major workspace regions |
| `space-3xl` | 48px | Dashboard page-level top/bottom margins |

**Section spacing rule:** the gap between two sibling top-level regions (toolbar →
status bar → workspace body; Dashboard header → project list) is always `space-2xl` or
`space-3xl`, never a value below `space-xl` — this is what gives the "structural
rhythm" described in [design-direction.md](design-direction.md) its consistency.

## Radius

| Token | Value | Use |
|---|---|---|
| `radius-none` | 0px | Elements flush against a panel edge (a banner strip, a tab underline row) |
| `radius-sm` | 4px | Inputs, buttons, small badges |
| `radius-md` | 6px | Panels, cards, dropdown menus |
| `radius-lg` | 10px | Dialogs, the Dashboard's project cards |
| `radius-pill` | 999px | Status pills only ("Beta," confidence badge, dirty-state dot) — never buttons or containers |

## Shadows

| Token | Value | Use |
|---|---|---|
| `shadow-none` | `none` | Default for every in-flow panel (Layers, Inspector, canvas, code editor) — bordered, not shadowed |
| `shadow-subtle` | `0 1px 2px rgba(23,26,33,0.06)` | A momentarily-raised inline element (an open dropdown trigger) |
| `shadow-elevated` | `0 4px 16px -4px rgba(23,26,33,0.14), 0 1px 2px rgba(23,26,33,0.06)` | Dropdown menus, popovers, tooltips |
| `shadow-modal` | `0 16px 48px -12px rgba(23,26,33,0.30)` | Dialogs only — the single strongest shadow in the system |

## Icon sizes

| Token | Value | Use |
|---|---|---|
| `icon-xs` | 12px | Inline inside a `text-xs` badge |
| `icon-sm` | 14px | Default icon inside a button/toolbar control (pairs with `text-sm`) |
| `icon-md` | 16px | Standalone icon buttons, tree-row type icons |
| `icon-lg` | 20px | Section-header icons, empty-state icons |

Stroke weight: 1.5px at all sizes (see [design-direction.md](design-direction.md) for
the recommended icon set).

## Motion

| Token | Value | Use |
|---|---|---|
| `motion-fast` | 100ms | Hover/press feedback, checkbox/toggle flip |
| `motion-normal` | 180ms | Panel expand/collapse, tab switch, dropdown open/close |
| `motion-slow` | 280ms | Modal enter/exit, toast enter/exit |

Easing: `cubic-bezier(0.2, 0, 0, 1)` (decelerate) on entrances; its time-reverse
(`cubic-bezier(0.4, 0, 0.8, 1)`, accelerate) on exits. No spring/bounce curve is used
anywhere in the system. All three tokens collapse to a same-duration opacity-only
crossfade — or, for state changes with no meaningful "in-between" (e.g. a value
toggling), no transition at all — under `prefers-reduced-motion: reduce`.

## Applying this to `tailwind.config.js`

The current file (`apps/web/tailwind.config.js`) is:

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

Phase 2A ([frontend-implementation-roadmap.md](frontend-implementation-roadmap.md))
populates `theme.extend.colors`, `.fontFamily`, `.fontSize`, `.spacing`,
`.borderRadius`, `.boxShadow` with the tables above, keyed by the exact token names
listed (e.g. `colors.primary`, `colors["primary-hover"]`, `colors["detection-model"]`).
This is additive to the default Tailwind palette — existing utility classes elsewhere
in the app that aren't yet migrated keep working while the migration proceeds
component-by-component (see the roadmap for sequencing).
