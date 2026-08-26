---
title: "Sketch2UI — Final-deadline SaaS polish audit"
status_date: "2026-08-26"
purpose: "Visual/UX audit ahead of the academic deadline. D0-D5, S1-S14 (public site, app shell, dashboard, admin) are already built and previously visual-QA'd (Phase S13) — this pass looks for what's still rough, not what to rebuild."
---

# Method

Live-verified against the actually-running stack (web:5173, api:4000, cv-worker:8000,
already up from a concurrent session — reused per the port-collision workflow note).
Registered a throwaway user, drove the full upload → detect flow via direct API calls
(the Browser tool's synthetic file-input injection has a known truncation issue per
`docs/execution/phase-log.md`'s Phase D5 entry, so a real multipart upload was used
instead), then inspected the resulting workspace visually at both a narrow (~800px)
and a real desktop (1440px) viewport. Every finding below was reproduced and traced to
its source file — nothing here is a guess from a screenshot alone. Admin was not
re-screenshotted live (role-promotion requires a server restart to take effect under
the JSON store's in-process cache, and it was already dedicated-visual-QA'd in Phase
S13 with two real bugs found and fixed) — skipped to avoid restarting a dev server a
concurrent session may depend on, not because it's assumed fine.

Two things investigated and **ruled out** as real problems, worth recording so they
aren't re-litigated:
- The workspace toolbar (Detect / Approve for training / Export ZIP / Save version)
  looked same-weight in a screenshot, but `WorkspaceToolbar.tsx` already gives Detect
  `variant="primary"` and Approve/Export the `tinted` variant, with Save version as
  plain `secondary` — a deliberate, sound hierarchy. Not a finding.
- `/login` appeared to render the authenticated app nav simultaneously with the login
  form once. Could not reproduce on a clean retry (fresh login → navigate to
  `/login`) — logged-in users correctly see a plain, unauthenticated-looking header
  there today. Treated as a one-off client-routing render artifact from a rapid
  logout-then-navigate sequence in the test harness, not a product bug.

# Findings

## P1 — Workspace: Preview/Code dock permanently claims 40% of the vertical viewport, uncollapsible

**File:** `apps/web/src/features/workspace/WorkspaceBody.tsx:86` (desktop layout)

The dock (`Panel bordered="top" className="h-[40%] shrink-0"`) is a fixed height with
no collapse/expand control, on both desktop and tablet (`h-[32%]`). Confirmed via DOM
inspection: even after clicking "Fit sketch to screen," the canvas viewport itself is
only ~418px tall in a 900px-tall window — the dock eats the rest, all the time, even
while a user is heads-down in Detect/Correct and has no use for Preview/Code yet. The
codebase's own comment already flags this as unfinished: *"the dock's height is a
fixed 32%/40% for now, not yet resizable/collapsible — code-preview-design.md's
resize/collapse behavior is explicitly a later-phase capability."*

**Why it hurts:** the single most important surface for the core workflow (upload →
detect → correct → inspect) is permanently squeezed to make room for a panel that's
only relevant two steps later. This is the biggest gap between the current workspace
and "feels like a professional visual builder."

**Fix:** add a collapse/expand toggle to the dock header (next to the Preview/Code
tabs) that shrinks it to just its tab-bar height when collapsed, returning the full
40%/32% when expanded. No new dependency, no layout system change — a boolean state
plus a conditional height class.

**Risk:** low. Touches one layout component and its two call sites' props; existing
`preview`/`code` state and content are untouched.

## P1 — Canvas: every detection's label + confidence score renders permanently, causing heavy visual clutter

**File:** `apps/web/src/features/annotation/AnnotationCanvas.tsx:369-378`

Reproduced against a real 21-detection sketch (`tests/fixtures/final-demo/sketch.png`,
the CV worker's actual output, not a mock). Every detection box — selected or not —
always renders `{className} {confidence.toFixed(2)}` directly on the canvas. In dense
regions (the 4-up card grid in the test sketch), overlapping labels become nearly
illegible and the sketch underneath is substantially obscured by purple dashed boxes
and text, before a user has selected anything.

**Why it hurts:** this is exactly the "excessive visual noise" / "poor selected-state
feedback" pattern called out as a priority — the canvas should read calmly at rest and
surface detail on demand (hover/selection), not shout every box's stats at once.

**Fix:** de-emphasize unselected detections' text — drop the confidence-score suffix
except on hover/selection, keep just the class name, and render it lighter/smaller by
default (already-selected detections keep full detail, since that's exactly when the
user wants it). Scoped to this one component; no prop/API change.

**Risk:** low.

## P1 — Login / Register feel disconnected from the rest of the product

**Files:** `apps/web/src/pages/Login.tsx`, `apps/web/src/pages/Register.tsx`

Both render a small, low-contrast-branding card (`max-w-[400px]`, plain `Card`)
floating in a very large flat gray (`bg-bg`) field, directly below a bare `AppHeader`
that (correctly, since these are unauthenticated) shows just the wordmark with no
nav — but the net effect next to the polished, richly-designed marketing landing page
one click away is a jarring drop in perceived quality. Password fields also have no
show/hide toggle.

**Why it hurts:** RULE 5 ("the entire application must feel like ONE product") and the
brief's own "professional modern AI SaaS" bar — this is the most visible instance of
that not holding, since it's the very first authenticated-flow screen every user sees.

**Fix (small, no new dependencies):**
- A subtle background treatment behind the card (soft radial tint using existing
  `primary-subtle` token — not a new color), and vertically as well as horizontally
  centered on tall viewports instead of pinned near the top.
- A larger, linked brand mark above the card instead of relying solely on the header.
- A password show/hide toggle (new small shared `PasswordInput` wrapping the existing
  `Input`, used by both pages — the only place password fields exist today).

**Risk:** low — purely additive styling plus one small new shared component.

## Minor / not fixing now

- The role-restricted admin error page (`This page is only available to
  administrators.`) renders as a small, top-left-anchored card rather than centered —
  cosmetic, hit only when a non-admin manually visits `/admin`. Left alone; not worth
  the churn this close to the deadline for an edge case with clear, correct messaging.
- Dashboard's header "New Project" button looked redundant next to the always-visible
  inline create-project card — traced to `Dashboard.tsx`'s `focusCreateForm`; it's a
  scroll/focus shortcut for when the list of existing projects has pushed the create
  card out of view, not dead redundancy. Not a finding.

# Implementation order

1. Workspace dock collapse toggle (highest ratio of impact to risk — the core
   workflow screen).
2. Canvas label decluttering (same screen, same visit).
3. Auth page polish (separate, self-contained surface).

Global design system, dashboard, admin, and responsive/accessibility are not being
redone — Phase 2A (tokens) and Phase S13 (visual QA, including a real tablet-overflow
and table-clipping fix) already cover them, and this pass found nothing new there.
