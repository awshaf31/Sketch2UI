---
title: "Sketch2UI — Frontend Design System & UI/UX Specification (Phase 2)"
based_on: "docs/frontend-audit (Phase 1, completed) · PROJECT_STATUS.md · docs/execution/phase-log.md · docs/execution/regression-checklist.md"
status: "Specification only — no application code modified in this phase."
---

# Sketch2UI Frontend Design Specification

This is the index for Phase 2. Phase 1 (the Frontend Audit) established what exists
today, what's broken, what's solid, and what a redesign must not touch. Phase 2 turns
that audit into an implementable specification: tokens, information architecture, and
a per-surface design for every screen and component in `apps/web`.

**No application code changes were made in this phase.** Every file below is
documentation. Implementation begins only after this specification is approved — see
[frontend-implementation-roadmap.md](frontend-implementation-roadmap.md) for the
proposed starting phase.

## How to read this set

Read in this order:

1. **[design-direction.md](design-direction.md)** — the visual personality and the
   principles every other document inherits.
2. **[design-tokens.md](design-tokens.md)** — the concrete color/type/spacing/radius/
   shadow/icon/motion values everything else is built from.
3. **[information-architecture.md](information-architecture.md)** — the two real
   routes, and why there are only two.
4. **[dashboard-design.md](dashboard-design.md)** and
   **[workspace-design.md](workspace-design.md)** — the two screens in full.
5. **[canvas-design.md](canvas-design.md)**, **[inspector-design.md](inspector-design.md)**,
   **[code-preview-design.md](code-preview-design.md)** — the three feature surfaces
   inside the workspace that carry the most redesign risk.
6. **[component-specification.md](component-specification.md)** and
   **[component-hierarchy.md](component-hierarchy.md)** — the reusable primitives and
   how everything nests.
7. **[responsive-design.md](responsive-design.md)** and
   **[accessibility.md](accessibility.md)** — cross-cutting requirements every
   surface above must satisfy.
8. **[design-to-code-mapping.md](design-to-code-mapping.md)** — which existing file
   each spec maps onto, and whether it's a restyle, an extraction, or new.
9. **[frontend-implementation-roadmap.md](frontend-implementation-roadmap.md)** — the
   phased build order, files-per-phase, and acceptance criteria.

## Non-negotiable constraints (repeated in every doc that touches them)

These come directly from `PROJECT_STATUS.md`, `docs/execution/phase-log.md`, and the
Phase 1 audit's §27 (Risks). No document in this set proposes violating any of them:

| Constraint | Why | Where it's load-bearing |
|---|---|---|
| Override maps (Style/Content/Geometry/Structure) key on **detection UUID**, not UI-IR node id | Node ids shift every regeneration; the UUID is the only stable handle | `apps/web/src/pages/ProjectWorkspace.tsx`, all four override routes |
| `CodeVersion` rows are **immutable** — Save always creates a new row | History/rollback correctness | `code-versions.routes.ts`, `CodePanel.tsx` |
| Preview iframe stays `sandbox=""` — **no `allow-scripts`** | The one deliberate security boundary in the app | `PreviewPane.tsx` |
| Content overrides keep rejecting `<`/`>` and `javascript:`/`data:` hrefs | XSS surface into the sandboxed preview | `content-overrides.routes.ts` |
| A corrected model detection flips `source` to `manual` and stores `originalClassName` | Re-detect must never silently overwrite a human correction | `detections.routes.ts` |
| A manually-adjusted page boundary always wins over later auto-detection | Same "human correction is sticky" rule, applied to the boundary | `boundaries` module, `PageBoundaryOverlay.tsx` |
| The e2e suites (`e2e/golden-path.spec.ts`, `e2e/inspector-overrides.spec.ts`) assert exact roles/labels/titles/selectors | Redesign must not silently break CI-equivalent coverage | See [design-to-code-mapping.md](design-to-code-mapping.md) |
| No auth, no multi-page projects, no React/Tailwind export | Explicitly out of scope per `PROJECT_STATUS.md` §4 | This spec proposes zero new routes for these |

## Final output summary

1. **Design direction** — a "precision studio" identity: line-work over shadow, one
   deliberate brand blue that doubles as the canvas's structural-container color, a
   formalized (not accidental) selection-amber, IBM Plex Sans + IBM Plex Mono, restrained
   motion. Full rationale in [design-direction.md](design-direction.md).
2. **Design-system specification** — complete token set in
   [design-tokens.md](design-tokens.md); component-level specs in
   [component-specification.md](component-specification.md).
3. **Page architecture** — exactly the two routes that exist today, formalized. See
   [information-architecture.md](information-architecture.md).
4. **Project Workspace specification** — a restructured shell (canvas centered, Layers
   left, Inspector right, Code/Preview as a bottom dock) that keeps every existing
   action and data flow. See [workspace-design.md](workspace-design.md).
5. **Component hierarchy** — [component-hierarchy.md](component-hierarchy.md).
6. **State specifications** — loading/empty/error/dirty/applying/success states are
   defined per-component throughout §4–§9 rather than as a separate document, since
   they only make sense in context.
7. **Responsive strategy** — [responsive-design.md](responsive-design.md).
8. **Accessibility strategy** — [accessibility.md](accessibility.md).
9. **Implementation phases** — [frontend-implementation-roadmap.md](frontend-implementation-roadmap.md).
10. **Recommended next step** — **Phase 2A, design tokens**, is zero-risk (no component
    or route changes) and unblocks every later phase. See the roadmap's summary table.

**Do not begin implementation until this specification is reviewed and approved.**
