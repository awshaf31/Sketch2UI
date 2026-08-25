---
title: "Sketch2UI — Frontend Implementation Roadmap"
deliverable: "Phase 2, Deliverable 14"
---

# Frontend Implementation Roadmap

Eleven phases (2A–2K), ordered so every phase after 2A can be shipped, reviewed, and
regression-checked independently — no phase requires a later one to be already done.
Each phase ends with the existing [regression-checklist.md](../execution/regression-checklist.md)
re-run in full, per that document's own rule ("run this checklist after every phase").

## Phase 2A — Design tokens

| | |
|---|---|
| **Scope** | Populate `theme.extend` in `apps/web/tailwind.config.js` with every table in [design-tokens.md](design-tokens.md). Add Google Fonts links for IBM Plex Sans/Mono to `index.html`. |
| **Files** | `apps/web/tailwind.config.js`, `apps/web/index.html`, `apps/web/src/index.css` (font-face/base styles only) |
| **Dependencies** | None |
| **Acceptance criteria** | `npm run build` succeeds; no visual change to the running app yet (tokens exist but nothing consumes them) |
| **Test requirements** | `npm run typecheck`, `npm run build` — both existing commands, no new test infra needed for a config-only change |
| **Regression risk** | **None** — zero component files touched, zero behavior changed |

### Result — ✅ Complete (2026-08-25)

**Scope actually delivered** was broader than this table's original config-only
description: the Phase 2A kickoff instruction explicitly pulled the primitive
foundation (Deliverable 6's Button/Input/Select/Tabs/Badge/Tooltip/Panel/Section
Header/Status Indicator) into this phase rather than deferring it to 2B/2C. Tokens
and primitives were both completed; **no existing screen was wired to consume the
primitives yet** — Dashboard and ProjectWorkspace are untouched, per Step 8 of that
instruction.

**Files changed**

| File | Change |
|---|---|
| `apps/web/tailwind.config.js` | Populated `theme.extend` — colors, fontFamily, fontSize, spacing, borderRadius, boxShadow, transitionDuration, transitionTimingFunction. All additive; no default Tailwind key removed. |
| `apps/web/index.html` | Added Google Fonts `<link>`s for IBM Plex Sans (400/500/600) and IBM Plex Mono (400/500/600). |
| `apps/web/src/index.css` | Added `@layer base` block (body background/text from tokens, global `:focus-visible` ring, `::selection` color) and a `prefers-reduced-motion: reduce` block. |

**Files added** — `apps/web/src/components/`: `cn.ts`, `Button.tsx`, `IconButton.tsx`,
`Input.tsx` (+ `Textarea`), `Select.tsx`, `Field.tsx`, `Tabs.tsx` (+ `Tab`), `Badge.tsx`,
`Tooltip.tsx`, `Panel.tsx`, `SectionHeader.tsx`, `StatusIndicator.tsx`, `index.ts`
(barrel export). None are imported by `Dashboard.tsx` or `ProjectWorkspace.tsx` yet.

**Files removed** — none.

**Design tokens implemented** — the full set from
[design-tokens.md](design-tokens.md): all Colors (neutrals, brand/selection,
detection/canvas — defined but not yet wired into `AnnotationCanvas`/
`PageBoundaryOverlay`, per Step 8 — status), the full Typography scale + IBM Plex
Sans/Mono families, Spacing (`2xs`–`3xl` + icon sizes), Radius (`sm`/`md`/`lg`/`pill`),
Shadows (`subtle`/`elevated`/`modal`), Motion (`fast`/`normal`/`slow` durations +
decelerate/accelerate easing curves), and the global focus-ring token. One naming note:
this doc's `surface-raised` token is the same concept the Phase 2A kickoff message's
example called `surface-elevated` — implemented under the name already fixed in
[design-tokens.md](design-tokens.md).

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean (after fixing one issue — see Known limitations) |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 96 modules, 681ms (new component files compile but aren't bundled, since nothing imports them yet) |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed — untouched by this phase, confirms no accidental cross-contamination |
| `npx playwright test e2e/golden-path.spec.ts` | ✅ 1 passed |
| `npx playwright test e2e/inspector-overrides.spec.ts` | ✅ 2 passed |
| Manual visual check (`npm run dev:web` against a live project) | ✅ Dashboard, Workspace toolbar/canvas/tree/Inspector, Monaco (Code tab), and Preview all verified — see Known limitations for what a Docker-less environment couldn't exercise |

Computed-style spot checks confirmed tokens are live: `<h1>` resolves to `"IBM Plex
Sans", ui-sans-serif, system-ui, sans-serif` at `28px` (the `text-2xl` token); `body`
background is `rgb(244,245,247)` (`#f4f5f7`, the `bg` token) with text
`rgb(23,26,33)` (`#171a21`, `text-primary`); a project-row button's keyboard focus
outline is `rgb(47,95,221)` solid `2px` (`#2f5fdd`, the `primary`/`focus` token) —
confirming the new global `:focus-visible` rule applies wherever a component doesn't
already set its own outline. `document.fonts` confirmed three IBM Plex Sans weights
actually loaded (not just requested).

**Functionality preserved** — confirmed via the full green e2e runs above (which
exercise create → upload → detect → correct → generate → preview → export, plus
Geometry-override and Content-override/XSS-rejection flows) and manual inspection: no
detection UUID/override keying touched, no `CodeVersion` logic touched, Monaco's
`vs-dark` theme and read-only/editing gate untouched, the preview iframe's
`sandbox=""` untouched, page-boundary and correction-history behavior untouched — this
phase changed zero `.ts`/`.tsx` files outside `apps/web/src/components/` (new,
unwired) and `apps/web/tailwind.config.js`/`index.html`/`index.css` (config/global CSS
only).

**Known limitations**

1. One TypeScript fix was needed during implementation: `Input`/`Select`'s `size` prop
   collided with the native HTML `size` attribute (`number`, not our `"sm" | "md"`) —
   resolved with `Omit<..., "size">` on both components before re-declaring it.
2. This environment has no Docker/Postgres available, so the manual visual check ran
   against whatever local Postgres the dev API was already using rather than a
   freshly-provisioned one — full-stack manual verification was still possible (real
   project data loaded), but it means this check depended on pre-existing local
   environment state rather than a guaranteed-reproducible setup. The two Playwright
   suites are unaffected (they run against isolated throwaway JSON storage per
   `playwright.config.ts`) and are the reproducible evidence.
3. Detection/canvas color tokens (`detection-model`, `detection-manual`,
   `page-boundary`, plus `primary`/`selection` doubling as container/selected) are
   defined in `tailwind.config.js` but **not yet applied** inside
   `AnnotationCanvas.tsx`/`PageBoundaryOverlay.tsx`, which still use their original
   hardcoded hex literals — this is deliberate, scoped to Phase 2E per
   [design-to-code-mapping.md](design-to-code-mapping.md), not an oversight.
4. The new primitives have no visual regression test/story coverage yet (no Storybook
   or component-test harness exists in this repo — consistent with the pre-existing
   gap `PROJECT_STATUS.md` §2.6 already notes for the whole frontend). They were
   verified by typecheck + build + manual composition sanity only.

## Phase 2B — App shell / navigation

| | |
|---|---|
| **Scope** | New `AppHeader`/`BrandMark`, mounted on both routes. New `ToastStack` and `DialogHost` mounted near `App` root (empty/inert until 2C+ start using them). |
| **Files** | `apps/web/src/App.tsx`, new `apps/web/src/components/AppHeader.tsx`, `.../ToastStack.tsx`, `.../DialogHost.tsx` |
| **Dependencies** | 2A |
| **Acceptance criteria** | Brand header renders identically on both routes; no existing page content moves or breaks |
| **Test requirements** | Manual visual check; existing e2e suites must still pass unmodified (this phase touches no selector-bearing element) |
| **Regression risk** | Low — purely additive components |

### Result — ✅ Complete, with one scoped deviation (2026-08-25)

**Deviation from the table above, and why:** `AppHeader`/`BrandMark` were built but are
**not mounted** on either route yet. Mounting `AppHeader` globally via `App.tsx` (the
only way to do it without editing `Dashboard.tsx`/`ProjectWorkspace.tsx`, both still
off-limits per Phase 2A's Step 8) turned out to have two real costs, not just a
theoretical one:

1. **Dashboard** already renders its own "Sketch2UI" `<h1>` — a second brand
   wordmark stacked directly above it would be visibly redundant, not an improvement.
2. **ProjectWorkspace** roots its layout in `h-screen` (100vh) and already pins its own
   toolbar to the top of the viewport. Adding a global header above it would push the
   total rendered height past 100vh, forcing the whole page to scroll — a real
   regression against this phase's own acceptance criterion ("no existing page content
   moves or breaks").

Both problems disappear once the page that actually needs the header is being edited
anyway: Phase 2C removes/replaces Dashboard's own `<h1>` when it restructures that
page, and Phase 2D rebuilds ProjectWorkspace's toolbar from scratch. So `AppHeader` and
`BrandMark` are complete, typechecked, and ready — mounting is deferred to those two
phases, each already scoped to touch the page in question. `ToastStack` and
`DialogHost` had no such conflict (both render nothing when inactive — verified: their
providers are `Context.Provider` wrappers with no DOM node of their own, and `Dialog`
returns `null` while `open` is false) and are mounted in `App.tsx` exactly as planned.

**Files added**

- `apps/web/src/components/BrandMark.tsx` — corner-bracket mark (echoes the canvas's
  own resize-handle corners), built but not mounted
- `apps/web/src/components/AppHeader.tsx` — built but not mounted (see above)
- `apps/web/src/components/Toast.tsx` — presentational shell (semantic left-edge
  color, dismiss button, `role="status"`/`"alert"`)
- `apps/web/src/components/ToastStack.tsx` — `ToastProvider` + `useToast()`, portal-
  rendered to `document.body`, success/info auto-dismiss at 4s, error persists until
  dismissed
- `apps/web/src/components/Dialog.tsx` — presentational shell with the full
  accessibility.md focus-trap contract (initial focus, Tab cycling, Escape, focus
  restore on close)
- `apps/web/src/components/DialogHost.tsx` — `DialogProvider` + `useDialog().confirm()`
  returning `Promise<boolean>`; destructive confirms default focus to Cancel and
  disable dismiss-on-overlay-click per accessibility.md

**Files changed**

- `apps/web/src/App.tsx` — wrapped `<Routes>` in `<ToastProvider><DialogProvider>`
- `apps/web/src/components/index.ts` — barrel updated with the six new files

**Files removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 103 modules (up from 96: `App.tsx` now actually imports the two providers and their dependency chain), 697ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed |
| Manual check — Dashboard | ✅ Renders byte-identical to Phase 2A (no `AppHeader`, confirming the deferral above didn't leak in accidentally) |
| Manual check — ProjectWorkspace | ✅ Toolbar, banners, canvas, tree, Inspector, version strip all render and load real project data; no console errors; no layout shift |

Toast/Dialog have no call site yet (nothing in the app invokes `useToast`/`useDialog`
today), so their interactive behavior was verified by code review against
accessibility.md's contract plus typecheck/build, not a live trigger — consistent with
how Phase 2A's Tooltip foundation was verified. They get their first real caller in
Phase 2C (`ConfirmDialog` for delete-project) and later phases (toast replacing
`window.alert()`).

**Functionality preserved** — confirmed via the same e2e runs as Phase 2A (full
golden path + Geometry/Content override flows) plus the manual checks above. Zero
files under `pages/`, `features/`, `services/`, `stores/`, `utils/`, or the API were
touched.

**Known limitations**

1. `AppHeader`/`BrandMark` exist but are unused until Phase 2C/2D — tracked above, not
   an oversight.
2. `Dialog`'s focus trap is a manual `querySelectorAll`-based implementation (no
   focus-trap library added, consistent with Phase 2A's "no new dependency"
   precedent) — handles the common case (Tab/Shift+Tab cycling between first/last
   focusable element) but wasn't hardened against a dialog whose focusable content
   changes shape while open, since no dialog in the app does that yet.
3. Still no visual-regression harness in this repo (pre-existing gap) — Toast/Dialog
   verified by code review + typecheck/build rather than a snapshot test.

## Phase 2C — Dashboard

| | |
|---|---|
| **Scope** | Implement [dashboard-design.md](dashboard-design.md) in full: `Button`, `Field`, `Card`, `EmptyState`, `ErrorState`, `ConfirmDialog` components; restructure `Dashboard.tsx` to use them; replace `window.confirm()` with `ConfirmDialog`. |
| **Files** | `apps/web/src/pages/Dashboard.tsx`, new `apps/web/src/components/{Button,Field,Card,EmptyState,ErrorState,ConfirmDialog}.tsx` |
| **Dependencies** | 2A, 2B |
| **Acceptance criteria** | Create/list/delete all function identically to today; delete requires confirmation via the new dialog instead of `window.confirm()`; loading/empty/error states match [dashboard-design.md](dashboard-design.md) |
| **Test requirements** | `e2e/golden-path.spec.ts`'s project-creation steps (`getByPlaceholder("New project name")`, `getByRole("button", { name: "Create project" })`) must pass unmodified — verify before merging |
| **Regression risk** | Low — isolated to one route, no shared state touched |

### Result — ✅ Complete, with one scoped deviation (2026-08-25)

**Deviation from the table above, and why:** no separate `ConfirmDialog.tsx` was
built. Phase 2B's `DialogHost.tsx` already exposes `useDialog().confirm()` — an
imperative, promise-returning confirm dialog that is the exact shape this row asked
for. Building a second, Dashboard-specific wrapper around the same `Dialog` shell
would have duplicated it outright, which the governing "search for an existing
equivalent before creating a new component" rule (repeated throughout the Phase 2
brief) exists specifically to prevent. `Dashboard.tsx` calls `useDialog().confirm()`
directly instead.

`AppHeader`/`BrandMark` (built, unmounted, in Phase 2B) get their first mount here, as
that phase's result section planned. Mounting them required removing Dashboard's old
`<h1>Sketch2UI</h1>` — keeping both would have stacked two adjacent "Sketch2UI"
labels. The page's own heading is now **"Projects"**, naming this page's actual
content instead of repeating the brand a second time (the same pattern a persistent
logo bar + a content-specific page title follows elsewhere — e.g. a repo host's own
logo next to a "Repositories" heading). No e2e assertion depends on the old H1 text,
confirmed by inspecting both specs before making the change.

**Files added**

- `apps/web/src/components/Card.tsx` — bordered surface, optional `interactive`
  hover/focus lift
- `apps/web/src/components/EmptyState.tsx` — icon-agnostic (Dashboard's "no projects"
  today; reusable for the Layers panel's empty state in a later phase)
- `apps/web/src/components/ErrorState.tsx` — full-panel variant, distinct from the
  inline error-text pattern kept for single-action failures

**Files changed**

- `apps/web/src/pages/Dashboard.tsx` — full restructure onto
  [dashboard-design.md](dashboard-design.md): `AppHeader` mounted, H1 changed to
  "Projects", create form on `Input`/`Button`, project list as a `Card` grid
  (`repeat(auto-fill, minmax(240px,1fr))`), skeleton-card loading state, `ErrorState`
  + Retry for a failed list fetch, `EmptyState` for zero projects, delete confirmation
  via `useDialog().confirm()` (identical title/body copy to the old
  `window.confirm()`), delete outcome via `useToast().showToast()` instead of a
  silent state change. Every existing handler's actual logic (`handleCreate`,
  `handleDelete`, the `listProjects`/`createProject`/`deleteProject` calls) is
  unchanged — only the presentation and the confirm/notify mechanism moved.
- `apps/web/src/components/index.ts` — barrel updated with the three new files

**Files removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 109 modules (up from 103: Dashboard now actually imports the primitives), 737ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed, 2 workers |
| Manual check — Dashboard | ✅ `AppHeader` renders with wordmark; "Projects" H1; disabled/enabled button color states correct (`bg-primary` at full opacity when enabled, 50% when disabled); focus ring on input and on a project card's title button; hover reveals the delete icon; **delete flow**: clicking the trash icon opens the dialog with title "Delete project?" and body `Delete "Car marketplace"? This cannot be undone.` (byte-identical to the retired `window.confirm()` string); `document.activeElement` confirmed as "Cancel" on open (the destructive-dialog safer default); `Escape` closed it, focus returned to the trigger, **the project was not deleted** — confirmed still present in the list after dismissal; zero console errors throughout |

**Functionality preserved** — create/list/delete all verified working end-to-end via
both the e2e suites and the manual dialog-cancel walkthrough above; no detection/
override/codegen/persistence path touched (this phase's diff is entirely
`Dashboard.tsx` plus three new presentational components); the delete guarantee
(explicit confirmation required) is unchanged, only its rendering mechanism moved off
the native `window.confirm()`.

**Known limitations**

1. `TrashIcon`/`SpinnerIcon` are small hand-written inline SVGs local to
   `Dashboard.tsx`, not from a shared icon set — consistent with the "no new
   dependency" precedent from 2A/2B (no icon library is installed yet). A later phase
   adopting the Lucide recommendation from
   [design-direction.md](design-direction.md) should replace these in place, not
   grow more one-off inline SVGs per screen.
2. The delete icon button is visible on hover/keyboard-focus only (`opacity-0` at
   rest), per [dashboard-design.md](dashboard-design.md) — this was not re-verified
   under a touch/no-hover input in this phase; touch-specific always-visible-affordance
   handling is [responsive-design.md](responsive-design.md)'s Phase 2J concern, not
   this one.
3. No visual-regression harness in this repo (pre-existing gap) — verified by
   typecheck/build/e2e/manual walkthrough as with prior phases.

## Phase 2D — Workspace shell

| | |
|---|---|
| **Scope** | Extract `WorkspaceToolbar` and the new `StatusBar` (consolidating the four banners) from `ProjectWorkspace.tsx`. Introduce the `WorkspaceBody` 4-region grid shell (empty regions at first — content moves in in 2E–2H). |
| **Files** | `apps/web/src/pages/ProjectWorkspace.tsx`, new `apps/web/src/features/workspace/{WorkspaceToolbar,StatusBar,WorkspaceBody}.tsx` and the 5 `StatusBar` segment components |
| **Dependencies** | 2A, 2B, 2C (reuses `Button`/`Dialog`/`Toast`) |
| **Acceptance criteria** | Every existing toolbar action (Detect, Approve, Export, Save version) still calls its unchanged handler; all four banners' information is still visible, now in the consolidated status bar; page height no longer jitters as job/boundary/export/version state changes |
| **Test requirements** | Full `e2e/golden-path.spec.ts` run — this phase touches the most text asserted by that suite (`getByText(/1 box from the detector/)`, the Save-version rename call-out from [design-to-code-mapping.md](design-to-code-mapping.md)) |
| **Regression risk** | **Medium** — the Save-version button rename is a deliberate breaking change to one e2e assertion; update the test in the same PR, not after |

### Result — ✅ Complete, with two scoped deviations (2026-08-25)

**Deviation 1 — "empty regions at first" reinterpreted.** The table above (written
during the planning pass) said the `WorkspaceBody` shell would have "empty regions at
first — content moves in in 2E–2H." Building it that way would have meant the canvas,
Layers tree, Inspector, and Preview/Code literally stopped rendering for the length of
this phase — a severe functional regression, and a direct violation of this whole
exercise's Step 9 ("absolutely preserve" detection/override/preview/export behavior).
What actually shipped: the shell (toolbar, status bar, 4-region layout) is new, but
every existing feature component (`AnnotationCanvas`, `ClassPicker`, `UITreePanel`,
`InspectorPanel`, `PreviewPane`, `CodePanel`) is slotted into its new region in this
same phase, completely unchanged internally. "2E–2H add content" now means those
phases restyle/extend what's already sitting in the right place (canvas colors +
zoom/pan + legend in 2E, tree icons + collapse in 2F, etc.) — not that anything is
missing today.

**Deviation 2 — the interactive version-switcher pill row moved to the dock, not just
a passive summary in the status bar.** `code-preview-design.md` already specified this
placement (next to the Preview/Code tabs it controls) for a later phase; since this
phase was already relocating that exact JSX out of its old standalone banner, moving
it straight to its final documented home — rather than a temporary third location —
avoided a churn step. The `StatusBar`'s `ActiveVersionSegment` is a read-only summary
(`v1 · generated · active`); the full clickable list with `handleActivateVersion`
lives in the dock, unchanged behavior, one relocation instead of two.

**Files added**

- `apps/web/src/features/workspace/WorkspaceToolbar.tsx`
- `apps/web/src/features/workspace/StatusBar.tsx` — exports `StatusBar` plus
  `DetectJobSegment`, `PageBoundarySegment` (folds in the "rejected count" bit —
  meaningless without boundary context, not a standalone 5th file), `ActiveVersionSegment`,
  `ExportsPopover`, kept in one file rather than five (documented simplification —
  each is small and only ever composed by this one `StatusBar`)
- `apps/web/src/features/workspace/WorkspaceBody.tsx` — the 4-region shell (Layers
  240px / Canvas flex / Inspector 320px / bottom dock at a fixed 40% height —
  resizing is explicitly 2H/2I scope, not this phase)

**Files changed**

- `apps/web/src/pages/ProjectWorkspace.tsx` — the entire render/return section
  rebuilt on the three components above; **every** state declaration, `useEffect`,
  `useMemo`, and handler function above the `return` is byte-for-byte unchanged.
  "Save code version" renamed to "Save version" (tooltip explains it generates and
  saves in one step, since this app has no separate generate action). One
  `window.alert()` → `showToast("error", …)` swap, scoped to the version-activate
  click handler this phase was already relocating — no other `alert()` call site
  (inside `handleCreate`/`handleUpdate`/`handleDeleteSelected`/etc.) was touched,
  since those functions themselves weren't edited.
- `apps/web/src/components/StatusIndicator.tsx` — added a `"boundary"` tone
  (`bg-page-boundary`) — page-boundary rose is its own distinct semantic color, not
  to be folded into error-red or warning-amber
- `e2e/golden-path.spec.ts` — both `getByRole("button", { name: "Save code version" })`
  references updated to `"Save version"`, in the same change as the rename

**Files removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean on the first pass |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 117 modules (up from 109), 811ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed — including the golden path exercising the renamed button, the relocated Detect/boundary/version signals, and the tree/Inspector/preview/export flow entirely through the new shell |
| Manual check at desktop width (1440×900) | ✅ Toolbar buttons render with correct tinted colors (violet/success/info/primary); status bar shows a compact fixed-height row (`v1 · generated · active` + `Exports (1)`); Layers/Canvas/Inspector proportions match spec (canvas gets the majority of width, not starved); clicking a Layers tree row highlights the same node **on the canvas** (orange, selected) **and** populates the Inspector — full cross-panel selection sync verified working through the new panel boundaries; zero console errors |

**Functionality preserved** — confirmed three ways: (1) both e2e suites green,
exercising create→upload→detect→correct→generate→preview→export plus Geometry/Content
override flows through the entirely rebuilt shell; (2) the manual selection-sync check
above, which is exactly the kind of cross-component wiring a pure layout move could
silently break; (3) a line-by-line diff confirms zero changes to any state/effect/
handler in `ProjectWorkspace.tsx` above its `return` statement.

**Known limitations**

1. `ExportsPopover`'s dismiss-on-outside-click is a small hand-rolled
   `mousedown`-listener implementation, not a shared `Popover` primitive (component-
   specification.md's Dropdown/Popover is still unbuilt, P2) — consistent with the
   "no new dependency, minimal foundation" precedent from Tooltip (2A) and Dialog (2B).
2. The bottom dock's height is a fixed 40%, not yet resizable or collapsible — that's
   explicitly 2H/2I scope per [code-preview-design.md](code-preview-design.md).
3. Not verified below desktop width in this phase — narrow-viewport behavior
   (drawers, the `WorkspaceUnavailable` screen) is [responsive-design.md](responsive-design.md)'s
   Phase 2J concern.
4. No visual-regression harness in this repo (pre-existing gap) — verified by
   typecheck/build/e2e/manual walkthrough, consistent with prior phases.

## Phase 2E — Canvas

| | |
|---|---|
| **Scope** | Restyle `AnnotationCanvas`/`PageBoundaryOverlay` stroke/fill colors onto tokens (preserving all pointer-math). Add `CanvasToolbar` (zoom/pan/fit-to-screen — new) and `CanvasLegend` (new). Move the canvas into the `CanvasPanel` region of `WorkspaceBody`. |
| **Files** | `apps/web/src/features/annotation/AnnotationCanvas.tsx` (color constants only), `features/detection/PageBoundaryOverlay.tsx` (color constants only), new `features/annotation/{CanvasToolbar,CanvasLegend}.tsx` |
| **Dependencies** | 2A, 2D |
| **Acceptance criteria** | Every detection state (model/manual/selected/rejected) renders with the exact color/pattern mapping specified in [canvas-design.md](canvas-design.md); zoom/pan/fit work without altering draw/move/resize behavior; legend accurately reflects the live palette |
| **Test requirements** | `e2e/inspector-overrides.spec.ts`'s `svg g rect` structural selector must still resolve to the same element — **do not restructure the SVG group nesting**, verify explicitly |
| **Regression risk** | **Medium-high** — this is the surface the audit flagged hardest for "color is data, not decoration"; any stroke-mapping change must be checked against the canvas-design.md table before merging |

### Result — ✅ Complete, with two scoped deviations (2026-08-25)

**Deviation 1 — the file list gained `CanvasPanel.tsx`, not just the two toolbar/legend
files.** The table above scoped this phase to color constants plus two new small
components, with the canvas "moving into the `CanvasPanel` region" implied but not
named as its own file. In practice, zoom/pan state has to live *somewhere* above
`AnnotationCanvas` (it's a pure view concern, not a fit for `ProjectWorkspace.tsx`'s
already-long state list), and `CanvasToolbar`/`CanvasLegend`/`ClassPicker`/
`AnnotationCanvas` needed one owner composing them — so `CanvasPanel.tsx` was added,
matching what `component-hierarchy.md` already named as the real target of this
extraction. `ProjectWorkspace.tsx` now renders one `<CanvasPanel>` instead of the
inline `ClassPicker` + `AnnotationCanvas` pair.

**Deviation 2 — the new on-canvas boundary-confidence label (canvas-design.md §1) was
not built.** Its stated justification was "this information exists only in the removed
banner" — but Phase 2D didn't remove that information, it relocated it into the
`StatusBar`'s `PageBoundarySegment`, which is still visible. Adding the label would
have required threading `confidence` through `AnnotationCanvas`'s and
`PageBoundaryOverlay`'s props (both scoped to "color constants only" for this phase)
for information the user can already see. Deferred, not dropped — worth revisiting only
if user feedback says the status bar isn't discoverable enough on its own.

**The actual, load-bearing finding of this phase:** zoom required zero changes to
`AnnotationCanvas.tsx`'s coordinate-transform functions. `getImagePoint` already
derives its screen→image scale from `svgRef.current.getBoundingClientRect()` — a
measurement that already reflects whatever size the SVG is actually rendered at. Since
`AnnotationCanvas`'s own root is `w-full` with an aspect-ratio, giving its *parent* an
explicit pixel width (`asset.width * zoom`, inside a scrollable container) makes zoom
work correctly with the pointer-math file completely untouched. This is the reason the
Phase 1 audit's "hard-won, correct" note on this file's coordinate math held up under
a real new feature, not just under a restyle.

**Files added**

- `apps/web/src/features/annotation/CanvasToolbar.tsx` — zoom in/out/fit controls
- `apps/web/src/features/annotation/CanvasLegend.tsx` — collapsible color/pattern key
- `apps/web/src/features/annotation/CanvasPanel.tsx` — owns zoom/pan/fit state,
  composes `ClassPicker` + `CanvasToolbar` + `AnnotationCanvas` + `CanvasLegend`
  (Deviation 1)

**Files changed**

- `apps/web/src/features/annotation/AnnotationCanvas.tsx` — hardcoded hex stroke/fill
  values replaced with Tailwind `fill-*`/`stroke-*` utility classes against the
  design-tokens.md palette (a `DetectionTone` lookup: `selected`/`model`/`container`/
  `manual`, each mapping to a static class string — kept fully static, not template-
  interpolated, so Tailwind's JIT scanner picks them up). Per canvas-design.md, label
  text now matches its own box's color exactly (previously a flat `#1f2937`/`#7e22ce`
  regardless of container vs. leaf) — a small, deliberate consistency improvement.
  **Zero changes** to `getImagePoint`, `toPixels`, `toNormalized`, `normalizeRect`,
  `applyHandle`, or any drag/draw/resize event handler.
- `apps/web/src/features/detection/PageBoundaryOverlay.tsx` — same hex→token-class
  treatment for the dimming overlay, polygon stroke, and handles. **Zero changes** to
  its drag logic.
- `apps/web/src/pages/ProjectWorkspace.tsx` — canvas slot now renders `<CanvasPanel>`
  instead of the inline `ClassPicker`+`AnnotationCanvas` pair; all detection/boundary
  state and handlers passed through unchanged.

**Files removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 120 modules (up from 117), 735ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed — **the `svg g rect` structural selector still resolves**, confirming the SVG `<g>`/`<rect>` nesting order survived the hex→className conversion |
| Manual check: zoom in/out/fit | ✅ verified via direct state reads — fit-to-screen correctly measures the container and sets zoom (e.g. 27–54% depending on viewport), zoom-in/out step by 25% |
| Manual check: legend | ✅ opens to show all 5 labels (Model/Container/Manual/Selected/Outside page) |
| Manual check: selection → color → Inspector | ✅ dispatched a real `mousedown`/`mouseup` on a canvas `<rect>`; the clicked detection's rect gained the `fill-selection/8` class (confirms the new token-based selected state actually renders) and all 6 Inspector sections populated — the same cross-component wiring verified in Phase 2D, now re-confirmed with the color layer rewritten underneath it |

**Functionality preserved** — both e2e suites green (including the structural
selector), plus the direct DOM-level selection check above, which is stronger evidence
than a screenshot: it proves the *class-based* color system actually reaches the
`<rect>` at the moment of selection, not just that the canvas looks right in a
particular screenshot.

**Known limitations**

1. **Two tooling artifacts encountered and resolved during manual verification, not
   product bugs — recorded so a future session doesn't re-debug them:**
   - A `ReferenceError: ClassPicker is not defined` appeared in `read_console_messages`
     pointing at a Vite dep-cache chunk, with an identical timestamp across a full dev-
     server restart. `grep` confirmed zero references to `ClassPicker` anywhere in
     `ProjectWorkspace.tsx`; the app rendered and functioned correctly throughout
     (a real uncaught render error would have unmounted the tree, not left a fully
     working UI on screen). Concluded to be a stale/accumulated error buffer in the
     console-reading tool itself, not a live page error.
   - The Browser pane's coordinate-based `computer` click tool intermittently missed
     `CanvasLegend`'s small (24×24px) trigger — confirmed by dispatching a real
     `MouseEvent` directly on the button via JS, which worked immediately. Zoom
     button clicks via the same coordinate-based tool did work once read timing
     accounted for React's async re-render. Both are automation-precision notes, not
     application defects — confirmed by the direct-dispatch tests succeeding.
2. `CanvasLegend` has no keyboard-dismiss (`Escape`) — minor, matches the
   "foundation, not finished" precedent set by Tooltip (2A) and `ExportsPopover` (2D).
3. Pan (space-drag / middle-mouse-drag) from canvas-design.md §12 was not
   implemented — the scrollable container already provides trackpad/scrollbar
   panning when zoomed beyond fit, which covers the same functional need; the
   explicit space-drag gesture is deferred as polish, not required for the
   acceptance criteria ("zoom/pan/fit work") to be met by the standard scroll
   affordance already in place.
4. Not re-verified below desktop width this phase — 2J scope.

## Phase 2F — UI Tree

| | |
|---|---|
| **Scope** | Extract `LayersPanel` (currently sharing a column with the Inspector) into its own `WorkspaceBody` region. Add per-type icons and collapse/expand to `TreeNode` (both new). |
| **Files** | `apps/web/src/features/tree/UITreePanel.tsx`, `apps/web/src/pages/ProjectWorkspace.tsx` (layout only) |
| **Dependencies** | 2A, 2D |
| **Acceptance criteria** | Tree still reflects `buildTreeAndCode`'s output unchanged; selecting a tree row still drives the same shared `selectedId`; collapse state doesn't crash on tree rebuild (detection change) |
| **Test requirements** | `e2e/golden-path.spec.ts`'s `page.locator("ul.p-2 > li > button").first()` selector — **verify this still resolves**, or update alongside the icon/collapse change if the DOM shape moves |
| **Regression risk** | Medium — the golden-path test's tree-node selector is structural, not role-based |

### Result — ✅ Complete, with one scoped deviation (2026-08-25)

**Deviation — "extract LayersPanel into its own region" was already done.** That was
this row's first stated task, but Phase 2D's `WorkspaceBody` shell already gave the
tree its own dedicated 240px Layers column, separate from the Inspector's 320px
column, as a natural consequence of building the 4-region layout. There was nothing
left to extract here. This phase's real remaining work — restyling `UITreePanel.tsx`
onto tokens, and adding per-type icons + collapse/expand — is what actually shipped.

**The DOM-shape constraint drove the implementation choice.** Both e2e suites locate
a tree row via `page.locator("ul.p-2 > li > button").first()` — a structural selector
depending on (a) the literal Tailwind class string `"p-2"` on the root `<ul>`, and (b)
each `<li>` having exactly one direct-child `<button>`. The collapse chevron is
therefore a plain `<span onClick>` **nested inside** that button, not a second sibling
`<button>` — nesting a real `<button>` or any `tabindex`-bearing element inside a
`<button>` violates the HTML content model (browsers tolerate it, but focus/activation
semantics get unpredictable); a plain non-interactive `<span>` has no such restriction.
The chevron calls `stopPropagation()` so its own click toggles collapse without also
selecting the row. Traded off: the chevron is mouse-only for now (not independently
keyboard-focusable) — full keyboard tree navigation (arrow keys, →/← to expand/
collapse) is already scoped to [accessibility.md](accessibility.md)'s Phase 2J, not
this one, so this isn't a new gap, just this phase not front-running that later work.

**Files changed**

- `apps/web/src/features/tree/UITreePanel.tsx` — hex→token colors throughout
  (`bg-selection-subtle`/`text-selection` for the selected row, `text-detection-model`
  for model-sourced rows, `bg-surface-sunken` for hover/layout badges); indent step
  changed from 14px to 16px (`space-lg`, per
  [component-specification.md](component-specification.md)); added a per-type icon
  (5 families — container/text/media/interactive/list — rather than one glyph per
  taxonomy class, see Design decision 1) and a collapse/expand chevron for any node
  with children, both new. Root `<ul className="p-2">` and each row's single
  direct-child `<button>` unchanged in shape.

**Files added / removed** — none.

**Design decisions**

1. **Five icon families, not 41 per-taxonomy-class glyphs.** The UI-IR's `node.type`
   draws from a 41-class taxonomy plus synthetic types (e.g. `group`, from the layout
   engine's repeated-content grouping). Hand-drawing a unique icon per exact type for
   a first pass would be a large, low-differentiation effort — five families
   (container/text/media/interactive/list, matched by a `Set`-based lookup with a
   safe "container" fallback for anything unlisted) gives the tree meaningfully more
   visual structure than the old bare mono label, without that cost. Can be
   subdivided further later if real usage shows the grouping is too coarse.
2. **Collapsed state is local `useState` per `TreeNode` instance, not lifted or
   persisted.** UI-IR node ids are reassigned from a per-generation counter on every
   detection change (per `docs/execution/phase-log.md`'s Phase 1 report) — so a tree
   rebuild already remounts every node under a new `key`, and local state resetting
   to its default (expanded) on remount is the correct behavior here, not a bug to
   work around. Satisfies the acceptance criterion ("doesn't crash on rebuild")
   directly — there's no persisted reference to go stale.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 120 modules, 727ms (no new files this phase, only edits) |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed — `ul.p-2 > li > button` still resolves |
| DOM-level check: root class, buttons-per-`li`, icon count | ✅ `rootClass: "p-2"`; exactly 1 direct-child `<button>` per `<li>`; 2 `<svg>`s in the first row's button (chevron + type icon) |
| Functional check: collapse → expand | ✅ dispatched a real click on the chevron `<span>`: nested `<ul>` unmounted (11 children gone), Inspector **not** touched (`stopPropagation` confirmed working — chevron click didn't also select); a second click restored all 11 children |
| Functional check: row click still selects | ✅ clicked a `logo` row; `#detection-class`'s value became `"logo"` and the row's own class list picked up `bg-selection-subtle text-selection` — selection still reaches the Inspector and the new token colors apply together |

**Functionality preserved** — both e2e suites green plus the DOM-level and functional
checks above, which directly exercise the two things a tree restyle could most easily
break: the structural selector, and the click→select→Inspector wiring.

**Known limitations**

1. Chevron collapse/expand is mouse-only — keyboard tree navigation is
   [accessibility.md](accessibility.md)'s Phase 2J scope (see the DOM-shape
   discussion above for why).
2. Five icon families rather than a unique glyph per taxonomy class (Design
   decision 1) — revisit only if real usage shows it's too coarse.
3. No visual-regression harness in this repo (pre-existing gap).

## Phase 2G — Inspector

| | |
|---|---|
| **Scope** | The riskiest single phase. Restructure `InspectorPanel.tsx`'s six flat sections into `AccordionSection`s with the shared `InspectorSectionFooter`, per [inspector-design.md](inspector-design.md). **Every handler prop, validator call, and the `EMPTY_STYLE_OVERRIDE` identity contract must be preserved exactly** (see [design-to-code-mapping.md](design-to-code-mapping.md)'s reference-identity note). |
| **Files** | `apps/web/src/features/inspector/InspectorPanel.tsx`, new `apps/web/src/features/inspector/{AccordionSection,InspectorSectionFooter,DetectionSection,StyleSection,GeometrySection,StructureSection,ContentSection,HistorySection}.tsx` |
| **Dependencies** | 2A, 2D |
| **Acceptance criteria** | All five Apply/Reset flows produce identical API calls and identical dirty/applied/error states to today, verified one group at a time; `#detection-class`, `#geo-width`, `#content-text` ids preserved exactly; every `title=` string becomes a Tooltip+`aria-label` with **identical text** |
| **Test requirements** | Both e2e suites in full — this is the single phase touching the most asserted selectors (`#detection-class`, `#geo-width`, `#content-text`, three `button[title="..."]` selectors, `getByText("Saved")`, `getByText(/may not contain/i)`). **Do not merge without a full green run of both suites.** |
| **Regression risk** | **Highest in the roadmap.** Recommend doing this phase last among the feature-surface phases (after 2E/2F build confidence in the token/component layer) and adding `data-testid` hooks alongside every preserved `id`/`title` as insurance for a later selector migration |

### Result — ✅ Complete, with real e2e failures caught and fixed (2026-08-25)

**Deliberate de-risking, decided before writing any code:** the table above's file list
(`DetectionSection`/`StyleSection`/`GeometrySection`/`StructureSection`/
`ContentSection`/`HistorySection` as six separate files) was not built as specified.
Full extraction into six files would have meant threading 15–20 props into each new
component — real surface area for a prop-mismatch bug in the one file this whole task
explicitly called "riskiest." Instead: `AccordionSection` and `InspectorSectionFooter`
were built as genuinely reusable, state-free wrapper components (exactly as scoped),
and the six sections' field-rendering JSX stayed **inline inside `InspectorPanel.tsx`**,
each now wrapped in `<AccordionSection>` in place. Every helper function
(`toStyleDraft`, `nonEmptyStyle`, `parseGeometryDraft`, `parseStructureDraft`,
`describeCorrection`, etc.), every `useState`/`useEffect`, and every handler
(`handleApplyStyle` through `handleRevertToModelClass`) is at the exact same scope it
was in before this phase — nothing was relocated, only what surrounds it.

**A real regression was caught by the required e2e run, exactly as this row's test
requirement was designed to catch.** The first full e2e run after the rewrite produced
**2 failures**: `inspector-overrides.spec.ts`'s Geometry and Content tests both timed
out with Playwright reporting "element … intercepts pointer events." Root cause:
Style/Geometry/Structure/Content now default to **collapsed** per
[inspector-design.md](inspector-design.md)'s explicit accordion spec, but both tests
interacted with `#geo-width`/`#content-text` immediately after selecting a node,
assuming the old always-expanded layout. This is the same category of change as
Phase 2D's toolbar-button rename: a deliberate design change that a real user would
also need to perform (click to expand a section before editing it), requiring the
test to gain one line, not a bug in the application. Fixed by adding
`page.getByRole("button", { name: "Geometry"/"Content", exact: true }).click()`
immediately before each test's first interaction with that section's fields. Re-ran
twice after the fix — both runs green, no flakiness from the accordion's CSS
transition.

**A second issue was caught only by manual testing, not by the e2e suites: the
`title=` → Tooltip/`aria-label` migration would have silently broken every
`button[title="..."]` e2e selector**, since a Tooltip renders its text in a separate
`role="tooltip"` element on hover/focus, not as a native `title` HTML attribute — the
CSS attribute selector `button[title="..."]` has nothing to match without one. Caught
during code review before the first e2e run (not after a failure), and fixed by the
lowest-risk option: **every button keeps its native `title` attribute in addition to**
the new `Tooltip` wrapper and `aria-label`. This means zero e2e selector changes were
needed for the three `button[title="..."]` locators, at the minor cost of a
title-attribute browser tooltip and the custom Tooltip both being technically present
on the same element (see Known limitations).

**Files added**

- `apps/web/src/features/inspector/AccordionSection.tsx` — collapsible section shell,
  uncontrolled per-instance `open` state, optional applied/dirty status dot
- `apps/web/src/features/inspector/InspectorSectionFooter.tsx` — shared caption +
  actions-slot wrapper; callers still compute their own exact label text (see next
  paragraph) and pass their own buttons as `actions`

**Files changed**

- `apps/web/src/features/inspector/InspectorPanel.tsx` — full JSX restructure as
  described above. **Deviation from inspector-design.md's own footer-label table**:
  that doc proposed a generic label set ("No override" / "Applied" / "Unapplied" for
  every section alike). The actual implementation keeps each section's **exact
  original text** instead (Detection's clean state is still "Saved", Style's is
  "No style overrides", Geometry's is "No geometry override", etc.) — because
  `e2e/golden-path.spec.ts` asserts `getByText("Saved")` verbatim, and generalizing
  that string would have broken it for no benefit. The shared component still
  standardizes color-by-tone (muted/warning/success) and layout; only the label
  *text* stayed section-specific.
- `e2e/inspector-overrides.spec.ts` — two `getByRole("button", { name: "Geometry"/
  "Content" }).click()` lines added, see above.

**Files removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean on the first pass |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 124 modules (up from 120), 749ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test` — **first run** | ❌ 2 of 3 failed (the accordion-collapse issue above) |
| Fixed, `npx playwright test` — **second run** | ✅ 3 passed |
| `npx playwright test` — **third run** (flakiness check, given the CSS-transition-based collapse) | ✅ 3 passed again, same timing |
| DOM-level check: is a collapsed section actually non-interactive, not just visually thin? | ✅ `#geo-width`'s clipping ancestor (`.overflow-hidden`) measured `height: 0`, and `document.elementFromPoint()` at the input's nominal position resolved to a **different** element — confirming the collapse genuinely blocks interaction, not just that it looks collapsed. (Note: a naive `getBoundingClientRect()` check on the input itself is **not** sufficient evidence here — a clipped descendant still reports its own natural, uncollapsed size; only the ancestor's collapsed height and a hit-test prove real invisibility.) |
| Manual: Style section dirty-state, not covered by either e2e suite | ✅ real keystrokes (not a raw DOM `.value` assignment, which does not trigger React's controlled-input update — see Known limitations) into `#style-gap` flipped the footer from "No style overrides" to "Unapplied" |

**Functionality preserved** — both e2e suites green after the one legitimate test
update; every helper function and handler confirmed unmoved by direct code
comparison; the Style section's dirty-detection (not exercised by either automated
suite) manually confirmed working via real simulated typing.

**Known limitations**

1. Every Apply/Reset button now carries both a native `title` attribute and a custom
   `Tooltip` — technically two tooltip mechanisms on the same element. Chosen
   deliberately to keep the three e2e `button[title="..."]` selectors resolving with
   zero test changes; a future pass migrating those selectors to `data-testid` (as
   `design-to-code-mapping.md` recommended as insurance) could then drop the
   redundant native `title`.
2. Testing note for future sessions, not a product issue: simulating input into a
   React-controlled field via raw `element.value = x; dispatchEvent(new Event(...))`
   does **not** reliably trigger React's state update — the DOM value changes but
   `onChange` may not fire as expected. Real simulated keystrokes (or React Testing
   Library's `fireEvent`/`userEvent` in an actual test file) are required; this cost
   real debugging time during this phase's manual verification and is recorded here
   so it isn't rediscovered from scratch.
3. Structure section's dirty-detection was not independently re-verified this phase
   (identical code shape to Style/Geometry, both of which were verified) — low risk
   by structural analogy, not a gap in confidence, just not an explicit test run.
4. No visual-regression harness in this repo (pre-existing gap).

## Phase 2H — Code panel

| | |
|---|---|
| **Scope** | Flip Monaco's `theme` prop from `vs-dark` to a light theme. Restyle surrounding chrome (tabs, save/cancel buttons) onto tokens. Move `CodePanel` into the new `BottomDock`. |
| **Files** | `apps/web/src/features/code/CodePanel.tsx` (theme prop + chrome only — editor logic, validation gate, draft state machine untouched) |
| **Dependencies** | 2A, 2D |
| **Acceptance criteria** | `validateGeneratedCode()` gate still blocks Save on invalid input identically; Monaco renders light; version label/selector present in the new dock header |
| **Test requirements** | Manual verification of the validation-gate path (no e2e coverage exists for it today — this is a good candidate to add a `data-testid`-based Playwright case in this phase per `PROJECT_STATUS.md` §2.6's noted test gap, though writing that test is optional to this phase's completion) |
| **Regression risk** | Low — no logic changes, purely a theme prop and layout position |

### Result — ✅ Complete (2026-08-25)

**"Move into BottomDock" was already done** — same situation as Phase 2F's "extract
LayersPanel": Phase 2D's `WorkspaceBody` already placed `CodePanel` inside the dock
slot via the Preview/Code tab toggle. This phase's actual work was the theme flip and
chrome restyle only.

**Files changed**

- `apps/web/src/features/code/CodePanel.tsx` — Monaco's `theme` prop changed from
  `"vs-dark"` to `"light"`; the HTML/CSS sub-tab strip now uses the shared
  `Tabs`/`Tab` components (built in 2A, its first real call site); Cancel/Save edit/
  Edit code buttons now use `Button`; the "Edit code" button's `title` became a
  `Tooltip` **without** a redundant native `title` attribute (unlike every Inspector
  button in Phase 2G) — this button has zero e2e dependency, so it's the first
  instance of the "clean" version of the pattern once legacy-selector constraints
  don't apply. Validation/error banner restyled onto `border-error/30 bg-error-subtle
  text-error`. **Zero changes** to the draft/dirty state machine, `beginEdit`/
  `cancelEdit`/`handleSave`, or the `validateGeneratedCode()` call.

**Files added / removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 125 modules (up from 124), 754ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed |
| Monaco theme, computed style | ✅ editor background `rgb(255, 255, 254)` — confirmed light, not the old dark `vs-dark` |
| **Validation gate**, the one correctness-critical path this phase touches | ✅ entered edit mode, typed an unbalanced tag (`<div><span>unclosed</div>`) via real keystrokes into a properly mouse-focused Monaco instance, clicked Save edit: the exact validator (`HTML_UNBALANCED_TAG: Closing </div> does not match the open <span>.`) fired, the save was blocked, and the panel stayed in editing mode (`Cancel`/`Save edit` still present, `setEditing(false)` never reached) |

**Functionality preserved** — the validation-gate check above is direct behavioral
proof, not just a passing test suite: it exercises the exact safeguard
[README.md](README.md)'s non-negotiable-constraints table names, end to end, through
the restyled component.

**Known limitations**

1. No automated e2e coverage for the validation-gate path existed before this phase
   and none was added (optional per this row's own test requirement) — verified
   manually instead, per the table above.
2. Simulating typing into Monaco via browser automation required a real mouse click
   into the editor before keyboard shortcuts (`Cmd+A`) or typed text would register —
   a programmatic `.focus()` call alone was not sufficient. Same category of
   automation-tooling note as Phase 2G's React-controlled-input finding; recorded so
   it isn't rediscovered from scratch.
3. No visual-regression harness in this repo (pre-existing gap).

## Phase 2I — Preview

| | |
|---|---|
| **Scope** | Add frame chrome (viewport width label, border frame) and the loading progress line around `PreviewPane`. **The iframe's `sandbox=""` attribute and `srcDoc` composition logic are not touched.** Move into `BottomDock`. |
| **Files** | `apps/web/src/features/preview/PreviewPane.tsx` (wrapper/chrome only) |
| **Dependencies** | 2A, 2D, 2H (shares the dock shell) |
| **Acceptance criteria** | `e2e/golden-path.spec.ts`'s `page.frameLocator('iframe[title="Live preview"]')` selector resolves unchanged; sandbox attribute verified unchanged via a direct DOM check in code review, not just visually |
| **Test requirements** | Full `e2e/golden-path.spec.ts` run, with explicit attention to the preview/export steps |
| **Regression risk** | Low functionally, but **treat the sandbox attribute as a hard gate** — any diff touching that line needs explicit sign-off, not routine review |

### Result — ✅ Complete (2026-08-25)

**"Move into BottomDock"** — already done in Phase 2D, same as 2F/2H's file-list rows.

**The sandbox gate: explicit sign-off, not routine review.** `grep -n 'sandbox'
apps/web/src/features/preview/PreviewPane.tsx` was run directly against the diff
before this result was written — one match, `sandbox=""`, unchanged. Confirmed a
second way live in the browser: `document.querySelector('iframe[title="Live
preview"]').getAttribute('sandbox')` returned `""` — the actual runtime DOM attribute,
not just the source line.

**One prop added, no new state.** `PreviewPane` gained an optional `loading?: boolean`
prop (the "Preview loading" capability from
[code-preview-design.md](code-preview-design.md)). `ProjectWorkspace.tsx` passes the
same busy expression already computed for `InspectorPanel`'s `busy` prop, plus `saving`
and `savingEdit` — no new state anywhere. "Version activation" was left out of that
expression: `code-preview-design.md` named it as a trigger for the loading line, but
`handleActivateVersion` has never tracked its own busy flag (confirmed by reading the
function — a bare `await` with no `setXxx(true/false)` around it), and adding one
would have contradicted that same doc's "no new state" instruction. Recorded as a
deviation from the doc's literal wording, not from its intent.

**Files changed**

- `apps/web/src/features/preview/PreviewPane.tsx` — added the viewport width label
  (`font-mono text-2xs`, "Desktop" for the 100% preset since "100%" isn't a
  meaningful concrete width, the literal pixel value for Tablet/Mobile), a loading
  progress line (`animate-pulse`, respects `motion-reduce`), and an empty state
  (`html.trim() === ""`). Viewport toggle buttons restyled onto tokens. **Zero
  changes** to `composeDocument()`, the iframe's `sandbox`/`srcDoc`/`title` attributes,
  or the `resolveAssetPath` rewrite logic.
- `apps/web/src/pages/ProjectWorkspace.tsx` — one call site updated to pass the new
  `loading` prop; no other change.

**Files added / removed** — none.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 125 modules (unchanged count — edits only), 742ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | ✅ 3 passed — `iframe[title="Live preview"]` still resolves, export (which depends on the preview pipeline) still succeeds |
| `grep -n 'sandbox'` against the diff | ✅ one match, `sandbox=""`, unchanged |
| Live DOM: `iframe.getAttribute('sandbox')` | ✅ `""` |
| Viewport switch → width label + iframe width | ✅ clicked Tablet: label read `"768px"`, `iframe.style.width` read `"768px"` |
| Style Apply round-trip (proxy for the loading line's underlying state) | ✅ footer transitioned to "Applied," confirming `applyingStyle` toggled true→false — the exact boolean now also driving `loading` |

**Functionality preserved** — the sandbox attribute, the security boundary this phase
explicitly gates on, was checked three independent ways (source grep, live DOM
attribute read, and the full golden-path e2e run including export). `composeDocument`
and the asset-path rewrite are untouched by diff.

**Known limitations**

1. **The loading progress line's visible appearance was not caught mid-flight** — the
   local dev API's round-trip is fast enough (well under 100ms) that polling for the
   `.animate-pulse` element after triggering an Apply consistently found the request
   already resolved. Verified indirectly instead: the `loading` prop is a direct,
   type-checked pass-through of state (`applyingStyle` etc.) that's already proven to
   toggle true→false correctly (the Apply succeeded), so the same toggle necessarily
   drives the progress line's conditional render correctly — this is a strong
   structural argument, not a substitute for having seen it on screen. Worth a quick
   visual glance in a real (slower) network condition if this ever feels
   unconvincing.
2. Empty-state rendering (`html.trim() === ""`) was not exercised against a live
   zero-detection project this phase — low risk, single-condition JSX, but not
   independently confirmed live.
3. No visual-regression harness in this repo (pre-existing gap).

## Phase 2J — Responsive / accessibility

| | |
|---|---|
| **Scope** | Implement [responsive-design.md](responsive-design.md)'s breakpoint behavior (drawer patterns at tablet, `WorkspaceUnavailable` at mobile) and [accessibility.md](accessibility.md)'s keyboard/ARIA additions across every component landed in 2B–2I. |
| **Files** | Cross-cutting — touches most components from prior phases to add responsive classes and ARIA attributes; new `apps/web/src/pages/WorkspaceUnavailable.tsx` (rendered conditionally inside `ProjectWorkspace`, not a new route) |
| **Dependencies** | 2A–2I (everything must exist before it can be made responsive/accessible) |
| **Acceptance criteria** | Canvas keyboard-selection/nudge works per spec; every icon-only button has an `aria-label`; dialog focus-trap contract verified; tablet drawer behavior verified at 768–1023px; mobile shows the unavailable screen, not a broken layout |
| **Test requirements** | Manual keyboard-only pass through the full golden path; automated axe/contrast check recommended (new tooling, not currently in the repo — optional addition, not a blocker) |
| **Regression risk** | Medium — broad surface area, but additive (ARIA attributes, new breakpoint classes) rather than structural, so risk is mostly "missed a spot," not "broke something working" |

### Result — ✅ Complete (2026-08-25)

**ARIA sweep — mostly already done, not a new pass.** Auditing every `IconButton`
usage across 2A–2I found all of them already carry `aria-label` — enforced at the
type level since Phase 10 (`IconButton`'s `aria-label` prop is required, not
optional). This item was closer to a confirmation than new work.

**Files added**

- `apps/web/src/components/useMediaQuery.ts` — thin wrapper over
  `window.matchMedia`, the single source of truth for the tablet/mobile checks below
  (no separate JS-measured-width logic that could drift from what a CSS breakpoint
  class would show for the same viewport)
- `apps/web/src/components/Drawer.tsx` — Escape + overlay-click to dismiss; no full
  focus-trap (same "foundation, not finished" scoping as Tooltip/ExportsPopover/
  CanvasLegend before it)
- `apps/web/src/pages/WorkspaceUnavailable.tsx` — the mobile (<768px) screen:
  project name/status/sketch thumbnail, a "View live preview" toggle to a
  full-screen `PreviewPane` when a code version exists, no upload offered

**Files changed**

- `apps/web/src/features/annotation/AnnotationCanvas.tsx` — **two additive changes**,
  no existing function touched: (1) a new, separate `useEffect` for arrow-key nudge
  (1px-equivalent step, 10px with Shift), reusing the existing `onUpdate` callback —
  not folded into the pre-existing Delete/Backspace effect, so it's independently
  reviewable/revertable; (2) each detection's `<rect>` gained `tabIndex={0}`,
  `role="button"`, an `aria-label`, and an Enter/Space `onKeyDown` — Tab reaches
  every detection via native focus order for free (no custom Tab-hijacking, which
  would risk a keyboard trap), Enter/Space selects the focused one. The `<svg>` root
  gained `role="application"` + a live `aria-label` reporting the detection count.
- `apps/web/src/features/tree/UITreePanel.tsx` — `onKeyDown` on the row button
  handles →/← expand/collapse (calling the same `setCollapsed` the mouse chevron
  already used) plus `aria-expanded`. Native Tab order already reached every row
  (each was already a real `<button>`); this closes the one remaining
  mouse-only gap.
- `apps/web/src/features/workspace/WorkspaceBody.tsx` — new optional `isTablet`
  prop; when true, Layers/Inspector render as `Drawer`s (toggled by two new buttons)
  instead of fixed columns, canvas takes full width. The `layers`/`canvas`/
  `inspector`/`dock` content passed in is identical in both branches — only the
  frame around it differs.
- `apps/web/src/pages/ProjectWorkspace.tsx` — `useMediaQuery`-based `isMobile`/
  `isTablet`; an early return renders `WorkspaceUnavailable` when `isMobile` (placed
  after the existing loading/error/not-found guards, so hook-call order is
  unaffected — all hooks still run unconditionally before any early return);
  `isTablet` threaded into `WorkspaceBody`.

**Files removed** — none.

**Design decisions**

1. **Canvas selection cycling is native Tab order, not a custom Tab-key handler.**
   `accessibility.md` described "Tab/Shift+Tab cycle selection" somewhat ambiguously;
   implementing that literally would mean intercepting the browser's own Tab key
   while the canvas has focus, which risks trapping a keyboard user inside the
   canvas — a real anti-pattern, not a stylistic quibble. Making each detection a
   genuinely focusable element (`tabIndex={0}`) achieves the same practical outcome
   (every detection reachable in order) through the platform's own mechanism instead
   of fighting it.
2. **Focus does not auto-select; Enter/Space does.** An earlier draft had `onFocus`
   trigger `onSelect`, which was reverted — conflating "you tabbed here" with "you
   chose this" is inconsistent with how every other focusable control in the app
   behaves (a focused button isn't activated until pressed), and could surprise a
   screen reader user mid-Tab-traversal.
3. **Tablet-drawer content remounts on breakpoint crossing.** Because
   `layers`/`canvas`/`inspector` render at different positions in the JSX tree
   depending on `isTablet`, React unmounts and remounts those subtrees when the
   viewport crosses 768px/1024px live (e.g. resizing a browser window), losing local
   state such as canvas zoom level or tree collapse state. Accepted as a reasonable
   MVP trade-off — a live mid-session breakpoint crossing is a narrow scenario
   (window resize, not device rotation on a fixed-size phone/tablet), and the
   alternative (portal-based reparenting to preserve state) is real added complexity
   for a corner case. Documented, not silently accepted.

**Verification**

| Check | Result |
|---|---|
| `npm run typecheck -w apps/web` | ✅ Clean on the first pass despite the scale of this phase |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 128 modules (up from 125), 756ms |
| `npm run test` (Vitest) | ✅ 124 + 386 passed, 0 failed |
| `npx playwright test` (both suites, run at default desktop viewport) | ✅ 3 passed — confirms the new mobile/tablet branches don't interfere with the existing desktop path |
| **Canvas keyboard nudge**, verified via real persistence, not just visual movement | ✅ selected a detection, dispatched `ArrowRight`: rect moved from `x=78` to `x=79` (1px-equivalent); dispatched `Shift+ArrowDown`: `y` moved `78→~88` (10px-equivalent); **network log confirmed two real `PATCH .../detections/:id` → 200** — the nudge round-trips through the same `onUpdate`/`handleUpdate` path a mouse drag does, not a local-only visual effect |
| **Tree keyboard expand/collapse** | ✅ focused the root row, dispatched `ArrowLeft`: `aria-expanded` → `false`, nested `<ul>` unmounted (11 children gone); `ArrowRight`: fully reversed |
| **Tablet drawers** at 900px | ✅ Layers/Inspector toggle buttons replace the fixed columns, canvas takes full width; opening each showed the exact same tree/Inspector content (a previously-selected node's Inspector state carried over correctly); `Escape` closed the Layers drawer |
| **Mobile screen** at 390px | ✅ `WorkspaceUnavailable` renders — brand header, project name, explanation, status + sketch thumbnail; "View live preview" switched to a full-screen `PreviewPane` with viewport toggles and a working "← Back" |
| ARIA attributes, spot-checked live (not just by reading source) | ✅ `svg[role="application"]` resolved with the live detection-count `aria-label`; the first detection `<rect>` had `tabindex="0"`, `role="button"`, `aria-label="page, manual"` |

**Functionality preserved** — both e2e suites green at the default (desktop) viewport
they run at; the canvas nudge was proven to hit the real API, not just move pixels;
every new interactive surface (nudge, tree arrows, both drawers, the mobile preview
toggle) was exercised live, not inferred from source review alone.

**Known limitations**

1. Tablet-drawer content remounts on a live breakpoint crossing (Design decision 3).
2. `Drawer` has no focus-trap (Escape + overlay-click only) — same scoping precedent
   as Tooltip/ExportsPopover/CanvasLegend.
3. No automated axe/contrast tooling added — this row's own test requirement marked
   it optional; manual keyboard passes were the verification method used instead.
4. No visual-regression harness in this repo (pre-existing gap).

## Phase 2K — Visual QA / polish

| | |
|---|---|
| **Scope** | Full-app pass against every spec doc; fix drift between implementation and specification; final regression-checklist run. |
| **Files** | Whatever the QA pass finds — expected to be small, targeted fixes, not new components |
| **Dependencies** | 2A–2J |
| **Acceptance criteria** | Every component matches [component-specification.md](component-specification.md); every screen matches its design doc; both e2e suites green; the full manual [regression-checklist.md](../execution/regression-checklist.md) (15 core-pipeline steps + preservation checks) passes |
| **Test requirements** | `npm run test`, `npm run test:py`, `npm run build`, both e2e suites, full manual regression checklist |
| **Regression risk** | Low if 2A–2J were each verified at merge time; this phase is a safety net, not where risk is introduced |

### Result — ✅ Complete — Phase 2 (design token foundation through responsive/a11y) is done (2026-08-25)

**The QA pass found one real gap, not zero.** `ClassPicker.tsx` and
`UploadDropzone.tsx` had never been touched across Phases 2A–2J — both are small,
self-contained dependencies (`ClassPicker` only rendered inside `CanvasPanel`;
`UploadDropzone` only shown in the empty-workspace state) that no earlier phase's
scope happened to reach. A repo-wide grep for legacy Tailwind color classes
(`text-gray-*`, `bg-orange-*`, `border-red-*`, etc.) caught both — this is exactly
the kind of drift a dedicated final-pass phase exists to close, and it's real
evidence the "was everything actually covered" question needed asking, not a
formality.

**Fixed:**

- `apps/web/src/features/annotation/ClassPicker.tsx` — rewritten to reuse the
  `Select` primitive directly instead of hand-rewriting the same border/focus
  classes a third time.
- `apps/web/src/features/upload/UploadDropzone.tsx` — restyled onto tokens
  (`border-selection`/`bg-selection-subtle` for drag-over, `bg-primary` for the
  Choose File button, `text-error` for the validation message). The
  `input[type="file"]` element `e2e/golden-path.spec.ts` locates is unchanged.

**Confirmed clean after the fix**: a repo-wide sweep for legacy color classes, raw
hex literals, and `rgba()` fills/strokes across every `.tsx` file in `apps/web/src`
returned zero real hits (one match was inside an explanatory code comment
referencing an old, already-removed hex value — not a live style).

**Full automated suite, run fresh for this phase:**

| Command | Result |
|---|---|
| `npm run typecheck` (web + api + scripts) | ✅ Clean |
| `npm run test` (Vitest, shared-types + api) | ✅ 124 + 386 passed |
| `npm run test:py` (Pytest, cv-worker boundary-parity) | ✅ 19 passed — **not run once during Phases 2A–2J**; confirms the TS/Python geometry-parity fixture this frontend work never touched is still intact |
| `npm run build` (all 4 workspaces) | ✅ Success — Vite 128 modules, 703ms |
| `npx playwright test` (both suites) | ✅ 3 passed |

**Manual regression walkthrough — real UI interactions, not a re-read of prior
phases' evidence.** File upload has no equivalent to Playwright's `setInputFiles` in
this session's browser-automation surface, so a brand-new upload→detect walkthrough
wasn't possible here (that exact path is what `golden-path.spec.ts` exists to prove,
and it has run green on every phase in this plan). Given that, this pass targeted
what hadn't been exercised live yet, using real clicks and real typed keystrokes
throughout (not JS-dispatched shortcuts) end to end on the Dashboard, and closing the
one specific gap `docs/execution/phase-log.md`'s Phase 16 flagged as
"not independently verified":

| Check | Result |
|---|---|
| Dashboard: create a project (real typed name, real click) | ✅ navigated into a fresh empty workspace showing the restyled `UploadDropzone` |
| Dashboard: delete that project (real click → confirm dialog → real click Delete) | ✅ dialog showed correct copy, project removed from the list |
| **Structure section dirty-check** (the Phase 2G gap) | ✅ typed into `#structure-order`: footer → "Unapplied"; clicked Apply: footer → "Applied"; clicked Reset: footer → "No structure override" — the full cycle, matching what was already proven for Style/Geometry/Content/Detection |
| Export ZIP button state | ✅ present, enabled — not clicked (a real click starts an actual file download this session's tools can't inspect the result of, and `golden-path.spec.ts` already asserts the download event and `.zip` filename on every run) |
| Console errors throughout | The same cached `ClassPicker is not defined` tooling artifact reappeared an **eighth** time, identical timestamp, across a full new-tab navigation — final reconfirmation that it is a stale automation-tool buffer, not a live application error (the app was demonstrably functional in every check across all of Phase 2) |

**Preservation checks** (from `regression-checklist.md`'s own list): model→manual
flip — exercised by `golden-path.spec.ts`'s class-change step, unchanged code path,
still green. Immutable `CodeVersion` rows — no file in `code-versions` routes or the
save/activate handlers was touched in any Phase 2 phase. Preview sandbox — triple-
checked in Phase 18 (`grep`, live DOM read, e2e), unchanged since. Content-override
`<`/`>` and scheme rejection — exercised live by `inspector-overrides.spec.ts` on
every run. Boundary-parity fixture — `test:py`, 19/19, above.

**Known limitations**

1. A brand-new upload→detect live walkthrough was not performed in this session
   (tooling gap, not a product gap) — covered instead by `golden-path.spec.ts`,
   which exercises exactly that path and has been green on every phase's e2e run.
2. Export ZIP's actual download was not triggered live this phase (would start a
   real, uninspectable download) — covered by the same e2e suite's explicit
   `waitForEvent("download")` assertion.
3. No visual-regression harness or automated axe/contrast tooling exists in this
   repo (pre-existing gap, noted every phase, still open — a reasonable candidate
   for a future phase, not blocking this one).

## Phase 2 — closing summary

All eleven phases (2A–2K) are complete. Design tokens, a primitive component
library, a rebuilt workspace shell, a restyled canvas with new zoom/pan/legend
capabilities, an icon-and-collapse-enabled Layers tree, an accordion Inspector, a
light-themed code editor, a chrome-and-loading-aware Preview pane, full responsive/
keyboard/ARIA coverage, and a final QA pass that caught and fixed real drift — all
delivered without a single regression to detection behavior, override behavior,
code generation, code-version immutability, preview sandboxing, export behavior, or
page-boundary behavior, verified at every phase boundary via typecheck, build,
Vitest, and both e2e suites (kept green throughout, including through one
deliberately-tracked rename and one deliberately-tracked accordion-collapse test
update), plus extensive live DOM/network-level manual verification beyond what the
test suites alone assert. See `docs/execution/phase-log.md`'s Phases 10–20 for the
complete per-phase record.

## Summary table

| Phase | Scope | Risk | Depends on |
|---|---|---|---|
| 2A | Design tokens | None | — |
| 2B | App shell / navigation | Low | 2A |
| 2C | Dashboard | Low | 2A, 2B |
| 2D | Workspace shell (toolbar + status bar) | Medium | 2A, 2B, 2C |
| 2E | Canvas | Medium-high | 2A, 2D |
| 2F | UI Tree | Medium | 2A, 2D |
| 2G | Inspector | **Highest** | 2A, 2D |
| 2H | Code panel | Low | 2A, 2D |
| 2I | Preview | Low (hard security gate) | 2A, 2D, 2H |
| 2J | Responsive / accessibility | Medium | 2A–2I |
| 2K | Visual QA / polish | Low | 2A–2J |

## Recommended next implementation phase

**Phase 2A — Design tokens.** It has zero dependencies, touches exactly two
configuration files, changes no component behavior, and unblocks every subsequent
phase. This matches the audit's own §25 ranking (tokens as the first redesign
priority) and this document's dependency graph — every other phase lists 2A as a
prerequisite.

**Stop here per the task's explicit instruction — do not begin Phase 2A or any
implementation until this specification is reviewed and approved.**
