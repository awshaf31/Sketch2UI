---
title: "Sketch2UI — Redesign Blueprint"
status_date: "2026-08-27"
purpose: "Concrete visual specification for the four highest-value redesign items identified in the UI/UX gap analysis (docs/frontend/ui-ux-gap-analysis-2026-08-27.md). Mockups only — no code was written or changed. This document plus the published mockup canvas is meant to be specific enough for a frontend engineer to implement without guessing."
mockups: "https://claude.ai/code/artifact/03484350-2de2-4541-bcc8-a89f84e77c71 (5 artboards: Main, GeometryEditor, Dashboard, SectionStates, Auth)"
extends: "docs/frontend/design-direction.md, docs/frontend/design-tokens.md — this document introduces no new colors, fonts, spacing values, or radii beyond what those two files already define"
---

# Sketch2UI Redesign Blueprint

This is the design specification requested after the UI/UX gap analysis: concrete mockups and behavior for the four highest-value items, built entirely from Sketch2UI's own existing design tokens and components (read directly from `apps/web/tailwind.config.js`, `Card.tsx`, `Button.tsx`, `Input.tsx`, `Badge.tsx`, `AccordionSection.tsx`, and `InspectorPanel.tsx`), not from the outside inspiration images. Nothing here is implemented — this is the plan to hand a frontend engineer.

Every proposal keeps the product's own stated identity intact: a precision drafting instrument, flat surfaces, hairline borders as the primary structural device, shadow reserved for menus and modals only, IBM Plex Sans for chrome and IBM Plex Mono for data, small consistent radii, no gradients used decoratively, no glassmorphism, no pill-shaped general controls.

---

## Part A — The four mockups

### Mockup 1 — Inspector Geometry spatial editor

**Purpose.** Replace the Geometry accordion section's four isolated numeric fields with a visual control that shows position, size, and edge relationships at a glance, while keeping exact numeric entry — the way a CAD or vector tool presents spatial data, which is the reference point the product's own direction document already names.

**Current problem.** `InspectorPanel.tsx` (around line 792) renders `x`, `y`, `width`, `height` as four separate mono-font number inputs with no visual reference to the sketch. A user has to hold the spatial relationship in their head — there's no way to see, at a glance, how close a box sits to the page edge or how a change to one field will move it relative to everything else.

**Proposed solution.** A 368×224px spatial diagram sits between the section's helper text and its four numeric fields, inside the same Geometry accordion body. An outer dashed rectangle represents the page boundary, drawn in the exact `page-boundary` token (`#e11d48`) the live annotation canvas already uses for this purpose. An inner rectangle represents the selected detection, drawn in the `selection` token (`#f97316`) — the same hue the canvas already reserves for "this is selected." Eight small square handles (four corners, four edge midpoints) sit on the inner box. Thin dashed guide lines connect the box's edges to the boundary's edges, each labeled in mono type with the value it represents: `x` and `y` directly, and the two derived margins (`1 − x − width`, `1 − y − height`) so the gap to the right and bottom edges is visible without mental math. The four existing numeric fields stay exactly where they are today, unchanged, directly below the diagram.

**Layout.** See the `Main.dc.html` artboard for the diagram in context inside the full panel, and `GeometryEditor.dc.html` for a zoomed, three-state close-up. Diagram: 368×224px, 12px inset for the boundary rectangle, 1px border + `surface` background, no border-radius (the diagram reads as a precise technical drawing, not a card). Handles: 6×6px squares, white fill, 1.5px `selection`-colored border.

**Component hierarchy.** A new `GeometrySpatialEditor` component in `apps/web/src/features/inspector/`, taking the same `geometryDraft` / `selected.bbox` values `InspectorPanel.tsx`'s Geometry section already computes — no new data model. It sits above the existing `Field`/`Input` grid, which is untouched. Both the diagram and the fields read and write one shared `geometryDraft` state object, so dragging a handle and typing a number are two paths to the same value, never two sources of truth.

**Interaction behavior.** Dragging a handle updates the matching field(s) live (a corner handle touches two values, an edge handle touches one); typing in a field updates the diagram live. Both feed the exact same debounce-then-draft-then-Apply model the section already has — nothing is written to the server until "Apply" is clicked, exactly as today. Hovering a handle enlarges and fills it, and shows a small dark coordinate chip near the pointer with the live value pair, mirroring the mono, data-gets-its-own-typeface convention.

**States.**

| State | Diagram | Fields | Footer |
|---|---|---|---|
| No override (inherited) | Dashed muted outline, no fill | Muted placeholder text showing the raw detection value | "No override" (muted), Apply disabled |
| Hovering a handle | Handle enlarges + fills `selection`; live coordinate chip | Unchanged | "Applied" (success) if already applied |
| Dragging | Solid `selection` outline + light fill; active guides; dragged handle filled `primary` with an outline ring (not a shadow) | The field matching the dragged handle highlights in `primary` | "Unapplied" (warning); Reset + Apply both active |
| Applied | Solid `selection` outline + light fill, static | Values shown in mono, normal weight | "Applied" (success); Reset + Apply |

**Responsive.** The diagram scales down proportionally as the Inspector narrows, with a floor around 180px so handles stay usable; below that, defer to whatever breakpoint `docs/frontend/responsive-design.md` already defines for the workspace shell's collapse behavior, rather than inventing a new one here — this blueprint doesn't introduce a new breakpoint, it should verify against the existing one at implementation time.

**Accessibility.** Each handle needs a hit target larger than its visible 6px square (a ~24px invisible touch area, per WCAG 2.5.8 target size). The diagram must never be the *only* way to set a value — the four numeric fields already satisfy this and should be marked as the primary interactive path for screen-reader and keyboard-only users, with the diagram itself `aria-hidden` and treated as a live illustration of the same state, not a duplicate control. Inherited-vs-applied is already encoded redundantly in both shape (dashed vs. solid) and the footer's text label, not by color alone. The 11px mono guide labels should get a contrast check at implementation time against `surface` — the same check that already produced the `text-muted` fix recorded in `design-tokens.md` (DEF-003) applies here.

**Unchanged.** The normalized `[0,1]` coordinate model, inherit-on-blank-field semantics, the draft-then-Apply flow, the Reset/Apply buttons and their exact copy ("No geometry override" / "Unapplied" / "Applied"), the dirty/applied dot convention on the accordion header, and the `GeometryOverride` data contract. This is a presentation change only — no API, schema, or state-machine change.

---

### Mockup 2 — Dashboard project cards

**Purpose.** Make the project thumbnail the primary way a user recognizes a project, replacing a name string as the only identifying information.

**Current problem.** `Dashboard.tsx`'s "Recent projects" cards show only a name and a status word. The only place a sketch thumbnail exists is a transient client-side object URL during project *creation* — it's revoked on unmount and never shown again once the project exists.

**Proposed solution.** Each card gains a 272×148px thumbnail region above its existing content, using the sketch image already served by the ownership-gated route (`GET /api/projects/:id/pages/:pageId/assets/:assetId/image`, per the project overview) for that project's first page. Below the thumbnail: the project name, a status `Badge` (reusing the real `Badge` component and its `success`/`neutral` tones instead of the current plain status text), and one metadata line built only from fields the app already has — page count (real: projects are multi-page) and the created date (real: already shown in the admin Projects table). No invented fields (no fabricated "updated" timestamp, no fake view counts).

**Layout.** See `Dashboard.dc.html` for the toolbar (unchanged) plus four card states in context. Card: 272px wide, 10px radius (matches the existing `Card` component's `rounded-lg`), 1px border, thumbnail cropped with `overflow: hidden`, 16px internal padding below the thumbnail (matches the existing `Card`'s `p-lg`).

**Component hierarchy.** The existing `Card` component (`apps/web/src/components/Card.tsx`) wraps the whole thing, unchanged. A new `ProjectThumbnail` component fetches and renders the image (or a placeholder pattern when none exists) and is the only new piece; name, `Badge`, and metadata are composed from existing primitives. The existing hover-reveal rename/delete `IconButton`s move onto the thumbnail's top-right corner instead of the card's top-right corner, but are otherwise the same components with the same handlers.

**Interaction behavior.** Unchanged from today: click the card to open the project, hover or focus to reveal rename/delete, click the name to start an inline rename. The only new behavior is the thumbnail itself, which is not interactive on its own (clicking anywhere on the card still opens the project).

**States.**

| State | Thumbnail | Notes |
|---|---|---|
| Generated, resting | Real sketch/preview image | Card border default |
| Hovered / focused | Same image, rename/delete icons fade in over it | Border strengthens to `border-strong`, `shadow-subtle` — both already the `Card`'s existing `interactive` hover treatment |
| Draft, no sketch yet | Neutral diagonal hairline pattern (`surface-sunken` / `border`), not an illustration | Distinguishes "nothing uploaded yet" from a broken image, without inventing decorative art |
| Loading | Flat `surface-sunken` block matching the new card's proportions | Prevents the grid reflowing once data arrives, same purpose as today's skeleton |

**Responsive.** The grid already reflows by column count at existing breakpoints; the taller card (thumbnail + content vs. today's fixed 92px) needs the grid's row height to go from fixed to auto, which is a one-line change since the grid is already CSS grid/flex with `gap`, not fixed row heights elsewhere in the app.

**Accessibility.** The thumbnail image needs `alt` text describing it as a preview of the project (e.g. `alt="Preview of {project.name}"`), not empty/decorative, since it now carries real identifying information. Status continues to be conveyed by text inside the `Badge`, not color alone. Hover-revealed actions must also appear on keyboard focus (`focus-within`), which is already how the current implementation handles this — no regression.

**Unchanged.** Card click-to-open, inline rename, delete confirmation flow, the search/filter toolbar, the "New Project" creation card, and the `EmptyState`/`ErrorState` components for zero-results and error cases — none of these needed a redesign and none were touched.

---

### Mockup 3 — Inspector section grouping states

**Purpose.** Make the Inspector read as a set of distinct, scannable instruments rather than one long form, using the app's own border-as-structure logic rather than importing floating cards or shadows.

**Current problem.** `AccordionSection.tsx` separates sections with only a single `border-t` hairline. Nothing distinguishes "this section is open and being worked in" from "this section is closed" beyond the chevron's rotation — there's no hover feedback, and a section with unapplied edits is only marked by a small dot that's easy to miss.

**Proposed solution.** Extend the *same* component with one additional visual state: when a section's header is open or hovered, it takes on the `surface-sunken` background (`#eef0f4`) — a token the app already uses for recessed/inactive areas — rather than introducing a new color, a shadow, or a wrapping card with margins. The hairline dividers stay exactly where they are; the header now reads as a tinted strip within them, closer to how a real instrument panel (a CAD tool's properties editor) marks its active section than to a marketing-style card. The existing dirty/applied dot convention is kept and stays visible even when the row isn't hovered.

**Layout.** See `SectionStates.dc.html` — five states shown side by side, each as two stacked sections (so the divider behavior between an affected and unaffected section is visible, not just one row in isolation).

**Component hierarchy.** `AccordionSection.tsx` gains two things: a CSS state for `data-open`/hover that applies `bg-surface-sunken` to the header (and, while open, to the body as well, so the whole open section reads as one tinted unit), and nothing else — no new props beyond what already exists (`title`, `defaultOpen`, `dot`). This is the lowest-risk item in the whole blueprint: one component, no new state, no new data.

**Interaction behavior.** Unchanged — the same click-to-toggle behavior, the same `aria-expanded` wiring, the same per-section local open/closed state that already persists across selecting a different detection.

**States.**

| # | State | Visual delta from today |
|---|---|---|
| 1 | Resting, collapsed | None — this is today's default |
| 2 | Hovered | Header background tints to `surface-sunken`; label and chevron darken to `text-secondary` |
| 3 | Expanded | Header *stays* tinted while open (today it doesn't); chevron rotates to point down; body gets consistent padding |
| 4 | Keyboard focus | The app's existing global `:focus-visible` outline (2px solid `focus`/`primary`, `-2px` offset so it never clips) now visibly wraps the header — today's plain `button` already inherits this from `index.css`, so this is a visual confirmation, not new code |
| 5 | Unapplied edits | The existing `dirty` dot (`warning` amber) is now easier to spot against the tinted-on-hover header |

**Responsive.** No change — the Inspector's accordion already works identically at every width the workspace supports; this is a color/state treatment, not a layout change.

**Accessibility.** No regression: `aria-expanded` stays wired exactly as today; the focus outline is the app's existing global treatment, not a new one; the hover tint is decorative reinforcement of state that's already conveyed by the chevron rotation and `aria-expanded`, so it changes nothing for assistive technology.

**Unchanged.** Every section's field content, the Apply/Reset footer pattern, the dot semantics (`applied` = `selection` orange, `dirty` = `warning` amber), and the six-section order already in the app.

---

### Mockup 4 — Authentication direction (lower priority)

**Purpose.** Give Login/Register a first-impression that matches the rest of the product, without borrowing the inspiration set's photography, gradients, or glass panels — explicitly ruled out by the brief.

**Current problem.** Per the earlier gap analysis, this was already improved on 2026-08-26 (soft background tint, password show/hide toggle) and is reasonably aligned with the product's direction today. The one structural thing still worth questioning: a floating card on a flat tinted field is itself a mild echo of generic SaaS chrome, when the app's own vocabulary — borders as structure, not shadow — has a more native answer.

**Proposed solution.** Replace the floating card with two bordered panels and one hairline divider, at desktop width: a left panel (tinted `surface-sunken`, matching the Inspector's own recessed-area token) holding the wordmark and a small, honest, functional graphic — a rough "sketch" rectangle transforming through an arrow into a crisp "generated UI" rectangle, built from the same stroke-rectangle vocabulary as everything else, not a photo or illustration — and a right panel (plain `surface`) holding the actual form, unchanged in content from today (email, password with show/hide, submit, register link).

**Layout.** See `Auth.dc.html`: desktop 860×560px two-panel frame (420px left panel, flexible right panel), plus a smaller mobile frame showing the left panel dropped entirely rather than stacked above the form.

**Component hierarchy.** No new components needed beyond a small `AuthSplitLayout` wrapper; `Login.tsx` and `Register.tsx` keep their existing form markup (`Input`, `PasswordInput`, `Button`) exactly as-is inside the right panel — this only changes what wraps the form, not the form itself.

**Interaction behavior.** Unchanged — same fields, same validation, same submit flow, same password show/hide toggle already shipped.

**States.** Not applicable beyond standard form states (default/invalid/loading), which are already handled by the existing `Input`/`Button` components and untouched here.

**Responsive.** Below 640px, the left panel is removed from the layout entirely (not hidden with `display:none` after stacking — never rendered in that breakpoint), leaving one honest column with the form, matching the "no hero section" rule at every width, not just desktop.

**Accessibility.** The sketch→UI graphic is decorative/illustrative and should be `aria-hidden`; it carries no information not already conveyed by the product's marketing page. Landmark structure (`main`, one `h1`) stays as it is today.

**Unchanged.** Everything about the actual authentication flow: fields, validation, error states, the password toggle, and the Register page's identical treatment (this mockup covers Login only; Register follows the same panel pattern with its own existing form content).

**Priority note.** This is explicitly the lowest-priority item of the four — build it last, if at all, after the workspace and dashboard changes.

---

## Part B — The blueprint

### 1. Global visual language

No new tokens are introduced anywhere in this blueprint — every value below already exists in `apps/web/tailwind.config.js`.

| Aspect | Spec |
|---|---|
| Typography | IBM Plex Sans (400/500/600) for all UI chrome; IBM Plex Mono (400/500/600) reserved for data — coordinates, class names, confidence, code. Both already loaded via Google Fonts in `index.html`. |
| Type scale | 11 / 12 / 13 / 14 / 16 / 18 / 22 / 28px (`2xs`…`2xl`). 11px is the documented floor — nothing smaller anywhere. |
| Color | Neutrals: `bg` #f4f5f7, `surface` #ffffff, `surface-sunken` #eef0f4, `border` #dde1e8, `border-strong` #c3c9d4, `text-primary` #171a21, `text-secondary` #4b5262, `text-muted` #5d6679. Brand: `primary` #2f5fdd (`hover` #2650bd, `active` #1f429a, `subtle` #e9eefc). Selection: `selection` #f97316. Canvas-state: `detection-model` (violet) #8b5cf6, `detection-manual` (green) #10b981, `page-boundary` (rose) #e11d48. Status: `success` #047857, `warning` #b45309, `error` #dc2626, `info` #0284c7 (each with a `-subtle` tint). |
| Spacing | 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48px (`2xs`…`3xl`), applied through flex/grid `gap`, never per-element margin stacking. |
| Borders | 1px hairlines (`border`, `border-strong`) are the primary structural device — this blueprint adds exactly one new *use* of an existing color (the `surface-sunken` tint on accordion headers), no new border treatment. |
| Radius | 4px (`sm`, controls), 6–10px (`md`/`lg`, panels and cards), pill (status badges only). The two mockups with a bespoke spatial diagram (Geometry, Auth's sketch graphic) intentionally use sharp corners (0px) for their diagram elements — those are illustration geometry, not reusable UI chrome, and read more precise without rounding. |
| Shadow | `shadow-none` by default everywhere in-flow; `shadow-subtle` only on interactive-card hover/focus; `shadow-elevated`/`shadow-modal` reserved for things that leave the page plane (menus, dialogs). The Geometry editor's hover/drag/active states use `outline`, not `box-shadow`, for exactly this reason — an outline is a focus/state ring, not elevation. |
| Density | The workspace (Inspector, Layers, Canvas) stays dense by design — a CAD tool, not a content page. The Dashboard is allowed to breathe more, as it already does. |
| Interaction states | Hover, focus-visible (2px solid `focus`/`primary`, `-2px` offset, already global in `index.css`), active/pressed, disabled (50% opacity, already the `Button` convention) — every new component in this blueprint reuses these four states verbatim rather than inventing new ones. |

### 2. Workspace design

Of the workspace's five regions — Navigator, Canvas, Inspector, Preview, Code — **only the Inspector changes** in this blueprint (Mockups 1 and 3). The Navigator (Pages/Layers/Assets tabs), Canvas (annotation/detection/boundary drawing), and the Preview/Code dock are explicitly out of scope: the 2026-08-26 polish pass already addressed the dock's collapse behavior and canvas label clutter, and the gap analysis found nothing new to flag there. Redesigning them now would violate the brief's own "do not redesign unrelated screens yet" instruction.

### 3. Inspector redesign

Section treatment: extend `AccordionSection.tsx` with a `surface-sunken` tint on hover and while open (Mockup 3) — one component, no new props, no new data. Geometry editor: a new `GeometrySpatialEditor` component, additive to the existing four fields, sharing their draft state (Mockup 1). Interaction states: both changes reuse the app's existing hover/focus-visible/dirty-dot vocabulary rather than adding new state machinery.

### 4. Dashboard redesign

Project cards gain a thumbnail, a real `Badge` for status, and one metadata line from real fields (Mockup 2). The toolbar (search + "New Project") is unchanged. The empty-state and error-state paths already use the token-consistent `EmptyState`/`ErrorState` components (icon + title + description, no illustration) and need no change — they were checked against the same "no illustrated empty states" rule this blueprint follows and already comply.

### 5. Authentication direction

Lower priority (Mockup 4): two bordered panels replace the floating card, with a functional (not decorative) sketch→UI graphic on the left at desktop width, dropped entirely on mobile. Build this last, if at all.

### 6. Responsive principles

Every proposal in this blueprint reuses breakpoints and collapse patterns the app already has (per `docs/frontend/responsive-design.md`) rather than introducing new ones: the Inspector's accordion behavior is width-independent, the Dashboard grid already reflows by column count, and the Auth split panel removes its left panel below 640px rather than stacking it (stacking would reintroduce a "hero section" the direction document rules out). Nothing here should require a new breakpoint to be defined.

### 7. Accessibility principles

Four rules apply across all four mockups: never let color alone carry a state (every state above pairs a color change with a shape, text, or icon change); every new interactive element gets the app's one existing focus-visible treatment, not a bespoke one; touch/click targets meet the 24px+ effective minimum even where the visual element is smaller (the Geometry editor's 6px handles); and any new supplementary graphic (the spatial diagram, the Auth sketch→UI illustration) is `aria-hidden` with the real interaction available through real form controls, never the other way around.

### 8. Implementation order

Ordered by value-to-risk, matching the gap analysis's priority and each item's actual engineering scope:

1. **Dashboard project thumbnails** (Mockup 2) — isolated to one screen, reuses an existing API route, no shared-component changes. Lowest risk, high visibility.
2. **Inspector section tinted grouping** (Mockup 3) — a CSS/state change to one existing component (`AccordionSection.tsx`), touching every section for free. Very low risk.
3. **Geometry spatial editor** (Mockup 1) — the highest-value item and the most work: a new component with drag interaction, wired to existing state. Build after 1–2 so the surrounding Inspector chrome (section treatment) is already in place to build inside.
4. **Authentication split layout** (Mockup 4) — optional, lowest priority, no dependency on the other three; take on only if time remains.

Deliberately not touched by this pass, and not implied by anything above: the Navigator, the annotation Canvas, the Preview/Code dock, and the admin suite — all confirmed already consistent with the app's design direction in the prior gap analysis.
