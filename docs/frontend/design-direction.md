---
title: "Sketch2UI — Frontend Design Direction"
deliverable: "Phase 2, Deliverable 1"
---

# Design Direction

## The one-sentence version

Sketch2UI takes something imprecise — a hand-drawn box on paper — and turns it into
something exact: coordinates, a taxonomy class, a confidence score, real CSS. The
frontend should *look* like the tool that does that: **a drafting instrument, not a
dashboard.**

## Visual personality

**"Precision studio."** The reference points are the tools this product's own users
already trust: a vector/layout editor (Figma), a code editor (VS Code), a CV
annotation tool (CVAT, Labelbox). None of those reach for warm illustration, marketing
gradients, or rounded-friendly SaaS chrome — they read as instruments. Sketch2UI's
chrome should earn the same read, because the product's actual content (bounding
boxes, confidence percentages, generated CSS) already has that character; today's UI
(Phase 1 audit §6–§9) just doesn't reinforce it.

Concretely, that means:

- **Borders do the work shadows do elsewhere.** A 1px hairline is how this app already
  draws its most important content — the detection boxes, the page boundary, the
  resize handles. The chrome around that canvas should extend the same line-work logic
  instead of fighting it with drop shadows and soft gradients. See *Elevation* below.
- **One accent, used on purpose.** The audit found orange doing accidental double duty
  as both "active tab" and "selected box," reinforced nowhere else. This direction
  retires that accident and replaces it with a single deliberate brand blue — see
  [design-tokens.md](design-tokens.md) for why that blue is also reused as the
  canvas's structural-container color, not just a coincidence to avoid.
- **Data gets its own typeface.** Coordinates, class names, confidence scores, file
  paths, and generated code are semantically different from prose — they should look
  different too. Monospace is reserved for exactly that content, never used decoratively.

## Density

The Project Workspace stays **dense by choice**, not by accident. Its users are
annotating dozens of boxes across a session — this is closer to a CAD tool than a
content page, and generous whitespace would cost them scroll distance for no benefit.
The audit's real complaint (§7) wasn't density, it was the *lack of a floor*: text
running down to 9–10px with no readable minimum. This direction keeps the workspace
dense but sets **11px as the smallest UI text anywhere in the app** (see the type
scale) — dense and legible are not in tension if the scale has a floor.

The Dashboard is allowed to breathe more — it's a list-and-launch screen visited
briefly, not worked in for hours, and the current implementation already gets this
half-right (Phase 1 audit §23: "Dashboard and Workspace feel like two different
apps"). This direction keeps that contrast but ties the two together with the same
tokens, so it reads as one product at two zoom levels, not two different products.

## Spacing philosophy

A single 4px base unit, applied through layout (`flex`/`grid` + `gap`), never through
stacked per-element margins. Two spacing rhythms, used consistently by context:

- **Tight rhythm** (`space-2xs`–`space-sm`, 2–8px) inside a control — label-to-input,
  icon-to-label, adjacent inline badges. This is where the workspace's density lives.
- **Structural rhythm** (`space-lg`–`space-3xl`, 16–48px) between regions — panel
  padding, the gap between the Dashboard's header and its project list, the gap
  between Inspector sections. This is where breathing room lives.

Nothing sits between these two rhythms arbitrarily; every spacing value used in a
component maps to a named token (§ [design-tokens.md](design-tokens.md)).

## Border philosophy

1px solid hairlines, using two border tokens (`border`, `border-strong`), are the
**primary structural device** — they separate the toolbar from the canvas, the Layers
panel from the canvas, sections within the Inspector. This directly formalizes what
the current app already does well by accident (every panel boundary today is already
a `border-gray-200` hairline) and extends it as a deliberate rule rather than a
default nobody chose.

## Elevation / shadow philosophy

**Shadow means "this is floating above the page," and nothing else.** In-flow panels
— the Layers panel, the Inspector, the canvas, the code editor — never carry a shadow;
they're part of the drafting surface, delineated by border alone. Shadow is reserved
exclusively for things that genuinely leave that plane: dropdown menus, popovers,
tooltips (`shadow-elevated`), and dialogs (`shadow-modal`, the single strongest
shadow in the system, so a modal never has to compete with anything for "most
elevated"). This is a direct fix for the audit's observation (§4, §23) that today's
banners and any future "elevated" surfaces have no consistent vocabulary for depth.

## Corner-radius philosophy

Small and consistent, never decorative. Inputs, buttons, and badges get a **small**
radius (4px) — enough to soften without looking bubbly. Panels, cards, and dialogs get
a **medium-large** radius (6–10px). **Pill radius is reserved for status
indicators only** (the "Beta" tag, a confidence badge, a dirty-state dot) — never for
buttons or panels, which is where generic SaaS UI tends to over-round everything into
sameness. This keeps rounding meaningful: the eye can tell "this is a status chip"
from "this is a container" by shape alone.

## Icon style

Outline/stroke icons, 1.5px stroke weight, geometric construction — not filled glyphs,
not a decorative/hand-drawn set (which would fight the sketch imagery rather than
frame it). Recommended concrete library: **Lucide** (MIT, tree-shakeable, wide
coverage, already the de facto choice for Tailwind-based tools) — a specific,
implementable recommendation rather than "pick something later." Icons sit at the
sizes defined in [design-tokens.md](design-tokens.md) and are never the sole carrier
of meaning (paired with text or a `title`/`aria-label` — ties directly into
[accessibility.md](accessibility.md)).

## Typography direction

Two families, each doing one job:

- **IBM Plex Sans** — all UI chrome: labels, buttons, body copy, headings. Geometric
  and slightly technical without reading as a "startup font" (a direct alternative to
  the Inter/Space Grotesk defaults the audit's own source material flags as
  overused). Weights: 400 (body), 500 (labels, buttons), 600 (headings/emphasis) —
  700 is not used anywhere; there's no content in this app that needs to shout.
- **IBM Plex Mono** — reserved *exclusively* for data: class names, coordinates,
  confidence percentages, file paths, version labels, and the code editor itself.
  Choosing the mono face from the same type superfamily as the sans keeps the two
  feeling like one considered system instead of two unrelated fonts glued together.

Full scale, weights, and line-heights are in [design-tokens.md](design-tokens.md).

## Interaction style

Direct manipulation stays direct. The canvas's draw/move/resize interactions
(Phase 1 audit §14, §24 — "keep the pointer-math engine") are the product's core
interaction model and are not being redesigned, only re-skinned. Everywhere else:

- **Explicit over implicit.** The existing draft-then-Apply pattern in the Inspector
  (type into a field, nothing persists until you click Apply) is kept and extended —
  it matches the product's own "never silently regenerate a human correction" ethos
  (§4 of the execution plan) and should not be replaced with autosave-on-keystroke.
- **One way to fail loudly, one way to fail quietly.** Blocking, must-acknowledge
  failures (a rejected mutation, a validation error) get an inline error state at the
  point of failure — never a `window.alert()`. Transient, non-blocking outcomes (a
  save succeeded, a version was created) get a toast. This directly resolves the
  audit's §21 finding of three inconsistent error UX patterns.
- **Hover previews intent, click commits it.** A hovered tree row previews its
  detection region with a faint highlight; only a click selects. This is new
  affordance, not existing behavior — flagged as new in
  [design-to-code-mapping.md](design-to-code-mapping.md).

## Animation philosophy

Motion is a **confirmation**, never a **performance**. Every transition in the system
uses one of three durations (`motion-fast`/`normal`/`slow`, see tokens) and one easing
curve — a standard decelerate curve on entrances, its reverse on exits. No spring,
bounce, or elastic easing anywhere; no animated gradients; no page-load choreography.
`prefers-reduced-motion: reduce` disables every non-essential transition and falls
back to instant state changes or a short opacity crossfade only. This is a deliberate
rejection of "AI-generated design" motion patterns (auto-playing hero animations,
scroll-linked reveals) that have no place in a professional tool used for repetitive,
focused annotation work.

## What this direction explicitly avoids

Per the brief, and consistent with the reasoning above:

- **No generic startup dashboard aesthetic** — no hero sections, no marketing-style
  stat cards with big gradient numbers, no illustrated empty states with a friendly
  mascot.
- **No gradients** as a decorative device (a gradient is acceptable only as a
  functional device — e.g. the dimmed area outside a page boundary — never on a
  button, card, or background for visual interest).
- **No glassmorphism** — no frosted/blurred translucent panels. This app's panels are
  drafting surfaces, not floating glass.
- **No animation for its own sake** — see *Animation philosophy* above.
- **No decorative elements** that don't encode information — every color, icon, and
  shape in the redesigned system means something (see [design-tokens.md](design-tokens.md)'s
  semantic-color mapping), continuing the discipline the canvas already has today.
