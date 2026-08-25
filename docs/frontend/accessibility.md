---
title: "Sketch2UI — Accessibility Strategy"
deliverable: "Phase 2, Deliverable 11"
---

# Accessibility Strategy

Addresses the Phase 1 audit's §20 findings directly, in the same order they were
raised there.

## Keyboard navigation

| Surface | Behavior |
|---|---|
| Canvas — **highest-priority gap** | New keyboard mode: with a detection selected, arrow keys nudge it by 1px-equivalent (Shift+arrow for 10px-equivalent); `Tab`/`Shift+Tab` cycle selection through detections in document order; `Enter` on a focused-but-unselected detection selects it. This does not replace mouse drawing (still mouse/pointer-only, matching how a vector tool's draw tool works everywhere), but it closes the audit's flagged gap that *selection, correction, and deletion* were entirely mouse-gated — those three now have full keyboard equivalents even though initial box *drawing* remains a pointer operation, matching the precedent every comparable annotation tool sets |
| Layers tree | Arrow keys move focus between rows, `Enter`/`Space` selects, `→`/`←` expand/collapse a node with children — standard tree-widget keyboard contract |
| Inspector accordion | `Enter`/`Space` toggles a section header; `Tab` moves through a section's fields in visual order |
| Dialogs | `Tab` cycles within the dialog only (focus trap); `Escape` closes |
| Global | `Delete`/`Backspace` deletes the selected detection when focus is not inside a text field — unchanged from today's existing guard (`AnnotationCanvas.tsx` already checks `target.tagName`) |

## Focus states

Every focusable element gets a visible focus-visible ring: `2px color-focus-ring` with
`2px` offset, applied via `:focus-visible` (not `:focus`, so a mouse click doesn't show
a ring a keyboard `Tab` would). This is a single CSS rule applied system-wide via the
Button/Input/Select/tree-row/tab primitives — not something each component
reimplements, closing the audit's §20 finding that today only the Dashboard's input
has a deliberate focus treatment.

## ARIA labels

| Case | Requirement |
|---|---|
| Icon-only buttons | `aria-label` required on every one — no exceptions (component-level rule, see [component-specification.md](component-specification.md)'s Icon Button spec) |
| The five Inspector Apply/Reset button pairs | **Direct fix for the audit's flagged issue**: each pair gets a section-qualified accessible name — `aria-label="Apply Style changes"`, `aria-label="Reset Geometry override"`, etc. — instead of five indistinguishable "Apply, button" announcements |
| Canvas SVG scene | `role="application"` on the SVG root with a top-level `aria-label` describing the sketch and detection count; each detection `<g>` gets `role="button"` + `aria-label` composed from class/source/confidence (e.g. "button, model-detected, 92% confidence, selected") + `aria-pressed` reflecting selection state |
| Status bar segments | Each segment is a live region (`aria-live="polite"`) only for the detect-job segment (progress changes are exactly the kind of transient update `aria-live` exists for); the others are static and need no live region |
| Toasts | `role="status"` (success/info) or `role="alert"` (error) so screen readers announce them without requiring focus to move there |

## Tooltips

Every tooltip is triggered by hover **and** keyboard focus (see
[component-specification.md](component-specification.md)) — a control whose meaning
depends on a tooltip must be reachable and explainable without a mouse. Tooltip text
duplicates (never replaces) the element's accessible name — a screen reader user gets
the same information a sighted mouse user gets from hovering.

## Form labels

Unchanged from today's already-correct pattern: every input pairs a real `<label
htmlFor>` with its control (Phase 1 audit §20 confirms this is already done right in
the Inspector). This spec's `Field` component enforces the pairing structurally — it
is not possible to render a `Field` without a label prop.

## Dialog focus contract

| Moment | Behavior |
|---|---|
| Open | Focus moves to the dialog's designated initial element — the *safer* default action for a destructive dialog (e.g. "Cancel" in the delete-project `ConfirmDialog`), the primary action for a neutral one |
| While open | Focus is trapped inside the dialog; `Tab` from the last element cycles to the first |
| Close (any method — button, `Escape`, overlay click) | Focus returns to the element that opened the dialog |
| Screen reader announcement | Dialog root has `role="dialog"` + `aria-modal="true"` + `aria-labelledby` pointing at its title |

## Color contrast

Every text/background pairing in [design-tokens.md](design-tokens.md) is chosen to
meet **WCAG AA** (4.5:1 for text below 18px/14px-bold, 3:1 at or above) — this directly
resolves the audit's §20 finding that today's 9–10px gray-400 text on white likely
fails AA. Concretely:

- `color-text-muted` (`#848da0`) on `color-surface` (`#ffffff`) is verified ≥ 4.5:1
  and is never used below `text-xs` (12px) — the type scale's 11px floor
  (`text-2xs`) is reserved for `color-text-primary`/`color-text-secondary` or
  canvas-context labels where a colored stroke provides the primary distinguishing
  signal, not for muted gray at the smallest size.
- All five detection/canvas colors are checked against both their own fill and the
  sketch-image backdrop they render over, not just against white.

## Selected-state indicators

Every "this is selected" moment in the system is legible without color, continuing
the canvas's existing good practice (see [canvas-design.md](canvas-design.md)'s
distinguishing-state table) system-wide:

| Context | Color signal | Non-color signal |
|---|---|---|
| Canvas detection | `color-selection` stroke | thicker stroke (2.5px vs 1.5px) + resize handles appear |
| Tree row | `color-selection-subtle` background | `aria-selected="true"` + (new) a small leading indicator bar |
| Tab | `color-primary` underline | `aria-selected="true"` on the tab element |
| Dashboard card | N/A (no persistent selected state) | — |

## Non-color state indicators — summary

This principle is applied everywhere state is communicated, not only on the canvas:
dirty vs. applied Inspector sections use a dot **plus** distinct caption text ("Unapplied"
vs. "Applied"), not color alone; toast variants use a left-edge color bar **plus** a
distinct icon per variant (check / exclamation / info glyph); error inputs get a
`color-error` border **plus** adjacent error text, never a border color change alone.

## Reduced motion

`prefers-reduced-motion: reduce` disables every transition token
(`motion-fast`/`normal`/`slow`) beyond an instant state change or a short opacity
crossfade — see [design-tokens.md](design-tokens.md)'s Motion section. This applies
uniformly (accordion expand, drawer slide, toast enter, dialog scale) rather than
per-component opt-outs.
