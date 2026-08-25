---
title: "Sketch2UI — Dashboard Design"
deliverable: "Phase 2, Deliverable 4"
current_implementation: "apps/web/src/pages/Dashboard.tsx"
---

# Dashboard Design

Preserves exactly three existing behaviors — list projects, create a project, delete a
project — and gives each a proper visual and state specification. No new functionality.

## Layout

Single centered column, `max-width: 640px` (slightly tighter than today's `max-w-3xl`,
to keep the project-name input and list from stretching too wide to scan), `space-3xl`
top margin, `space-xl` between major blocks.

```
┌─────────────────────────────────────────────┐
│  AppHeader (brand mark, left-aligned)        │
│                                               │
│  H1  "Sketch2UI"                             │
│  dek  "Turn a hand-drawn wireframe into..."  │
│                                               │
│  ProjectCreateForm (input + primary button)  │
│                                               │
│  ProjectList (cards, one per project)        │
└─────────────────────────────────────────────┘
```

## Top navigation / brand area

No horizontal nav bar — the Dashboard *is* the top level (per
[information-architecture.md](information-architecture.md), there's nowhere else to
navigate to from here except into a project). A slim `AppHeader` row instead:

- **Brand mark**: a small 20×20 geometric corner-bracket icon (echoing the canvas's own
  resize-handle corners — see [design-direction.md](design-direction.md)) + "Sketch2UI"
  wordmark in `text-lg`/600 `font-sans`, `color-text-primary`. Left-aligned, `space-lg`
  from the viewport edge.
- No right-side nav items — no account menu (no auth), no settings icon (no settings
  screen). An empty header would look unfinished; instead the header row is omitted
  entirely in the lowest-fidelity read and the H1 below serves as the sole brand
  moment. **Decision: keep the slim header** for cross-screen consistency with the
  Workspace's toolbar (which does need a brand mark on its "← Projects" side) rather
  than trim it here — see [workspace-design.md](workspace-design.md).

## Primary CTA — Project creation

`ProjectCreateForm`, a single-row form directly under the page dek:

| Element | Spec |
|---|---|
| Input | `text-md`, full remaining row width, placeholder "New project name", `radius-sm`, `color-border` default / `color-primary` focus ring |
| Button | Primary button (see [component-specification.md](component-specification.md)), label "Create project" → "Creating…" while in flight |
| Layout | `flex` row, `gap: space-sm` |
| Validation | Disabled while the trimmed value is empty or a create is in flight — matches current `Dashboard.tsx` logic exactly |
| Success | Navigates straight to `/projects/:id` — unchanged behavior |
| Error | Inline error text (`color-error`, `text-sm`) below the form, replacing nothing structural — matches current behavior, just restyled off tokens |

## Project list

Replaces the current plain `<ul><li>` divider-list with a **card grid** — closing the
audit's §11 gap ("no card component anywhere despite `card` being a first-class
taxonomy class"). This is a presentation change only; the underlying data
(`Project[]` from `GET /api/projects`) and actions (open, delete) are unchanged.

**Grid**: `repeat(auto-fill, minmax(240px, 1fr))`, `gap: space-lg`. Collapses to a
single column under ~480px width automatically via `minmax` — no explicit breakpoint
needed (ties into [responsive-design.md](responsive-design.md)).

**`ProjectCard`** — dimensions and content:

| Element | Spec |
|---|---|
| Container | `radius-lg`, `1px solid color-border`, `color-surface` fill, `shadow-none` at rest, `space-lg` padding |
| Project name | `text-md`/500, `color-text-primary`, single line with ellipsis overflow |
| Status metadata | `text-xs`, `color-text-muted`, e.g. project status string already returned by the API — unchanged data, restyled |
| Delete affordance | An icon-only button (`icon-sm` trash icon), top-right corner, visually quiet (`color-text-muted`, `color-error` on hover) — visible on hover/focus, not always-on, so the grid doesn't read as "every card wants to be deleted" |

### States

| State | Spec |
|---|---|
| **Hover** | `color-border-strong` border, `shadow-subtle` — a small, honest lift, not a big shadow (per the elevation philosophy, this is borderline-justified only because the whole card becomes a click target; kept deliberately subtle) |
| **Focus** (keyboard) | `color-focus-ring` per [accessibility.md](accessibility.md), same visual weight as hover so keyboard and mouse users get equivalent feedback |
| **Selected/active** | N/A — cards don't have a persistent selected state; clicking navigates immediately |
| **Deleting** | Card dims to 50% opacity, delete button becomes a small inline spinner in place of the trash icon, card becomes non-interactive — replaces today's "Deleting…" text label with a state that reads at card-scale |
| **Loading (initial list fetch)** | 3 skeleton cards — flat `color-surface-sunken` rectangles matching card dimensions, no shimmer animation (per the animation philosophy: a static skeleton is enough signal, an animated one adds motion with no informational benefit) |
| **Empty** (zero projects) | Centered `EmptyState`: corner-bracket icon at `icon-lg`×2 scale, "No projects yet" (`text-md`/500), "Create one above to get started." (`text-sm`, `color-text-muted`) — no illustration, no marketing copy, consistent with the direction's "no decorative elements" rule |
| **Error** (list fetch failed) | Replaces the grid with an inline error block: message + a "Retry" secondary button — new, since today's Dashboard has no retry path on a failed list fetch, only project-create errors |

## Delete confirmation

Today this is `window.confirm()`. This spec upgrades it to the system `ConfirmDialog`
component (see [component-specification.md](component-specification.md)) — **the same
underlying guard** (confirm before an irreversible delete), restyled to match the
system instead of using a native browser dialog. No new confirmation step is added
anywhere it didn't already exist.

- Title: "Delete project?"
- Body: `Delete "{project name}"? This cannot be undone.` — same copy as today's
  `window.confirm()` message, verbatim, so the guarantee is unchanged.
- Actions: "Cancel" (secondary), "Delete" (destructive-variant button, `color-error`)
- Focus lands on "Cancel" by default (the safer default for a destructive dialog) —
  see [accessibility.md](accessibility.md) for the full dialog-focus contract.

## Responsive behavior

Already the most naturally responsive screen (Phase 1 audit §19). At narrow widths:

- The card grid collapses to one column via `minmax`, no layout logic needed.
- The create-project row stays a single flex row down to ~360px, then the button
  wraps below the input rather than compressing — full detail in
  [responsive-design.md](responsive-design.md).
