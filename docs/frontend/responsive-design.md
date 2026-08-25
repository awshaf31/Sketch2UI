---
title: "Sketch2UI — Responsive Design Strategy"
deliverable: "Phase 2, Deliverable 10"
---

# Responsive Design Strategy

Per the brief: the full editor does not need to become identical on mobile. Sketch2UI
is a precision annotation tool — drawing accurate bounding boxes on a phone screen
with a finger is not a workflow this product should pretend to support well. This
strategy makes that an explicit, communicated decision instead of today's silent
breakage (Phase 1 audit §19).

## Breakpoints

| Name | Range | Primary target |
|---|---|---|
| Desktop | ≥ 1280px | Full workspace, all four regions visible simultaneously |
| Laptop | 1024–1279px | Full workspace, narrower default panel widths |
| Tablet | 768–1023px | Workspace with Layers/Inspector as drawers, not fixed columns |
| Mobile | < 768px | Dashboard fully usable; Workspace shows a guidance screen, not a broken layout |

## Dashboard at every size

Already fluid (audit §19) — no structural change needed beyond token application:

- **Desktop/Laptop/Tablet**: card grid at 2–3 columns (`minmax(240px, 1fr)`)
- **Mobile**: single column, `ProjectCreateForm`'s button wraps below the input under
  ~360px rather than compressing

## Project Workspace by breakpoint

### Desktop (≥1280px)

All four regions visible at once, as specified in
[workspace-design.md](workspace-design.md): Layers (240px) — Canvas (flex) —
Inspector (320px), with the Code/Preview dock below.

### Laptop (1024–1279px)

Same structure, narrower defaults: Layers collapses to 200px, Inspector to 280px, both
still user-resizable via a drag handle on their inner edge (**new** capability — panels
are not resizable today; see [design-to-code-mapping.md](design-to-code-mapping.md)).
This directly targets the audit's §4 finding of a 1366px laptop being left with only
~630px of canvas — the new proportions leave meaningfully more.

### Tablet (768–1023px)

Layers and Inspector **become drawers** rather than fixed columns:

- Canvas takes the full width by default.
- A toolbar toggle opens Layers as a left-anchored overlay drawer (`shadow-modal`,
  slides in over the canvas, dismissed by tapping outside or re-toggling).
- Selecting a detection auto-opens the Inspector as a right-anchored overlay drawer
  with the same behavior — mirroring how a selection already auto-populates the
  Inspector today, just changing *where* it appears.
- The bottom dock becomes a full-screen modal reached via the Preview/Code tab toggle
  in the toolbar, rather than a persistent docked panel — there isn't vertical room for
  a permanent split at this height.

### Mobile (< 768px)

**The Workspace does not attempt the full editor.** Per the brief's explicit
permission to define what becomes unavailable: below 768px, `/projects/:id` renders a
dedicated `WorkspaceUnavailable` screen instead of a cramped version of the desktop
layout:

- Project name + a short explanation: "The project workspace needs a larger screen for
  precise annotation. Open this project on a tablet or desktop to continue."
- A read-only summary is still shown — project status, asset thumbnail if one exists,
  and (if a code version exists) a link to view the live Preview alone, full-screen,
  since *viewing* a generated page has no precision requirement the way *annotating*
  does.
- Upload is **not** offered on mobile — starting a project requires accurate
  drag/drop-scale interaction the empty-state dropzone doesn't need, but the
  *following* annotation step does, so gating upload too avoids a dead end where a
  user uploads successfully and then hits a wall.

This is a deliberate product boundary, not a gap — stated on-screen rather than left
for the user to discover through a broken layout, which is the direct fix for the
audit's §19 framing note ("today a narrow window just silently breaks rather than
saying so").

## Summary table — what remains visible / collapses / becomes a drawer / becomes unavailable

| Region | Desktop | Laptop | Tablet | Mobile |
|---|---|---|---|---|
| Toolbar | visible | visible | visible (condensed) | N/A (unavailable screen) |
| Status bar | visible | visible | visible, segments may truncate to icons | N/A |
| Layers | fixed column | fixed column, resizable | drawer | N/A |
| Canvas | fixed region | fixed region | full-width default | N/A |
| Inspector | fixed column | fixed column, resizable | drawer, auto-opens on select | N/A |
| Code/Preview dock | resizable dock | resizable dock | full-screen modal | Preview-only, if a version exists |
| Upload | inline dropzone | inline dropzone | inline dropzone | unavailable |

## Touch targets

Wherever a drawer/modal pattern activates (tablet and below), interactive targets grow
to a minimum 40×40px hit area regardless of their visual size — the same components,
larger tap area via padding, not a separate touch-specific component set.
