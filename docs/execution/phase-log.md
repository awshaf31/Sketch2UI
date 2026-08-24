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

---

## Phase 2 — Structure Inspector

**Date:** 2026-08-24
**Goal:** Add an editable Structure group (parent, displayOrder) to the
Inspector, keyed on detection UUID, LAYERING on top of the existing automatic
containment / row grouping in `packages/codegen/src/layout.ts`.
**Status:** ✅ Complete.

### Files added

- `packages/shared-types/src/structure-override.ts` — `StructureOverride` type,
  `validateStructureOverride()` (parent existence, self-parent, cycle
  detection over the pending state), `structureOverrideHasFields()`
- `packages/shared-types/src/__tests__/structure-override.test.ts` — 19 tests
  covering the accept/reject matrix (empty, root, valid parent, both fields,
  undefined; non-object, unknown field, self-parent, missing parent, direct
  cycle, chain cycle, negative order, non-integer order, string order, empty
  parent id, `structureOverrideHasFields`)
- `apps/api/src/modules/structure-overrides/structure-overrides.routes.ts` —
  GET/PUT/DELETE under `/api/projects/:id/structure-overrides[/:detectionId]`

### Files changed

- `packages/shared-types/src/index.ts` — re-export structure-override
- `packages/shared-types/src/project.ts` — add `Project.structureOverrides?`
- `packages/codegen/src/layout.ts` — targeted addition (no rewrite): new
  `resolveParent()` consults overrides ahead of `findParent()`;
  `reorderByStructureOverrides()` sorts each container's direct children by
  (displayOrder, explicit-wins-tie, autoIndex); `buildUITree` accepts
  `structureOverrides` in its options and threads it through `finalize()` and
  the root-level pass
- `packages/codegen/src/index.ts` — accept `structureOverrides` in
  `generateCode` options
- `apps/api/src/server.ts` — import + mount `structureOverridesRouter`
- `apps/api/src/modules/codegen/codegen.routes.ts` — pass
  `project.structureOverrides` through to `generateCode`
- `apps/web/src/services/api.ts` — add `listStructureOverrides` /
  `putStructureOverride` / `clearStructureOverride`
- `apps/web/src/utils/tree.ts` — accept `structureOverrides`, pass to
  `buildUITree`
- `apps/web/src/features/inspector/InspectorPanel.tsx` — add Structure section
  (parent dropdown with "Auto" + "Root" + candidates, displayOrder input,
  Apply/Reset, dirty tracking, client-side parse errors), consumes new
  `currentStructure` / `parentCandidates` / `onApplyStructure` /
  `onResetStructure` props
- `apps/web/src/pages/ProjectWorkspace.tsx` — load structure map on workspace
  open, compute `parentCandidates` (excludes selected node and its downstream
  chain per stored overrides), wire `handleApplyStructure` / `handleResetStructure`,
  and pass through to Inspector + `buildTreeAndCode`

### Files removed

None.

### Preservation posture

- `packages/codegen/src/layout.ts` — modified via **targeted additions only**
  (`resolveParent`, `reorderByStructureOverrides`, one option field on
  `buildUITree`). The existing `findParent`, `groupIntoRows`,
  `groupRepeatedSiblings`, `inferLayout`, and `resolveOverlappingDetections`
  functions are unchanged. Auto containment / row grouping / repeated-sibling
  grid detection all still run first; the override redirects, never replaces.
- `packages/codegen/src/html.ts`, `packages/codegen/src/css.ts` — unchanged
- Existing Style/Content/Geometry override modules — unchanged
- Immutable `CodeVersion` behavior — unchanged (Apply still creates a new
  `source: "generated"` version via the same POST route)
- Boundary parity contract — unchanged (Python + TS both green)
- Preview sandbox — unchanged (structure is not an HTML/CSS injection surface)

### Design decisions

1. **Fold-in point**: parent + order **inside** `buildUITree`, not after. Auto
   containment and the manual override compete for the same slot (which parent
   this node belongs to), so applying the override outside would require
   re-parenting an already-built tree. The chosen split is: auto inference is
   the default; the override is consulted first in `resolveParent`, and the
   ordering pass runs after `groupRepeatedSiblings` so synthetic group nodes
   are still respected.
2. **Tie-break rule** for `displayOrder`: explicit values outrank implicit
   auto-index values at the same numeric key. Discovered during smoke test —
   an early version had "button pinned to 0" tie with "heading at auto-index
   0" resolving in favor of heading, which contradicts the user's mental
   model. The fix is documented in the sort comparator.
3. **Cycle detection** at write time, over the **pending state** (existing
   overrides merged with the proposed edit). Guarantees `layout.ts` never
   sees a cycle; a saved cycle would infinite-loop `resolveParent`.
4. **Candidate list** for the Inspector dropdown excludes the selected node
   and its downstream chain (per stored overrides). Defence-in-depth: the
   server rejects a cycle anyway, but hiding the option makes the UI less
   confusing.
5. **Dangling parent safety net** in `resolveParent`: a stored override
   pointing at a detection that has since been deleted or marked `rejected`
   treats the child as root, rather than dropping it. The API refuses to
   write such a reference in the first place, so this is only a
   post-modification safety net.

### Tests

| Command | Result | Delta from Phase 1 |
|---|---|---|
| `npm run test` (Vitest) | **all tests passing** — 62 unique across 3 files (19 boundary + 24 geometry + 19 structure). Vitest reports 124 because it also picks up the compiled `dist/**/*.test.js` from an earlier `npm run build` — see limitations below. | +19 unique |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean | unchanged |
| `npm run build` | success (95 modules, Vite 989 ms) | +1 module |

New coverage in `structure-override.test.ts`:
- accepts: empty body, `parentDetectionId: null`, valid parent ref,
  `displayOrder`, both fields, `undefined` fields (6 cases)
- rejects: non-object body, unknown field, self-parent, missing parent,
  direct cycle (A↔B), chain cycle (A→B→C→A), negative order, non-integer
  order, string order, empty-string parent id (10 cases)
- `structureOverrideHasFields` — 3 cases

### Live API + codegen smoke test

Ran a scripted end-to-end that not only exercises every route branch but also
verifies the generated HTML **actually reflects the override** end-to-end.

| Case | Verification | Verdict |
|---|---|---|
| Three siblings in one row (heading/text/button) | HTML order: `h2 → p → button` (auto) | ✓ |
| PUT `{displayOrder: 0}` on button | HTML re-order: `button → h2 → p` | ✓ pinned-to-front |
| PUT reparent A under B | Generated HTML has `<h2>` nested inside `<p>` | ✓ reparented |
| PUT self-parent | 400 "A detection cannot be its own parent." | ✓ |
| PUT non-existent parent | 400 "not an active detection" | ✓ |
| PUT unknown field | 400 "Unknown structure field: weirdo" | ✓ |
| Set B parent = C, then try C parent = B | 400 "This override would create a parent cycle." | ✓ |
| DELETE (Reset) | 204, GET returns `{}` | ✓ |

### Manual verification (regression checklist)

Not executed as a browser session (no interactive display). Automated coverage
above validates the server + codegen layers end-to-end; the frontend section
relies on typechecking and the Vite build (both clean). The `parentCandidates`
memo prevents the user from ever selecting an obviously invalid parent in the
UI.

### Database changes

- `Project.structureOverrides?: Record<detectionId, StructureOverride>` — new
  optional field on the JSON store's `Project` shape. Absent on existing
  projects; GET returns `{}` when missing. No migration needed.

### API changes

- **New router:** `/api/projects/:id/structure-overrides`
  - `GET /` — full map for the project
  - `PUT /:detectionId` — upsert; empty body `{}` deletes the entry (matches
    the other Inspector groups' Reset flow)
  - `DELETE /:detectionId` — 204, idempotent
- Validation: `parentDetectionId` must be null or the id of a currently
  ACTIVE detection in the project; no self-parent; no cycle over the
  pending state. `displayOrder` must be a non-negative integer.

### Frontend changes

- **New section** in `InspectorPanel`: Structure, between Geometry and Content.
  Parent dropdown offers "Auto (from containment)", "Root (page)", and every
  eligible sibling; displayOrder is a numeric input; both blank = "no
  override".
- Loading, apply/reset, and busy-flag semantics **mirror the other three
  groups verbatim** — same look, same error surface, same regenerate-then-
  refresh flow.

### ML changes

None. Model registry `ui-detector/v1.0.0` untouched.

### Known limitations / open decisions

1. **Test count double-report**: `npm run test` reports 124 because vitest
   auto-discovers `dist/**/*.test.js` when a build has been run locally. The
   62 `.ts` sources are the source of truth; the `.js` duplicates just re-run
   the same assertions. Fix (out of scope for Phase 2): add
   `test.exclude: ["**/dist/**"]` to a `vitest.config.ts` in
   `packages/shared-types`. CI (per Phase 15) will run without local build
   output and see the correct count.
2. **No E2E test yet** (Playwright is Phase 14). The layout `.ts`
   integration test (buildUITree with structureOverrides) is verified end-to-
   end through the live smoke test only; a unit test in `packages/codegen`
   would need to add vitest to that package. Deferred to Phase 14 or 15.
3. **Order semantics**: `displayOrder` is a sort *floor* with
   explicit-beats-implicit tie-break — not an absolute-position rewrite.
   Documented in the sort comparator. A user who wants "renumber everything
   0..N" must Apply on each sibling.
4. **DisplayOrder on synthetic group nodes**: not supported. The user's
   addressable unit is the detection; synthetic group containers (the ones
   created by `groupRepeatedSiblings` for repeated card rows) have no
   `sourceDetectionId` and therefore inherit their auto position. If a user
   wants to reorder cards within a card grid, they'd set explicit
   `displayOrder` on each card. Fine for Phase 2; revisit if the UX proves
   awkward.
5. **Tree drag/drop UI** (mentioned as optional in the plan) — not
   implemented. The dropdown + numeric input covers the same functional
   surface; drag/drop is deferred to a later polish pass.

### Next phase

**Phase 3 — Detection Inspector.** Not blocked. Ready to start after user
confirmation.

---

## Phase 3 — Detection Inspector

**Date:** 2026-08-24
**Goal:** Complete the final missing Inspector group: editable class, plus
read-only confidence / model version / source display (§17.3 Detection
group). Confirm all five groups (Detection, Geometry, Structure, Style,
Content) can coexist on one selected node without state conflicts.
**Status:** ✅ Complete.

### Key architectural difference from Phases 1-2

Detection is **not an override map**. Style/Content/Geometry/Structure each
persist a *separate* record keyed on detection UUID, layered onto the
detection or the UI-IR at generation time. Class is a property of the
detection itself — the plan is explicit that editing it should not create a
parallel/duplicate record (§17.3 Detection: "without creating duplicate
records"). So Phase 3 adds **zero new shared-types validators and zero new
API routes** — it wires the Inspector's Detection section to the **existing**
`PATCH /api/projects/:id/detections/:detectionId` route, the same one the
canvas correction flow (`handleUpdate` in ProjectWorkspace) already uses.
This is a second UI entry point onto pre-existing, already-tested behavior,
not new business logic.

### Files added

None.

### Files changed

- `apps/web/src/features/inspector/InspectorPanel.tsx` — replaced the static
  read-only class/confidence/source summary line with a full Detection
  section: editable class `<select>` (same `ALL_CLASSES` taxonomy as
  `ClassPicker`), read-only confidence/source/modelVersionId display,
  conditional "Model originally proposed: X" line when
  `originalClassName` is set, Apply/Reset-style Apply button, and a
  "Revert to model" button that resubmits the original class when available
- `apps/web/src/pages/ProjectWorkspace.tsx` — added `handleChangeClass()`
  (PATCH via the existing `api.updateDetection`, then `generateCode` +
  `refreshVersions`, mirroring the other four groups' Apply flow exactly),
  added a dedicated `applyingDetection` busy flag, wired
  `onChangeClass={handleChangeClass}` into `<InspectorPanel>`, and folded
  the new flag into the panel's combined `busy` prop

### Files removed

None.

### Preservation posture

- `apps/api/src/modules/detections/detections.routes.ts` and
  `detections.service.ts` — **completely unchanged**. The model→manual flip,
  `originalClassName` capture, and confidence lock-to-1.0-on-manual-edit
  behavior are all pre-existing and untouched.
- `packages/codegen/*` — unchanged. Class is already part of the `Detection`
  the layout engine consumes; no new fold-in point was needed.
- `layout.ts` / `html.ts` / `css.ts` — untouched.
- Style/Content/Geometry/Structure override modules — untouched.

### Tests

No new automated tests. Rationale: Phase 3 introduces no new validation
logic, no new API surface, and no new codegen fold-in point — there is
nothing here that isn't already covered by the pre-existing detection-route
behavior (unchanged) or by Phases 1-2's override tests (unaffected). Per
Rule 4 ("one concern per change") and the "do not rewrite working code"
principle, adding tests for code that was not touched would not improve
confidence in this phase's actual change, which is UI wiring plus one new
handler that calls two pre-existing API calls.

| Command | Result | Delta from Phase 2 |
|---|---|---|
| `npm run test` (Vitest) | 62 unique tests passing (124 reported — see Phase 2's noted dist/*.test.js duplication) | unchanged |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean | unchanged |
| `npm run build` | success (95 modules, Vite 645 ms) | unchanged |

### Live smoke test — coexistence verification

This IS where Phase 3's real risk lives: does changing a detection's class
disturb the four override maps already attached to it? Ran a scripted
end-to-end:

| Step | Result |
|---|---|
| Create detection, class = `text` | ✓ |
| Apply style override (`padding: 24px`) | ✓ stored |
| Apply content override (`text: "Hello World"`) — applicable to `text` class | ✓ stored |
| Apply geometry override (`width: 0.5`) | ✓ stored |
| Generate code | HTML contains "Hello World", CSS contains `24px` | ✓ |
| **PATCH class: `text` → `image`** (via the same route the new Inspector button uses) | 200, `className: "image"` | ✓ |
| Regenerate code | HTML no longer contains "Hello World" (content applicability re-checked: `text` field doesn't apply to `image`) | ✓ **correctly dropped** |
| Regenerate code (same pass) | CSS still contains `24px` (style override is keyed by detection id, unaffected by class) | ✓ **correctly survived** |
| GET content-overrides after class change | Override **still stored** (`{"text":"Hello World", ...}`) — not silently deleted, just stopped applying | ✓ matches "never destroy user corrections" rule |
| GET style-overrides / geometry-overrides after class change | Both still stored and applying | ✓ |
| GET detections | `className: "image"`, `source: "manual"` | ✓ |

This confirms the existing content-overrides applicability re-check (written
in Phase 0-era code, untouched by any of Phases 1-3) already does the right
thing when a class change makes a previously-applicable field inapplicable —
no new defensive code was needed.

### Manual verification

Not executed as a browser session. Typecheck + build clean; the live smoke
test above exercises the actual risk surface (cross-group state interaction)
end-to-end through the real API and codegen pipeline.

### Database changes

None. No new fields on `Project`. Detection's `className` field already
existed.

### API changes

None. No new routes. The existing `PATCH /api/projects/:id/detections/:detectionId`
gained a second caller (the Inspector) but no new server-side behavior.

### Frontend changes

- **New section** in `InspectorPanel`: Detection, now the FIRST section
  (above Style), matching its position as the foundational identity of the
  node — everything else (style, geometry, structure, content) is a property
  OF this class. Read-only confidence/source/model-version display replaces
  the old static summary line one-for-one.
- "Revert to model" button appears only when `originalClassName` is present
  (i.e., only after a model detection has been corrected at least once) —
  gives the user an explicit undo path without a general-purpose undo stack.

### ML changes

None.

### Inspector completeness — final state

| Group | Status |
|---|---|
| Detection (class, confidence, model, source) | ✅ Done (Phase 3) |
| Geometry (x, y, width, height) | ✅ Done (Phase 1) |
| Structure (parent, display order, re-parenting) | ✅ Done (Phase 2) |
| Style (display, gap, padding, margin, font-size, alignment) | ✅ Done (pre-existing) |
| Content (text, alt text, link) | ✅ Done (pre-existing) |

All five groups specified in plan §17.3 are now implemented. This closes the
Inspector-completeness gap identified as the top priority in
`PROJECT_STATUS.md` §6.

### Known limitations / open decisions

1. **Confidence remains read-only**, per explicit plan instruction ("do not
   let users falsify the model's confidence"). No override path exists or is
   planned for it.
2. **No E2E test yet** (Playwright is Phase 14). The live smoke test above is
   the only end-to-end evidence for Phase 3; it is not automated/repeatable
   without re-running the script manually.
3. Class change does not re-validate Structure overrides. A parent/child
   relationship that made semantic sense before a class change (e.g. `card` →
   `button`, still allowed by `resolveParent`'s permissive containment rules)
   is not re-checked. This mirrors the plan's Appendix C guidance to
   distinguish "hard invalid" from "unusual but allowed" rather than
   over-constrain — worth revisiting only if it proves confusing in practice.

### Next phase

Per the execution plan's phase order, the next item is **Phase 4 —
Correction history / audit trail**. The Inspector itself (Phases 1-3) is now
complete; Phase 4 is a cross-cutting concern (traceability of all edits made
via any of the five groups) rather than a sixth Inspector group.

