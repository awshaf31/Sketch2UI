---
title: "Sketch2UI — Phase Execution Log"
purpose: "Append-only record of what each phase actually did, against the baseline. One entry per completed phase."
---

# Phase Execution Log

Append one entry per phase. Do not rewrite prior entries — corrections go into a
new entry that supersedes an earlier one.

Every entry uses the report template from §23 of
`Sketch2UI_Claude_Code_Phase_by_Phase_Execution_Plan.md`.

---

## Phase 0 — Baseline / Safety Lock

**Date:** 2026-08-24
**Goal:** Establish a reproducible baseline so all later phases can be measured
against the current working prototype.
**Status:** ✅ Complete (with one open decision — see Known limitations).

### Files added

- `docs/execution/current-baseline.md` — the baseline snapshot (env, layout,
  scripts, model registry, dataset counts, taxonomy, persistence, jobs,
  inspector state, tests, known gaps)
- `docs/execution/phase-log.md` — this file
- `docs/execution/regression-checklist.md` — 15-step manual smoke path

### Files changed / removed

None. No application code was touched.

### Tests

| Command | Result |
|---|---|
| `npm run test` | 38 passed / 0 failed (Vitest, `packages/shared-types`) |
| `npm run test:py` | 19 passed / 0 failed (Pytest, `services/cv-worker`) |
| `npm run build` | Success (shared-types → codegen → apps/api → apps/web; Vite 654 ms) |

### Manual verification

Not run in Phase 0 — the API/web/cv-worker triad requires three interactive
processes and no code was changed. The regression-checklist path is prepared for
the end of Phase 1.

### Database changes

None.

### API changes

None.

### Frontend changes

None.

### ML changes

None. Model registry `ui-detector/v1.0.0` unchanged.

### Known limitations / open decisions

1. **The project directory is not a git repository** (`git status` errors with
   `fatal: Not a git repository`). This blocks Rule 4 (git safety) and Phase 0
   task 0.4. Options for the user:
   - (a) `git init && git add . && git commit -m "baseline: pre-phase-1 snapshot"`
     inside the project directory, then continue.
   - (b) Continue without version control (accepts the risk that Phase 1+ edits
     have no rollback point).
   - (c) Move the project into an existing git repo.
   Recommendation: (a). Phase 1 should not begin until this is resolved, per
   Phase 0's stop condition ("If the baseline cannot be reproduced, stop.").
2. `.github/workflows/` directory exists but contains no YAML — CI is not
   scaffolded (deferred to Phase 15, expected).
3. Two class-id namespaces (41-class taxonomy vs 16-class v1 subset) coexist with
   no runtime translator on the API side. Latent risk for Phase 6-7.

### Next phase

**Phase 1 — Geometry Inspector.** Blocked by the git decision above.

---

## Phase 1 — Geometry Inspector

**Date:** 2026-08-24
**Goal:** Add an editable Geometry group (x, y, width, height) to the Inspector,
keyed on detection UUID, mirroring the Style/Content override architecture.
**Status:** ✅ Complete.

### Files added

- `packages/shared-types/src/geometry-override.ts` — `GeometryOverride` type,
  `validateGeometryOverride()` (shared with the API), `effectiveBBox()`,
  `applyGeometryOverrides()`
- `packages/shared-types/src/__tests__/geometry-override.test.ts` — 24 tests
  covering validator, effectiveBBox, and identity across regeneration
- `apps/api/src/modules/geometry-overrides/geometry-overrides.routes.ts` —
  GET/PUT/DELETE endpoints under `/api/projects/:id/geometry-overrides[/:detectionId]`

### Files changed

- `packages/shared-types/src/index.ts` — re-export geometry-override module
- `packages/shared-types/src/project.ts` — add `Project.geometryOverrides?` field
- `packages/codegen/src/index.ts` — accept `geometryOverrides` in `generateCode`
  options; apply BEFORE `buildUITree` so containment / row grouping key off the
  effective positions
- `apps/api/src/server.ts` — import + mount `geometryOverridesRouter`
- `apps/api/src/modules/codegen/codegen.routes.ts` — pass
  `project.geometryOverrides` through to `generateCode`
- `apps/web/src/services/api.ts` — add `listGeometryOverrides` /
  `putGeometryOverride` / `clearGeometryOverride`
- `apps/web/src/utils/tree.ts` — accept `geometryOverrides`, apply before
  `buildUITree`
- `apps/web/src/features/inspector/InspectorPanel.tsx` — add Geometry section
  with x/y/width/height inputs, Apply/Reset, dirty tracking, client-side
  validation via the shared `validateGeometryOverride`
- `apps/web/src/pages/ProjectWorkspace.tsx` — load geometry map on workspace
  open, fold into `effectiveDetections` (so canvas/tree/code/preview all see
  the same positions), wire `handleApplyGeometry` / `handleResetGeometry`, and
  clear the geometry override when the user drags/resizes the box directly on
  canvas (so a canvas drag lands instead of silently reverting)

### Files removed

None.

### Preservation posture

- `packages/codegen/src/layout.ts`, `packages/codegen/src/html.ts`,
  `packages/codegen/src/css.ts` — **unchanged**, per Rule 2 of the execution plan
- Existing Style/Content override modules — **unchanged**
- Immutable `CodeVersion` behavior — **unchanged** (Apply still creates a new
  `source: "generated"` version via the existing `POST /code-generation-jobs`)
- Sandboxed preview iframe — **unchanged** (geometry is numeric, no HTML/CSS
  surface widened)
- Boundary parity contract — **unchanged** (fixture + Python still pass; see
  test results below)

### Tests

| Command | Result | Delta from Phase 0 |
|---|---|---|
| `npm run test` (Vitest, shared-types) | **62 passed / 0 failed** (3 files) | +24 new geometry tests |
| `npm run test:py` (Pytest, cv-worker) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` (web + api + scripts) | clean | unchanged |
| `npm run build` (all four workspaces) | success (Vite 794 ms, 94 modules) | +1 module |

New Vitest coverage in `geometry-override.test.ts`:

- validator — 15 cases (valid full/partial/empty/tolerance/null; rejects
  non-object, negatives, zero dimensions, over-edge, partial + base overflow,
  NaN/Infinity, non-numeric strings, unknown keys)
- `effectiveBBox` — 3 cases (no override, partial merge, full merge)
- `applyGeometryOverrides` — 6 cases (no-op ref preservation, no mutation,
  matching detection only, identity preservation, UUID-key stability across
  shuffled detection order)

### Live API smoke test

Ran a scripted end-to-end against a locally-started API (killed after test,
store restored):

| Case | Response | Verdict |
|---|---|---|
| `GET geometry-overrides` (empty) | `{}` | ✓ |
| `PUT` full valid override | 200, `{detectionId, geometry: {x:0.4,y:0.2,w:0.3,h:0.15}}` | ✓ |
| `GET` after PUT | populated map | ✓ persisted |
| `PUT {x:-0.1}` | 400 `VALIDATION_FAILED` "x must be >= 0." | ✓ |
| `PUT {x:0.8, width:0.3}` | 400 "x + width (1.1000) must be <= 1." | ✓ |
| `PUT {rotation:45}` | 400 "Unknown geometry field: rotation" | ✓ |
| `PUT` on nonexistent detection | 404 `NOT_FOUND` | ✓ |
| `PUT {width:0.5}` (partial) | 200, only `width` stored | ✓ |
| `DELETE` | 204 | ✓ |
| `GET` after DELETE | `{}` | ✓ |

### Manual verification

Not executed as a browser session (no interactive display in this environment).
The scripted API smoke test above exercised every server branch. Frontend
correctness relies on:

- Typechecking (green)
- Vite build (green, 94 modules)
- The Inspector Geometry section mirroring the Style/Content sections structurally
- `effectiveDetections` folding geometry BEFORE the boundary check, so the canvas
  overlay reflects overrides the same way the tree and preview do

For the next real project session, run the [regression checklist](regression-checklist.md)
including the "After Phase 1" verifications.

### Database changes

- `Project.geometryOverrides?: Record<detectionId, GeometryOverride>` — new
  optional field on the JSON store's `Project` shape. Absent on existing
  projects; the store returns `{}` from GET when the field is missing. No
  migration needed.

### API changes

- **New router:** `/api/projects/:id/geometry-overrides`
  - `GET /` — full map for the project
  - `PUT /:detectionId` — upsert; empty body `{}` is a delete (matches Style Reset)
  - `DELETE /:detectionId` — 204, idempotent
- Validation body: partial `{ x?, y?, width?, height? }`, strict normalized
  `[0,1]`, `x+width` and `y+height` bounded by 1 + `GEOMETRY_TOLERANCE` (1e-6),
  unknown keys rejected

### Frontend changes

- **New section** in `InspectorPanel`: Geometry, between Style and Content.
  Empty inputs = "inherit from detection bbox"; per-field placeholders show the
  current detection value so the user can see what "inherit" means.
- **Canvas drag** on a detection that carries a geometry override now clears
  that override alongside the bbox PATCH, so drags always land visually.
- **Live preview** and **`/code-generation-jobs`** both pick up geometry via the
  same `applyGeometryOverrides` call, so live and saved outputs stay in step.

### ML changes

None. Model registry `ui-detector/v1.0.0` untouched.

### Known limitations / open decisions

1. Geometry PUT is a **full replacement** of the stored map entry (matches the
   Style-Overrides semantics). A user who wanted to add height to an existing
   x/y/width override must resend x/y/width too. The Inspector always sends
   the current draft, so this is invisible in practice — but a future API
   client using PATCH semantics would need documentation.
2. The Inspector uses `<input type="number">`, which delegates min/max to the
   browser but the app relies on the shared validator for the real invariants
   (some browsers do not enforce `min`/`max` on manual entry). Validation runs
   on Apply — never on keystroke — matching the Style/Content debounce pattern.
3. No E2E test yet (`tests/` at repo root still `.gitkeep`-only). The
   Playwright suite is Phase 14; when it lands, the Phase-1 "After Phase 1"
   verifications in the regression checklist should become an automated case.

### Next phase

**Phase 2 — Structure Inspector.** Not blocked. Ready to start after user
confirmation.


