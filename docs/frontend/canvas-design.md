---
title: "Sketch2UI — Canvas Design Specification"
deliverable: "Phase 2, Deliverable 7"
current_implementation: "apps/web/src/features/annotation/AnnotationCanvas.tsx, features/detection/PageBoundaryOverlay.tsx"
---

# Canvas Design Specification

**Preservation first:** the pointer-math engine in `AnnotationCanvas.tsx` and
`PageBoundaryOverlay.tsx` — draw/move/resize, coordinate transforms between screen and
normalized `[0,1]` space, the `MIN_BOX_PX` collapse guard — is not touched by this
spec. Everything below is the visual layer on top of that engine, plus explicitly
flagged *new* capabilities (zoom/pan/legend), each called out as new.

## 1. Page boundary

| Aspect | Spec |
|---|---|
| Stroke | `color-page-boundary` (`#e11d48`), 3px, dashed (`10 5`) — unchanged from current |
| Outside-boundary dimming | `rgba(23,26,33,0.30)` fill outside the polygon, `evenodd` punch — unchanged |
| Handles | 4 corner squares, `10px`, `color-page-boundary` fill, white 1.5px stroke — unchanged |
| Editable state | Toggled by the status bar's "Adjust boundary" control (moved from a banner button to a status-bar segment control, per [workspace-design.md](workspace-design.md)) — same `editingBoundary` state, same drag interaction |
| Label | New: a small `color-page-boundary`-tinted tag anchored to the polygon's top-left corner reading "Page · {confidence}%" — today this information exists only in the removed banner text; moving it onto the canvas keeps it visible without a banner |

## 2. Model detection box

| Aspect | Spec |
|---|---|
| Stroke | `color-detection-model` (`#8b5cf6`), 1.5px, dashed (`6 3`) — unchanged |
| Fill | `rgba(139,92,246,0.06)` — unchanged |
| Label | `{className} {confidence.toFixed(2)}` in `font-mono text-2xs`, `color-detection-model` — unchanged content, now on the token type scale instead of a bare `fontSize={12}` |

## 3. Manual detection box

| Aspect | Spec |
|---|---|
| Container class | `color-detection-container` (brand blue), 1.5px solid |
| Leaf class | `color-detection-manual` (emerald), 1.5px solid |
| Fill | `rgba(47,95,221,0.05)` (container) / `rgba(16,185,129,0.05)` (leaf) |
| Label | `font-mono text-2xs`, matching stroke color |

## 4. Selected detection

| Aspect | Spec |
|---|---|
| Stroke | `color-selection` (`#f97316`), 2.5px solid — **replaces** whatever the unselected stroke was, doesn't layer on top of it, exactly as today |
| Fill | `rgba(249,115,22,0.08)` |
| Handles | 4 corner squares, `8px`, `color-selection` fill — unchanged |
| Label | Same content, recolored to `color-selection` |

## 5. Rejected / outside-page detection

| Aspect | Spec |
|---|---|
| Opacity | `0.35` on the whole box group when not selected — unchanged mechanism |
| Label suffix | `· outside page` appended — unchanged |
| Toggle | "Show rejected" checkbox — moved from the removed boundary banner into the status bar's boundary segment popover ([workspace-design.md](workspace-design.md)), same `showRejected` state |

## Distinguishing state without relying on color alone

Per the brief's explicit requirement, every one of the four states above is encoded on
**at least two channels**, not color alone — this is a formalization of what the
current implementation already does correctly, made explicit as a rule rather than an
accident:

| State | Color | + Stroke pattern | + Opacity | + Label text |
|---|---|---|---|---|
| Model | violet | dashed | 100% | confidence score appended |
| Manual | blue/emerald | solid | 100% | — |
| Selected | orange | solid, thicker (2.5px) | 100% | resize handles appear |
| Rejected | (inherits source color) | (inherits) | 35% | "· outside page" appended |

A colorblind or grayscale rendering still distinguishes all four: dash pattern
separates model from manual, stroke weight + handles separates selected from
unselected, and opacity separates rejected from active.

## 6. On-canvas legend — new

The single most-cited gap in the Phase 1 audit (§14, §23, §25): the color/pattern
mapping above exists only in code comments today. **New** `CanvasLegend` component,
collapsible, bottom-left corner of the canvas panel (replacing today's single caption
line):

```
● Model    ─┄ dashed     ● Container   ● Manual   ● Selected   ▨ Outside page
```

Each swatch is a small (`icon-xs`-sized) rendering of the actual stroke style, not
just a solid dot, so the legend itself demonstrates the dash/opacity distinction it's
explaining. Collapses to a single "?" icon button on narrow viewports or when the
canvas is small — see [responsive-design.md](responsive-design.md).

## 7. Resize handles

Unchanged geometry (4 corners, `nw/ne/sw/se`, cursor matches handle position) — restyled
onto tokens (`color-selection` fill, sized via `icon-sm`-equivalent 8-10px per current
`HANDLE_SIZE`).

## 8. Drag behavior

Unchanged: draw (empty-space drag creates a box), move (drag an existing box), resize
(drag a handle). The `MIN_BOX_PX` collapse guard — a resize/draw that ends up smaller
than the threshold is discarded rather than committed — is preserved exactly; this is
a correctness guard (Phase 1 audit §27), not a visual concern.

## 9. Label display

`font-mono text-2xs` throughout (see [design-tokens.md](design-tokens.md)) — the one
deliberate use of the floor size in the whole type scale, justified because canvas
labels must stay legible at typical sketch resolution without overwhelming small
boxes. Confidence values keep 2 decimal places, unchanged formatting.

## 10. Confidence display

Unchanged: appended to the model-box label only (`{confidence.toFixed(2)}`), never
shown for manual boxes (manual = human-drawn = definitionally full confidence, matches
existing Inspector copy "Manual boxes are 1.0 by definition").

## 11. Zoom — new capability

Not present today (Phase 1 audit §18 notes the *preview* has viewport presets but the
*canvas* has none). New `CanvasToolbar` control group, top of the Canvas panel:

- Zoom percentage readout (`font-mono text-xs`) + `−`/`+` buttons, range 25%–400%,
  25% steps via buttons, free via scroll-wheel-with-modifier (⌘/Ctrl+scroll) or pinch
  on trackpad.
- Keyboard: `⌘/Ctrl +` / `⌘/Ctrl -` / `⌘/Ctrl 0` (reset to 100%).
- Zoom is a CSS-transform on the SVG/image container, not a change to the underlying
  normalized coordinate math — draw/move/resize continue to operate in image space via
  the existing `getImagePoint` scale calculation, which already accounts for
  rendered-vs-natural size and needs no change beyond factoring in the new zoom level.

## 12. Pan — new capability

Space-bar-held + drag (industry-standard convention, matches Figma/Photoshop),
middle-mouse-button drag, or two-finger trackpad scroll when zoomed beyond fit.
Standard scrollable-container behavior otherwise — no custom physics, no momentum
tuning beyond the browser/OS default, keeping with the "no animation for its own sake"
principle.

## Fit-to-screen — new

A dedicated toolbar button (icon: four inward-pointing corner arrows) that computes
the zoom level fitting the full sketch (plus a small margin) into the visible canvas
area, and is also the **default** zoom on first opening a workspace with an asset —
replacing today's implicit "always 100%, scrollable" behavior, which is why laptop
users with a large sketch currently have to scroll to see the whole thing.

## 13. Empty canvas

No asset: not applicable at the canvas-panel level — the whole workspace body is
replaced by `UploadDropzone` (see [workspace-design.md](workspace-design.md)). Asset
present, zero detections: the sketch renders with no overlays and the legend collapses
automatically (nothing to explain yet) — this is new, minor polish, not a functional
change.

## 14. Processing state (Detect job running)

Canvas remains fully interactive during a detect job — manual drawing/correction is
not blocked, matching current behavior (the job runs server-side; the canvas has no
reason to lock). The only visual addition is a slim `color-detection-model`-tinted
progress indicator in the canvas toolbar, mirroring the status bar's detect segment so
the signal is visible even if the user has scrolled the status bar's segment out of
view (status bar segments don't scroll today, but this is defensive redundancy for the
one operation that can take up to 180 seconds, per `useDetectionJob`'s
`MAX_POLL_MS`).
