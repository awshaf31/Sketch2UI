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

---

## Phase 4 — Correction History and Audit Trail

**Date:** 2026-08-24
**Goal:** Make user corrections traceable (plan §4). Record class, geometry,
structure, create/delete events with old/new values and timestamps — not
just the final state. Connect approved correction snapshots to the existing
training export behavior. Add an optional read-only history UI once the data
path works.
**Status:** ✅ Complete.

### Files added

- `packages/shared-types/src/correction-record.ts` — `CorrectionType` union
  (`created`, `deleted`, `class_changed`, `bbox_changed`, `parent_changed`,
  `order_changed`, `ignored` — the last reserved, unused, see limitations),
  flat `CorrectionRecord` interface matching plan §4.1's field list literally
  (old/new pairs for class, bbox, parent, order)
- `apps/api/src/modules/corrections/corrections.service.ts` —
  `recordCorrection()` (append-only, caller owns `db.save()`),
  `listCorrections(projectId, detectionId?)`
- `apps/api/src/modules/corrections/corrections.routes.ts` — read-only
  `GET /api/projects/:id/corrections?detectionId=...`

### Files changed

- `packages/shared-types/src/index.ts` — re-export correction-record
- `packages/shared-types/src/training-sample.ts` — add
  `TrainingSampleBox.originalClassName?: string` (plan §4.4: connect
  correction signal to the training snapshot)
- `apps/api/src/db/jsonStore.ts` — add `correctionRecords: CorrectionRecord[]`
  to `StoreShape` + `emptyStore()`. Existing `store.json` files without the
  field get `[]` via the `load()` function's `{ ...emptyStore(), ...parsed }`
  spread — no migration script needed.
- `apps/api/src/server.ts` — mount `correctionsRouter`
- `apps/api/src/modules/detections/detections.routes.ts` — POST records
  `created`; PATCH records `class_changed` and/or `bbox_changed` (captures
  `previousBBox`/`previousClassName` before mutating); DELETE records
  `deleted` with a final snapshot before the row is spliced out
- `apps/api/src/modules/geometry-overrides/geometry-overrides.routes.ts` —
  PUT records `bbox_changed` using `effectiveBBox()` (old effective vs new
  effective, not the raw override object — what the box visually moved
  from/to). DELETE (Reset) records nothing — see design decision below.
- `apps/api/src/modules/structure-overrides/structure-overrides.routes.ts` —
  PUT records `parent_changed` and/or `order_changed` independently (a
  single PUT can carry both fields). DELETE records nothing.
- `apps/api/src/modules/training/training.routes.ts` — carry
  `d.originalClassName` into each `TrainingSampleBox` when present
- `apps/web/src/services/api.ts` — add `listCorrections(projectId)`
- `apps/web/src/features/inspector/InspectorPanel.tsx` — new read-only
  History section at the bottom of the panel; `describeCorrection()` /
  `formatCorrectionTime()` helpers render each record as a one-line
  human-readable entry (plan §4.3's mockup format); new `history` prop
- `apps/web/src/pages/ProjectWorkspace.tsx` — `corrections` state loaded on
  mount, `refreshCorrections()` called after every correction-producing
  action (create, canvas bbox update, delete, class change, geometry Apply,
  structure Apply — NOT the Reset variants), `selectedHistory` memo scoping
  the full list to the selected detection, wired into `<InspectorPanel>`

### Files removed

None.

### Design decisions

1. **Flat schema, not a discriminated union.** The plan's §4.1 field list is
   literally flat (`oldClass`, `newClass`, `oldBBox`, ...). Matching it
   directly keeps every append call site a simple object literal — no type
   narrowing gymnastics per `type`.
2. **Reset does not produce a correction record.** Only the four Apply-style
   mutations (create, PATCH, geometry PUT, structure PUT) and DELETE record.
   Reverting an override is un-correcting, not a new correction to learn
   from — consistent with the Phase 2/3 reports' established reasoning about
   what counts as "traceable user intent."
3. **Style/Content overrides are explicitly OUT of scope for correction
   history.** The plan's §4.1/§4.2 vocabulary (class/bbox/parent/order) maps
   to what feeds the ML training loop (§4.4/§36) — style and content never
   reach `ml/dataset`. Recording them would blur the "this closes the ML
   feedback gap" purpose of Phase 4 with general edit-tracking, which the
   plan does not ask for. Documented directly in the schema file's header
   comment so a future maintainer sees the boundary and its reason.
4. **`source: "user"` is a fixed literal**, not a five-way UI-surface enum
   (canvas vs. Detection-inspector vs. Geometry-inspector, etc.). An earlier
   design considered inferring the UI surface from which fields a PATCH body
   contained, but that is a fragile heuristic (both the canvas drag and the
   Inspector's class-change call the same `PATCH /detections/:id` route with
   different but not mutually-exclusive field sets). The plan's own field
   name — "user/source" — is honestly satisfied by a constant today, since
   this app has exactly one correction-producing actor (a human, through the
   web client) and no automated correction pipeline. The field stays typed
   as a string literal union of one value so a future automated path (e.g.
   an active-learning auto-accept) has somewhere to record itself without a
   schema change.
5. **`bbox_changed` via geometry override records the EFFECTIVE bbox
   (`effectiveBBox(base, override)`), not the raw override object.** A
   partial override (e.g. `{width: 0.5}`) alone is meaningless in a history
   list without the base — the reader wants "the box went from (x,y,w,h) to
   (x,y,w,h)," which is what `describeCorrection()` and any future detail
   view would need.
6. **`originalClassName` on `TrainingSampleBox`** closes a real gap: before
   this change, an approved training sample's `source: "manual"` could not
   distinguish "the user drew this from scratch" from "the user corrected
   what the model got wrong" — exactly the signal plan §36's "frequently
   corrected classes" active-learning report wants. This is additive (an
   optional field, populated only when the detection has one) and required
   no change to `scripts/src/active-learning-report.ts` or the exporter for
   this phase (a future phase could use it to sharpen that report).

### Tests

No new Vitest suite. `CorrectionRecord` is a passive data shape (no
validation logic — every field is optional, there is nothing to reject).
`recordCorrection`/`listCorrections` are two straightforward
filter/sort/append functions over the API-layer JSON store, which has no
existing test harness (consistent with Phase 3's precedent: apps/api has no
unit tests today — see PROJECT_STATUS.md §2.6 / the Phase 0 baseline's
Known Gaps #11). Correctness was instead verified end-to-end through a live
smoke test (below), which is the same evidence bar Phase 1-3 correction
codegen used for anything that could not be isolated as a pure function.

| Command | Result | Delta from Phase 3 |
|---|---|---|
| `npm run test` (Vitest) | 62 unique tests passing (124 reported, unchanged dist/*.test.js duplication noted in Phase 2) | unchanged |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean | unchanged |
| `npm run build` | success (96 modules, Vite 694 ms) | +1 module |

### Live smoke test

Ran a scripted end-to-end exercising every record-producing route and the
two things most likely to be wrong: (a) did Reset correctly NOT log a
correction, and (b) does `originalClassName` actually reach the training
snapshot.

| Step | Result |
|---|---|
| Create 2 detections | 2× `created` records | ✓ |
| PATCH class change | `class_changed` old→new | ✓ |
| PATCH bbox change (canvas-style) | `bbox_changed` old→new | ✓ |
| PUT geometry override | `bbox_changed` old→new (EFFECTIVE bbox, confirmed via `effectiveBBox`) | ✓ |
| PUT structure override (`parentDetectionId` + `displayOrder` together) | Both `parent_changed` AND `order_changed` recorded from one PUT | ✓ |
| `GET /corrections` (project-wide) | 7 records in creation order | ✓ |
| `GET /corrections?detectionId=X` | Scoped correctly (6 of 7 belonged to the first detection) | ✓ |
| DELETE a detection | `deleted` record appended (8th), with the final className snapshotted | ✓ |
| **DELETE a geometry override (Reset)** | Correction count **unchanged** (8 before, 8 after) | ✓ confirms design decision #2 |
| Simulate a model-corrected detection (`source: "model"`, `originalClassName: "input"`) via direct store edit + server restart, then `approve-training` | `TrainingSampleBox` in the resulting snapshot carries `source: "model"`, `modelVersionId`, **and `originalClassName: "input"`** | ✓ confirms design decision #6 |

The `originalClassName` verification required restarting the API process
after a direct store edit — the JSON store loads once at boot and holds
state in memory, so a same-process file edit is invisible until restart.
This is expected behavior of the existing store (documented in its own
header comment), not a Phase 4 concern, but worth noting for anyone
reproducing this test.

### Manual verification

Not executed as a browser session. The live smoke test above exercises the
full round-trip through the real API and JSON store; the InspectorPanel
History section renders directly off the same `CorrectionRecord[]` shape
the smoke test validated, and `npm run build` confirms it compiles and
bundles without type errors.

### Database changes

- `StoreShape.correctionRecords: CorrectionRecord[]` — new field, defaults
  to `[]` for existing store files via the load-time spread. Unbounded
  growth (consistent with every other table in this JSON store — no
  pruning/retention policy exists anywhere in the current persistence
  layer; this is a pre-existing property of the architecture, not something
  Phase 4 introduces or needs to solve before Phase 8's Postgres migration).

### API changes

- **New route:** `GET /api/projects/:id/corrections[?detectionId=...]` —
  read-only.
- No new write routes — recording is a side effect of five EXISTING routes
  (detections POST/PATCH/DELETE, geometry-overrides PUT, structure-overrides
  PUT), each of which already had a single `db.save()` call that the new
  `recordCorrection()` call rides along with.

### Frontend changes

- New **History** section at the bottom of `InspectorPanel`, below Content.
  Read-only list, oldest-first, one line per record:
  `HH:MM  <human-readable description>`. Empty state: "No corrections
  recorded yet."
- `ProjectWorkspace` fetches the project's full correction list once on
  mount and re-fetches after any of the six correction-producing actions,
  matching the existing "re-fetch after write" pattern the four override
  maps already use.

### ML changes

- `TrainingSample.boxes[].originalClassName` — see design decision #6.
  `scripts/src/active-learning-report.ts` was NOT modified this phase (out
  of scope — Phase 4's job was to make the data available, not to change
  what the report does with it).

### Known limitations / open decisions

1. **`ignored` correction type is defined but never emitted.** No route in
   this app sets a detection to a deliberately-ignored state — `status:
   "rejected"` is always the automatic result of page-boundary filtering
   (§10.4), never a per-box user action. The type stays in the union per the
   plan's §4.2 taxonomy so a future explicit "ignore this box" UI action has
   somewhere to record itself.
2. **No pagination or retention policy** on `correctionRecords`. A
   long-lived project could accumulate a large list. Matches the existing
   unbounded-growth property of every other table in the JSON store (Phase 0
   baseline's Known Gap #3 already flags Postgres/Prisma — Phase 8 — as the
   place this gets addressed generally, not per-table).
3. **History section shows only the selected detection's records**, not a
   project-wide timeline. The plan's §4.3 mockup shows exactly this scope
   (per-node history in the Inspector), so this matches spec; a project-wide
   audit view was not requested and was not built.
4. **`source: "user"` cannot currently distinguish which UI surface
   triggered a correction** (canvas drag vs. Inspector class-change both hit
   the same PATCH route). See design decision #4 — deliberate, not an
   oversight; revisit only if multi-actor provenance becomes a real product
   need (e.g. after Phase 10 auth).
5. **No automated test coverage** for `corrections.service.ts` — apps/api
   has no unit test harness at all today (pre-existing gap, not introduced
   by this phase). Verified via live smoke test instead; see Tests section.

### Next phase

Per the execution plan's phase order, the next item is **Phase 5 — Dataset
expansion and ML quality program**: run the existing active-learning report,
build a dataset-quality matrix, and identify P0/P1/P2 gaps before any
retraining. This is a data/ML-investigation phase, not a code-implementation
phase — Claude Code should read the current `report:active-learning` output
before writing anything.

---

## Phase 5 — Dataset Expansion and ML Quality Program

**Date:** 2026-08-24
**Goal:** Focus only on dataset quality (plan §5, execution plan Phase 5
prompt). Run the active-learning report, inspect existing v1 dataset
statistics, produce a dataset quality report (images per split, objects per
class, underrepresented classes, weak model classes, hard-negative status,
duplicate/leakage risk), and add/improve scripts for label validation and
statistics. **Explicitly: do not retrain, do not change model weights.**
**Status:** ✅ Complete.

### Files added

- `docs/ml/dataset-quality-v1.1.md` — the dataset quality report (plan §5.2
  matrix, §5.4 checks, §5.5 hard-negative assessment, P0/P1/P2 priority
  matrix, reproducibility commands, recommended next actions)
- `scripts/src/dataset-quality-report.ts` — reusable, read-only CLI: per-
  class/per-split instance tally, zero-area/non-finite/out-of-bounds box
  checks, empty-label-file detection, cross-split filename-stem collision
  check, and MD5 exact-duplicate-image detection. Exposed as
  `npm run report:dataset-quality` (with `--json` for machine output,
  matching `report:active-learning`'s existing convention).

### Files changed

- `package.json`, `scripts/package.json` — add the `report:dataset-quality`
  script
- `README.md` — document the new command alongside the existing
  `report:active-learning` / `eval` entries

### Files removed

None.

### What this phase deliberately did NOT do

Per the plan's explicit Phase 5 instruction ("Do not retrain yet. Do not
change model weights yet."):

- No `ml/training/train_v1.py` run
- No new `ml/models/ui-detector/*` version directory
- `ml/models/ui-detector/v1.0.0/weights.pt` untouched
- `ml/dataset/` was only READ — every script run used `--dry-run` where
  applicable, and the new `dataset-quality-report.ts` never writes anything
  (verified: `git status` after this phase shows zero changes under
  `ml/dataset/` or `apps/api/data/`)
- Did not build the content-hash deduplication tooling the report
  recommends for the exporter — flagging that gap accurately was this
  phase's job; fixing `export-yolo-dataset.ts` is out of scope here (see
  the report's §8 "what this report does NOT do")

### Key findings (full detail in `docs/ml/dataset-quality-v1.1.md`)

1. **The on-disk full-taxonomy corpus is 162 images / 2,917 label
   instances** across train/val/test — 6 more images than the frozen
   `v1-training-scope.md` subset count (156), because that subset drops
   images left with zero boxes after filtering to the 16 trained classes.
2. **Label geometry is clean**: 0 zero-area, 0 non-finite, 0 out-of-bounds
   boxes anywhere in 2,917 instances. All 41 classes have a documented
   definition in `docs/ml/annotation-guide.md` — verified by checking every
   class name is backtick-quoted there.
3. **New finding, not previously documented anywhere in the repo: 6 exact
   byte-identical duplicate images exist in the corpus** (5 duplicate
   groups via MD5), accounting for ≈7.5% of all label instances (218 of
   2,917) being counted from content that already appears elsewhere.
   Traced to the same handful of in-house sketches being re-uploaded across
   multiple test/demo projects during development, each getting a fresh
   asset UUID that the exporter treats as a distinct image. **All 6 stay
   within `train`** — confirmed no duplicate crosses into `val`/`test`, so
   there is no train/test leakage from this, but it does inflate perceived
   per-class coverage without adding real diversity.
4. **4 classes have zero examples anywhere**: `avatar`, `list_item`, `map`,
   `newsletter`. 25 of 41 classes remain unevaluable (0 in val or test) —
   unchanged from what `v1-training-scope.md` already documented, now
   independently reconfirmed against the live corpus rather than trusted
   from an earlier snapshot.
5. **4 empty label files** exist in `train`, and cross-referencing against
   the live store's active-learning report shows these read as simply
   un-annotated uploads rather than deliberate §9.5 background negatives —
   flagged for manual confirmation before being trusted as training signal.
6. **No genuine hard-negative examples** (off-page handwritten notes,
   arrows, measurements) currently exist in the corpus, despite the
   annotation guide and runtime boundary-filtering system both already
   having the correct policy/mechanism. This is a data-collection gap, not
   a policy or tooling gap.
7. **P0/P1/P2 priority matrix** built from real AP@0.5 numbers (not
   estimated): P0 = `select`, `radio_button`, `carousel` (already-known-weak,
   per the model's own registry README) plus `card` and `page` (currently
   **untrained** — 0 in val/test — despite driving core product features:
   card-grid layout inference and page-boundary detection respectively).

### Tests

No new Vitest suite — `dataset-quality-report.ts` is a build-time CLI tool
in the `scripts` workspace, matching `active-learning-report.ts` and
`export-yolo-dataset.ts`'s existing precedent of no dedicated test file
(none of the three has one; correctness is demonstrated by running them
against the real corpus and manually verifying the output, which is exactly
what this phase did — see "Verification" below).

| Command | Result | Delta from Phase 4 |
|---|---|---|
| `npm run test` (Vitest) | 62 unique tests passing (124 reported, same known dist duplication) | unchanged |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean (new script typechecks under the `scripts` workspace) | unchanged |
| `npm run build` | success (96 modules, Vite 677 ms) | unchanged |

### Verification

`scripts/src/dataset-quality-report.ts`'s output was cross-checked against
an independent ad-hoc analysis (inline Node scripts, not committed) run
before the tool was written — both approaches produced **identical** numbers
for every metric: 162 images, 2,917 labels, the same per-class/per-split
counts, the same 4 empty label files, the same 5 duplicate groups with the
same 6 extra files, zero cross-split stem collisions. This cross-check is
the evidence that the new script is correct, not just that it runs.

### Manual verification

N/A — this phase produces a document and a read-only reporting tool, not a
runtime feature. `npm run report:dataset-quality` was executed directly and
its output inspected (see above).

### Database changes

None.

### API changes

None.

### Frontend changes

None.

### ML changes

- **Documentation only**: `docs/ml/dataset-quality-v1.1.md` is new. No
  dataset files, model weights, or training configuration changed.

### Known limitations / open decisions

1. **Hard-negative assessment is necessarily incomplete** — detecting
   whether an image contains an unlabeled off-page note requires looking at
   the actual image content, which this phase's tooling does not do
   (label-file parsing alone cannot distinguish "correctly left unlabeled
   hard negative" from "just wasn't drawn there"). The report is explicit
   about this limitation rather than fabricating a metric.
2. **The duplicate-image finding is not yet acted on.** The report
   recommends either manual cleanup of the redundant store projects/assets
   or an exporter-side content-hash dedup pass; neither was implemented
   this phase, by design (§5's scope is reporting).
3. **`npm run import:external` was not re-run** — it requires a network
   download from Roboflow Universe, which was unnecessary since the
   already-imported files are on disk and directly inspectable. This means
   the report is current as of what's already merged, not a check of
   whether new upstream data exists at the source.
4. **No automated CI gate** on any of these checks yet (Phase 15's job) —
   `report:dataset-quality` exists as a tool a human or a future CI job can
   run, not as an enforced pre-commit/pre-export check.

### Next phase

Per the execution plan's phase order and this report's own §9
recommendations, the next item is **Phase 6 — train YOLO release v1.1** —
but per the plan's explicit gate, that cannot start until:
(1) the duplicate-image and empty-label issues from this report are
resolved, and (2) a model-architecture decision document
(`docs/ml/model-decision.md` — YOLOv8-nano vs. literal YOLOv5, per plan
§9/Phase 6) is written FIRST, before any training code changes. Recommend
confirming with the user which of the two — data cleanup or the
architecture decision doc — to do first, since Phase 6 explicitly forbids
silently choosing an architecture.

---

## Phase 6 (preparation) — Architecture Decision + Exporter Dedup

**Date:** 2026-08-24
**Goal:** Satisfy the two hard preconditions the plan places in front of any
v1.1 training run: (1) write the mandated model-architecture decision
document, (2) fix the duplicate-image defect Phase 5 found. **No training
run, no weight changes.**
**Status:** ✅ Complete. Phase 6 *proper* (training) remains blocked — see
"Why training did not run" below.

### Files added

- `docs/ml/model-decision.md` — the plan's §9/Phase 6 mandated decision
  record: current vs. target architecture, evidence, trade-offs, inference-API
  compatibility analysis, decision, preconditions, and the recommended
  experiment design.

### Files changed

- `scripts/src/export-yolo-dataset.ts` — content-hash (MD5) deduplication.
  Approved-correction samples claim their content hash in a pre-pass (they are
  the authoritative version of an image — a human signed off on that box set,
  including corrected model boxes the plain manual export drops); the asset
  loop then skips any asset whose bytes are already claimed, and deletes any
  stale copy a pre-dedup run had written. Skipped duplicates are reported
  explicitly rather than silently dropped.
- `docs/ml/dataset-quality-v1.1.md` — §5.1 and §8 updated to record that the
  dedup fix landed and to add the newly-discovered duplicate pair.

### The architecture decision, in brief

**Decision: keep YOLOv8-nano as the primary line for v1.1; run a YOLOv5n arm
as a controlled A/B once the data is fixed; never adopt the classic
`ultralytics/yolov5` repo.**

The most useful finding is that the plan's binary framing (keep v8n vs. move
to YOLOv5) hides a third option that changes the calculus:

| Option | What | Inference-API impact |
|---|---|---|
| A | keep `yolov8n.pt` | none |
| **B1** | `yolov5n.yaml` **as shipped inside ultralytics 8.3.0** | **none** |
| B2 | classic `ultralytics/yolov5` repo | **breaking** |

Verified locally against the project's own pinned stack rather than assumed:

- Ultralytics 8.3.0 ships `yolov5.yaml` / `yolov5-p6.yaml`, so YOLOv5 is a
  first-class in-stack option — no new dependency.
- Both architectures instantiate cleanly at `nc=16`:
  **YOLOv5n = 2,222,064 params / 286 modules; YOLOv8n = 2,724,448 params /
  249 modules.** YOLOv5n is *smaller* (−18% params).
- `yolov5.yaml` uses **C3** blocks (genuine YOLOv5 v6.0 topology) while
  `yolov8.yaml` uses **C2f** — but **both terminate in the same anchor-free
  `Detect` head**. Identical head ⇒ identical output tensor format.
- `services/cv-worker/app/detector/model.py` couples only to the generic
  ultralytics surface (`YOLO(path)`, `.predict()`, `boxes.xywhn/.cls/.conf`).
  **Switching A → B1 therefore needs one CLI flag and zero inference-code
  changes.** B2 would require replacing the loader, rewriting result
  unpacking, adding a second ML dependency, and breaking the shared-pin
  guarantee between `ml/training/requirements.txt` and the worker.

The reason to still keep A as primary is scientific, not technical: Phase 5
established the bottleneck is *data*, and Phase 7 gates promotion on a
comparison against `baseline-v1.0.0.json`. Changing data *and* architecture in
the same version makes any metric movement unattributable. Since B1 costs one
flag, it is strictly better as a clean second arm on a fixed corpus than as a
confounder folded into v1.1.

An honest caveat is recorded in the document: ultralytics' `yolov5n` is
YOLOv5's backbone/neck with an anchor-free head, so it must be described as
"YOLOv5 backbone (C3) with an anchor-free head, via Ultralytics 8.3" and not
as plain "YOLOv5" — describing it as the latter would repeat exactly the kind
of imprecision the document exists to correct.

### The dedup fix

Phase 5 reported 5 duplicate groups / 6 extra copies by scanning
`ml/dataset/images/`. Running the fixed exporter against the **live store**
(`data/uploads/`) surfaced **one further pair that scan could not see** —
`4c6b43be…` / `3eb8232e…`, both un-annotated uploads that had therefore never
been exported with labels.

Independently confirmed three ways: `md5 -r` grouping shows **8 unique images
across 14 files**, `cmp` confirms a sample pair is byte-identical, and the
exporter's own dry run skips exactly 6.

Option (b) (exporter dedup) was chosen over option (a) (delete redundant
store projects) deliberately: it is **non-destructive** — no user data is
deleted — and it prevents recurrence on every future re-upload rather than
cleaning up once.

### Why training did not run

Running v1.1 today would be **theater, not progress**. The corpus has not
changed: same images, same labels, same config, fixed seed ⇒ a v1.1 that
reproduces v1.0.0 to within noise. It would consume the one clean baseline
comparison Phase 7 depends on and produce no new information.

The genuine blocker is **human annotation work**, which cannot be automated
here: new P0-class examples (`select`, `radio_button`, `carousel` drawn so the
distinguishing mark matters), first-ever evaluable `card` / `page` coverage,
and genuine hard negatives (off-page notes, arrows, measurements — the corpus
contains none). This is stated plainly in `model-decision.md` §5 rather than
worked around.

### Tests

| Command | Result | Delta from Phase 5 |
|---|---|---|
| `npm run test` (Vitest) | 62 unique passing (124 reported, known dist duplication) | unchanged |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean | unchanged |
| `npm run build` | success (96 modules, Vite 685 ms) | unchanged |

No new automated tests: the exporter is a build-time CLI in the `scripts`
workspace, which has no test harness (same precedent as Phase 5's
`dataset-quality-report.ts`). Correctness was established by cross-checking
the dedup output against two independent methods (`md5 -r` grouping and
`cmp`), which is stronger evidence for this specific change than a unit test
over a mocked filesystem would be.

### Verification that nothing was mutated

`git status` after all work shows only `scripts/src/export-yolo-dataset.ts`,
`docs/ml/model-decision.md`, `docs/ml/dataset-quality-v1.1.md` and this log —
**zero changes under `ml/dataset/`, `ml/models/`, or `apps/api/data/`.** Every
exporter invocation used `--dry-run`.

### Known limitations / open decisions

1. **The dedup fix is in place but not applied to the on-disk corpus.**
   Applying it needs a real (non-dry-run) `npm run export:dataset`, which
   rewrites `ml/dataset/` — a data operation deliberately left to whoever runs
   the next training refresh rather than performed unilaterally here.
2. **The 4 empty-label files are still unresolved** — distinguishing a
   deliberate background negative from an un-annotated upload requires looking
   at the images, which is a human judgement call.
3. **`train_v1.py`'s `--model` default is unchanged** (`yolov8n.pt`), per the
   decision. The v5 arm is opt-in via the existing flag; no training-script
   change was needed to enable the recommended experiment.
4. **The YOLOv5n arm has not been run**, so its real accuracy on this task is
   unmeasured — the parameter counts above are architectural facts, not
   performance claims.

### Next phase

**Phase 6 proper (train v1.1) is blocked on human data collection**, not on
tooling — both of its documented preconditions that *could* be automated are
now met. The realistic options are:

- **(a)** Collect/annotate new sketches per `dataset-quality-v1.1.md` §9, then
  run the two-arm experiment in `model-decision.md` §6.
- **(b)** Skip ahead to a phase that is not data-blocked — **Phase 8
  (PostgreSQL + Prisma)** is the highest-value unblocked item, and Phase 0's
  baseline already flags the JSON store as a real scalability/consistency
  risk. Phases 9-10 (durable jobs, auth) are similarly unblocked.

Recommend **(b)** to keep momentum, returning to Phase 6 when labeled data
exists.

---

## Phase 8 (part 1) — Prisma Schema, Migration SQL, and JSON→Postgres Importer

**Date:** 2026-08-24
**Goal:** Begin the PostgreSQL + Prisma migration (plan §8, Appendix E):
schema from the real domain models, migration SQL, and the JSON→Postgres
import tool with parity/validation.
**Status:** ✅ Part 1 complete (schema + SQL + importer, all verified).
⛔ **Part 2 (runtime switchover) is BLOCKED on a decision — see the
discrepancy below.**

### ⚠ Discrepancy: the plan's central Phase 8 premise does not hold

The plan states, as its *critical rule* for this phase:

> **8.1 Critical rule** — "Do not rewrite route behavior. The current JSON
> store deliberately exposes module-level functions so it can be swapped.
> Use that abstraction."

`jsonStore.ts`'s own header comment makes the same claim: *"Swap for
Prisma/Postgres in Phase 2+ without touching module/route code, since routes
only depend on the exported functions below."*

**Measured against the actual source, that is not true.** The store exports
`db.state` — a synchronous, in-memory, **mutable object graph** — and routes
reach directly into it:

```ts
const project = db.state.projects.find((p) => p.id === req.params.id);
project.styleOverrides[detection.id] = cleaned;   // in-place mutation
db.save();                                        // rewrite whole file
```

Counted across `apps/api/src`:

| Measurement | Count |
|---|---:|
| Direct `db.state` accesses | **92** |
| Files touching `db.state` | **19** |
| `db.save()` call sites | **32** |
| `async` route handlers | **2** |

Prisma's API is **asynchronous** — every query returns a Promise. There is no
way to serve `db.state.projects.find(...)` from Postgres synchronously.
Therefore the "swap the implementation, leave routes untouched" path the plan
describes **cannot be executed as written**. The comment in `jsonStore.ts`
describes an intent the code never actually honoured: routes depend on the
mutable state object, not on functions.

Per operating Rule 7 and Rule 12 ("if the repository differs from the plan,
stop and reconcile before implementing dependent phases"), this is reported
rather than worked around, and Part 2 is deliberately **not** started.

Alternatives considered and rejected:

- **Write-behind cache** (load all rows into memory at boot, mutate
  synchronously, flush to Postgres in the background). Preserves route code,
  but throws away transactional consistency and concurrent-write safety —
  precisely the two properties §8.3/§8.4 want Postgres *for* — while adding a
  network hop. Strictly worse than the JSON store it replaces.
- **A synchronous Postgres driver.** No mainstream Node driver is
  synchronous; the exotic worker-thread + `Atomics.wait` approaches are
  fragile and would be a far larger risk than the async conversion itself.

**Conclusion: the async conversion of all 19 files is unavoidable.** It should
be done incrementally (repository interface first, then one module at a time,
parity-tested per module) rather than as one large rewrite — but it *is* a
rewrite of route plumbing, and the plan should be updated to say so.

### Files added

- `apps/api/prisma/schema.prisma` — 13 models, 12 enums, derived from the
  real `packages/shared-types` definitions
- `apps/api/prisma/migrations/20260824000000_init/migration.sql` — 396 lines
  of generated DDL
- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/src/db/migrate-json-to-postgres.ts` — the importer, with a
  database-free `--dry-run` validator

### Files changed

- `apps/api/package.json` — `prisma` + `@prisma/client` (both v5.22), plus
  `db:generate` / `db:migrate` / `db:migrate-json` scripts
- `package-lock.json`

### Schema design decisions

Three judgement calls, each documented at its definition in the schema:

1. **The four inspector override maps are NORMALIZED into their own tables.**
   In JSON they are `Record<detectionId, X>` maps on `Project`. The plan's
   §8.4 explicitly requires preventing *"override → missing detection"* — as
   map keys that is unenforceable; as rows with a foreign key it is a database
   guarantee, and deleting a detection now cleans up its overrides instead of
   leaving the orphaned keys the JSON store accumulates today.
   `StructureOverride.parentDetectionId` additionally gets a self-referencing
   FK to `Detection`, turning `validateStructureOverride`'s "parent must
   exist" app-level check into a structural one.
2. **`bbox` is FLATTENED into four `Float` columns** rather than kept as JSON.
   These are the most-queried values in the system (boundary filtering,
   layout containment, crop generation) and flat columns can carry real CHECK
   constraints on the normalized `[0,1]` invariant. JSON would preclude both.
3. **Genuinely opaque payloads stay `Json`** — `TrainingSample.boxes`,
   `Job.pageBoundary`, `PageBoundaryRecord.polygon`, `CodeVersion.metadata`,
   `StyleOverride.style`. Each is written and read as a whole and never
   queried per-field. `boxes` in particular is an immutable human-signed-off
   snapshot; normalizing it would invite exactly the per-row edits the
   snapshot exists to prevent.

Two smaller ones worth noting:

- **`null` vs `undefined` for parent ids.** `parentDetectionId: null` means
  "root" while an absent field means "keep auto-inferred" — a distinction one
  nullable Postgres column cannot express. Companion `*Set` booleans carry it.
- **`Project.activeCodeVersionId` is a plain indexed column, not a relation.**
  `CodeVersion` already points at `Project`; adding the reverse relation
  creates a cycle requiring one side to exist before the other can reference
  it. Matches how the JSON store treats it.

Constraints the JSON store never enforced and the schema now does:
`@@unique([projectId, versionNumber])` on code versions and exports,
`@@unique([assetId])` on page boundaries and training samples, and
`@@unique([detectionId])` on each override table.

### Tests

| Command | Result | Delta |
|---|---|---|
| `npm run test` (Vitest) | 62 unique passing (124 reported, known dist duplication) | unchanged |
| `npm run test:py` (Pytest) | 19 passed / 0 failed | unchanged |
| `npm run typecheck` | clean | unchanged |
| `npm run build` | success (96 modules, Vite 668 ms) | unchanged |

### Verification — what was actually proven, without a database

The Postgres instance on this machine belongs to an unrelated project
(`good_morning_db`), the `sketch2ui` role does not exist, and **Docker is not
installed**, so `docker-compose.yml` cannot be used here. No database was
touched. Everything below was verified offline instead:

| Check | Method | Result |
|---|---|---|
| Schema is valid | `prisma validate` | ✅ "The schema … is valid" |
| Schema produces real DDL | `prisma migrate diff --from-empty --script` | ✅ 13 tables, 12 enums, 27 indexes, **23 foreign keys** |
| Client generates | `prisma generate` | ✅ all 13 models present on the client |
| **Schema fits the real data** | importer `--dry-run` against the live `store.json` | ✅ **445 rows** mapped (15 projects, 14 assets, 393 detections, 7 code versions, 12 jobs, 2 samples, 2 exports); **referential integrity OK** |
| **The validator actually detects problems** | injected 4 corruption classes into a scratch copy | ✅ caught all 4 |

That last row matters more than the one above it: a pre-flight check that has
only ever returned "OK" is not evidence of anything. Four deliberate
corruptions were injected into a throwaway copy — a dangling
`sourceAssetId`, a `bbox` with a `null` field, a duplicate
`(projectId, versionNumber)`, and a stale override key naming a nonexistent
detection — and each was reported with the correct classification. The real
store was never modified (re-confirmed afterwards: still 15/393/7).

### Database changes

None applied. The migration SQL exists and is committed but **has not been run
against any database.**

### API / frontend / ML changes

None. No route, service, or component was modified — deliberately, given the
discrepancy above.

### Known limitations / open decisions

1. **The runtime still uses the JSON store.** Nothing is wired to Prisma yet.
2. **Nothing has been executed against Postgres** — no `migrate deploy`, no
   import. The schema is validated and the DDL generated, but "generates valid
   SQL" is weaker evidence than "applied cleanly to a real database", and that
   distinction is deliberately not blurred here.
3. **Docker unavailable; local Postgres is not ours.** Running this needs
   either Docker, or a `sketch2ui` role + database created in the existing
   local instance — the latter modifies a shared server hosting someone else's
   data, so it needs explicit authorization rather than being assumed.
4. **No parity tests yet** (Appendix E stage 6). They are only meaningful once
   a repository layer exists to run both backends behind.
5. **`prisma migrate deploy` will require `DATABASE_URL`** to point at a
   reachable database; `.env` currently names `sketch2ui:sketch2ui@localhost:5432/sketch2ui`,
   which does not yet exist.

### Next phase

**Phase 8 part 2 needs a decision before it can start**, because it
contradicts the plan's own critical rule:

- **(a) Proceed with the async conversion** — introduce a repository
  interface, then migrate the 19 files module-by-module with parity tests at
  each step. This is the only route to real Postgres, but it *is* the "rewrite
  route behavior" the plan forbids, so the plan needs amending first.
- **(b) Pause Phase 8** and move to **Phase 9 (durable jobs)** or **Phase 10
  (auth)**. Note that Phase 9 has the *same* async property, and Phase 10 adds
  ownership columns that would be cheaper to land in the same schema pass —
  so ordering matters.
- **(c) Land the schema as documentation only** and revisit when a real
  Postgres instance is available.

To actually run the migration here, one of these is also needed: install
Docker, or authorize creating a `sketch2ui` role/database in the existing
local Postgres server.




---

## Phase 8 (part 2) — Repository Boundary + Projects Domain Migrated

**Date:** 2026-08-24
**Goal:** Formally amend the Phase 8 architecture, introduce the repository/service
boundary the plan assumed already existed, and migrate the first domain end-to-end.
**Status:** ✅ Complete for this increment. 1 of 13 domains migrated, with the
architecture and parity harness in place for the remaining 12.

### Architecture amendment

Full document: [phase-8-architecture-amendment.md](phase-8-architecture-amendment.md).

> Phase 8 changes from "swap persistence implementation without route changes" to
> "introduce a real repository/service boundary, then convert persistence callers
> module-by-module while preserving route contracts and user-visible behavior."

The plan's §8.1 critical rule assumed `jsonStore.ts` exposed a swappable functional
abstraction. It does not — it exposes `db.state`, a synchronous mutable object graph
that 19 files reach into directly (100 occurrences over 92 lines, 32 `db.save()`
calls, 2 async handlers in the whole API). Prisma has no synchronous API, so the
substitution the plan describes is impossible. Write-behind caching and synchronous
DB wrappers were both considered and rejected in the amendment (§4, §5) — the first
discards exactly the transactional guarantees Phase 8 exists to provide; the second
is unsafe or destroys throughput.

**Six route families were found to depend on hidden synchronous mutation** (amendment
§2.3) — including the detection model→manual flip, the most behaviour-critical
mutation in the app. These are enumerated because they fail *silently* under Prisma
(mutating a detached row persists nothing) rather than loudly.

### Files added

- `docs/execution/phase-8-architecture-amendment.md`
- `apps/api/src/repositories/types.ts` — 13 domain-shaped contracts
- `apps/api/src/repositories/index.ts` — factory + `PERSISTENCE_DRIVER` switch
- `apps/api/src/repositories/json/project.repository.ts`
- `apps/api/src/repositories/prisma/client.ts`, `prisma/project.repository.ts`
- `apps/api/src/repositories/__tests__/project.contract.test.ts` (+ `.prisma.test.ts`)
- `apps/api/src/middleware/asyncHandler.ts`
- `apps/api/vitest.config.ts`, `apps/api/vitest.setup.ts`
- `scripts/src/check-db-state-usage.ts`

### Files changed

- `apps/api/src/modules/projects/projects.routes.ts` — **migrated**
- `apps/api/src/config/env.ts` — `persistenceDriver`
- `apps/api/prisma/schema.prisma` — removed the custom generator `output` (see below)
- `apps/api/package.json`, `scripts/package.json`, `package.json`

### Files removed

None.

### Counts

| Metric | Before | After |
|---|---:|---:|
| `db.state` in unmigrated app modules (code only) | 82 | **78** |
| `db.save()` in unmigrated app modules (code only) | 29 | **26** |
| Migrated domains | 0 | **1** (Projects) |
| App modules importing `jsonStore` | 19 | **18** |
| Files importing `@prisma/client` | 1 | **3** (all inside `repositories/prisma/` + the importer) |

The earlier "92 / 32" figures were *line* counts; occurrences are 100 / 32. The table
above counts occurrences in application code with comments stripped and persistence
infrastructure excluded, which is what the CI guard enforces.

### Repository interfaces

`ProjectRepository`, `AssetRepository`, `DetectionRepository`, `BoundaryRepository`,
`CodeVersionRepository`, `Style/Content/Geometry/StructureOverrideRepository` (via a
shared `OverrideRepository<T>`), `JobRepository`, `TrainingRepository`,
`ExportRepository`, `CorrectionRepository`.

All async, all domain-shaped rather than generic CRUD — each method corresponds to an
operation the code actually performs (e.g. `clearModelDetections`,
`saveRespectingManual`, `resolveActive`). Behaviour that must not be lost is pinned to
the contract, not to a route: `DetectionRepository.update` owns the model→manual flip
so no future caller can bypass it.

### Implemented this increment

- JSON: `JsonProjectRepository`
- Prisma: `PrismaProjectRepository`
- Migrated: `modules/projects/projects.routes.ts`

### Tests

```
npm run test              packages/shared-types  6 files, 124 passed
                          apps/api               2 files, 44 passed | 1 skipped
npm run test:py           19 passed
npm run build             success (96 modules, Vite 655 ms)
npm run typecheck         clean
npm run check:db-state    OK
```

The 1 skip is the Prisma contract arm, which reports its reason rather than passing
vacuously. Both adapters run the **same** suite via `runProjectRepositoryContract`.

**Test data safety:** `db.reset()` writes to `env.storeFile`, which defaults to the
real store (15 projects / 393 detections). `vitest.setup.ts` redirects `STORE_FILE` to
a temp file **and asserts the redirect took effect**, refusing to run otherwise. Store
re-verified untouched after every run.

### Runtime verification (live API, JSON driver)

Route contracts on the migrated module — all pass: POST→201 with identical body shape,
GET→200, GET missing→404, PATCH partial (other fields preserved), PATCH missing→404,
POST without name→400, DELETE→204, DELETE again→404.

**Mixed-mode coexistence proven:** unmigrated modules (`/style-overrides`,
`/corrections`, `/code-versions`) all resolve a project created through the
repository — confirming both paths share one source of truth, which is what makes the
incremental migration safe.

**Core pipeline intact** on a real 86-detection project: codegen (7,036 bytes HTML),
version list, version activation + persistence, export (1.8 MB ZIP).

Smoke testing added 1 code version and 1 export to real data; both were reverted and
the store restored to exactly 15/393/7/2.

### Two real bugs found by running things

1. **Prisma client generated to the wrong location.** The custom `output` pointed at
   `apps/api/node_modules/.prisma/client`, but `@prisma/client` hoists to the workspace
   root and reads root `node_modules/.prisma/client` — a *stub*. Every query was typed
   `any`, surfacing as four implicit-any errors that looked unrelated to Prisma.
   Fixed at the root cause (removed the custom `output`) rather than by annotating
   around it; the structural `PrismaProjectRow` workaround was then deleted in favour
   of the real generated types.
2. **The CI guard false-positived on itself.** It matched `db.state` inside the
   migrated module's own comments explaining what it no longer does. Fixed by
   stripping comments before counting.

### Postgres live verification

**Not performed.** Docker is not installed, and the only running Postgres (14.19)
serves an unrelated `good_morning_db` with no `sketch2ui` role. Per the instruction,
that instance was **not** touched — no roles created, no credentials altered, nothing
dropped.

Options, in the instruction's order of preference: (1) start a dedicated cluster via
`initdb` on a separate port/data directory owned by this project; (2) a separate
Postgres installation; (3) Docker if installed; (4) a remote dev database with
explicit authorization. Option 1 is the cheapest here and needs no new software —
but it creates a new long-running local service, so it is left for the user to
authorize.

### Known limitations

1. **12 of 13 domains still unmigrated** and still on `db.state`.
2. **The Prisma adapter has never executed against a database.** It typechecks and
   satisfies the contract by construction, but "compiles" is not "works" — the
   contract arm that would prove it is skipped.
3. **`PERSISTENCE_DRIVER=postgres` is not yet usable**: only Projects has a Prisma
   adapter, so the rest of the app would still read JSON, splitting the source of
   truth. It defaults to `json` for exactly this reason.
4. **One deliberate response-shape narrowing:** `GET /api/projects/:id` no longer
   returns the four override maps. Verified safe first — `apps/web` reads overrides
   only from their dedicated endpoints, and exactly one stored project carried any
   override key. They are separate tables in the Prisma schema and separate
   repositories in the contract.
5. **`failOrphanedJobs()` is still synchronous** in `server.ts`'s `app.listen`
   callback. It must handle a promise when `JobRepository` is migrated, or orphan
   reaping silently stops — flagged in the contract's doc comment.

### Next action

**Migrate the Assets domain** (`AssetRepository` + `assets.routes.ts`, 3 `db.state` /
1 `db.save()`) — the smallest remaining domain, which exercises the
project-guard-via-repository pattern that the other 11 domains all need, at minimal
risk.

Separately, and independently: authorize a dedicated local Postgres cluster so the
Prisma contract arm can stop being skipped.

---

## Phase 8 (part 3) — Live PostgreSQL: schema applied, data migrated, parity proven

**Date:** 2026-08-24
**Goal:** Remove the "never executed against a database" caveat from part 2.
**Status:** ✅ Complete. The Prisma adapter is now **proven**, not merely typechecked.

### Environment resolved

The user supplied credentials for their own local server. Findings:

- The server on :5432 is **PostgreSQL 17.6** (`/Library/PostgreSQL/17`, EDB installer).
  The earlier "14.19" was the *Homebrew client* first on PATH — two installs coexist.
- Password auth is required (`fe_sendauth: no password supplied`); superuser `postgres`
  authenticates successfully.
- Created a **dedicated role and two databases** — `sketch2ui` (dev) and
  `sketch2ui_test` (tests) — both owned by a non-superuser `sketch2ui` role.
  `good_morning_db` was **not touched**: no roles created in it, no credentials
  altered, nothing dropped.
- Measured the new role's blast radius rather than assuming isolation: it *can*
  connect to `good_morning_db` (Postgres grants `CONNECT` to `PUBLIC` by default) but
  has **zero** table privileges and **cannot create** anything there. The `PUBLIC`
  grant was deliberately left alone — revoking it would affect the other project too.

### Part 15 database safety review — verified live

| Check | Expected | Actual |
|---|---:|---|
| Tables | 13 | **13** ✅ |
| Enums | 12 | **12** ✅ |
| Indexes | 27 | **27 non-PK** (+13 PK = 40 total) ✅ |
| Foreign keys | 23 | **23** ✅ |
| Override FKs → detections | 4 groups | ✅ (`structure_overrides` twice: `detectionId` + `parentDetectionId`) |
| Version uniqueness | present | ✅ as a UNIQUE **index** (Prisma emits `@@unique` that way, not as a table constraint) |

Constraints were proven to **actually enforce**, not merely exist:

- duplicate `(projectId, versionNumber)` → `ERROR: duplicate key value violates unique
  constraint "code_versions_projectId_versionNumber_key"`
- `style_overrides` → nonexistent detection → `ERROR: violates foreign key constraint
  "style_overrides_detectionId_fkey"`

That second one is plan §8.4's requirement (*"prevent override → missing detection"*)
becoming a database guarantee rather than an application convention.

### Data migration executed

`npm run db:migrate-json` committed **445 rows** in one transaction — exactly the
dry-run's prediction:

```
projects=15  assets=14  detections=393  code_versions=7  jobs=12  training=2  exports=2
```

### Part 12 semantic parity — JSON vs PostgreSQL

| Dimension | JSON | PostgreSQL |
|---|---|---|
| Row counts | p=15 a=14 d=393 cv=7 j=12 | **identical** |
| Sample project | `85b9d6dd` "Car marketplace" status=generated active=`805c158c` | **identical** |
| bbox (6 dp) | `[0.013333, 0.007626, 0.976667, 0.986654]` | **identical** |
| Class histogram (top 5) | section=69 text=54 heading=48 image=43 button=27 | **identical** |
| status distribution | active=392 rejected=1 | **identical** |
| source distribution | manual=225 model=168 | **identical** |

### Prisma contract arm — no longer skipped

```
22 ProjectRepository contract — JSON adapter
22 ProjectRepository contract — Prisma adapter
Tests  44 passed (44)      # previously 44 passed | 1 skipped
```

Both adapters pass the **same** 22 assertions against real backends — including the
detached-read assertion, which is the one that would have caught a JSON adapter
handing out live references where Prisma cannot.

### Four real defects found by executing rather than reasoning

1. **Prisma Client does not auto-load `.env`** (only the CLI does). `migrate deploy`
   worked while the importer failed with "Environment variable not found:
   DATABASE_URL" from nominally the same config. Fixed by loading the root `.env` in
   the script.
2. **`.env` lives at the repo root but Prisma resolves it from cwd** (`apps/api`).
   Fixed with a gitignored symlink so there is one source of truth rather than a
   duplicate that drifts.
3. **4 of 7 code versions have no `source` field at all** — they predate the field,
   which arrived with hand-editing. Postgres rejects them as NOT NULL. The dry-run
   validator had missed this entire class (it checked referential integrity, geometry
   and uniqueness, but never required-field presence). Fixed on both sides: the
   validator now audits required fields across seven tables, and the importer
   backfills `source` as `"generated"` — **provably** correct, since before hand-editing
   existed generation was the only code path that could create a version.
4. **The contract tests would have destroyed the migrated database.**
   `project.deleteMany({})` cascades to every table; pointed at the dev database an
   ordinary `npm test` would have silently wiped all 445 rows. Fixed with a second
   isolation guard that rewrites `DATABASE_URL` to `<db>_test` and **refuses to run**
   if the result does not target a `*_test` database. Verified: dev DB still 15/393
   after a full test run, test DB left empty.

The contract suite was also restructured — the shared contract moved out of a
`*.test.ts` file, because importing it from the Prisma arm re-ran its side-effectful
JSON registration (44 JSON tests instead of 22).

### Verification

```
npm run typecheck        clean
npm run test             124 (shared-types) + 44 (apps/api, both adapters)
npm run test:py          19 passed
npm run build            success
npm run check:db-state   OK
```

**The JSON store remains the untouched source of truth: 15 / 393 / 7 / 2**, verified
before and after every operation. The importer is one-way and read-only on JSON.

### Known limitations

1. **12 of 13 domains still unmigrated** — unchanged from part 2. Only Projects has a
   Prisma adapter.
2. **`PERSISTENCE_DRIVER` still defaults to `json`** and must stay there: flipping it
   now would serve Projects from Postgres while 12 domains still read the JSON file,
   splitting the source of truth.
3. **Postgres now holds a point-in-time copy.** It will drift from JSON as the app
   continues writing to the file store. Re-importing later requires clearing it first
   (duplicate primary keys otherwise).
4. **Local dev credentials are weak** (`sketch2ui` / same password as the superuser).
   Acceptable for a local-only database; must not be reused anywhere reachable.

### Next action

**Migrate the Assets domain** — unchanged recommendation, now with a real database
behind the contract so each subsequent domain gets both adapters verified as it lands.

---

## Phase 8 (part 4) — Assets domain migrated

**Date:** 2026-08-24
**Goal:** Second domain through the repository boundary, with both adapters verified
against real backends.
**Status:** ✅ Complete. **2 of 13 domains migrated.**

### Files added

- `apps/api/src/repositories/json/asset.repository.ts`
- `apps/api/src/repositories/prisma/asset.repository.ts`
- `apps/api/src/repositories/__tests__/asset.contract.ts` (+ `.json.test.ts`, `.prisma.test.ts`)
- `apps/api/src/repositories/__tests__/prisma-available.ts` — shared reachability probe

### Files changed

- `apps/api/src/modules/assets/assets.routes.ts` — **migrated**
- `apps/api/src/repositories/index.ts` — `assets` wired into the factory
- `apps/api/src/repositories/__tests__/project.contract.prisma.test.ts` — uses the
  shared probe instead of its own inline copy
- `apps/api/vitest.config.ts` — `fileParallelism: false` (see below)
- `scripts/src/check-db-state-usage.ts` — Assets registered, baselines re-ratcheted

### Counts

| Metric | Part 3 | Now |
|---|---:|---:|
| Migrated domains | 1 | **2** |
| `db.state` in unmigrated app code | 78 | **75** |
| `db.save()` in unmigrated app code | 26 | **25** |

### Contract preserved — including the easy-to-miss part

`GET /api/projects/:id/assets` deliberately does **not** 404 on an unknown project;
the original filtered an array and returned `[]`. That is pinned by a contract test
and re-verified live, because "add the project guard for consistency" is exactly the
sort of tidy-up that would silently break a client.

Ordering is also contractual: `listByProject` returns insertion order, since
`exports.routes.ts` takes the last asset as a project's source sketch. The Prisma
adapter reproduces it with `orderBy createdAt asc`. Documented parity edge: two assets
created in the same millisecond have undefined relative order in Postgres, so `id` is
a tiebreaker for determinism — noted rather than claimed to be bit-identical.

### A real bug the second suite exposed

Adding a second database-backed suite immediately broke both: **12 failures,
`Foreign key constraint violated: project_assets_projectId_fkey`.**

Cause was test-harness interference, not adapter code. Vitest runs test *files* in
parallel by default; both Prisma arms share one test database and each calls
`project.deleteMany({})` (which cascades) in `beforeEach`. The Project suite's reset
was deleting the parent project the Asset suite was mid-way through using.

Fixed with `fileParallelism: false` — a shared external resource cannot be safely
parallelised without per-worker isolation. The principled alternative (a schema per
worker) is noted in the config as worth doing only if wall-clock time ever matters;
the whole run is currently under a second.

Symptom worth remembering: the arms reported *asymmetric* test counts (15 vs 21, 22 vs
27) before the fix. Identical suites producing different counts is itself the tell.

### Tests

```
Project contract   22 JSON + 22 Prisma
Asset contract     15 JSON + 15 Prisma
apps/api           74 passed (4 files)
shared-types       124 passed
pytest             19 passed
typecheck/build    clean
check:db-state     OK (2 migrated, 75/25 remaining)
```

### Runtime verification (live API)

- `GET` empty → `200 []`; `GET` for an unknown project → `200 []`, **not** 404 ✅
- `POST` real 1023×1537 PNG → `201`, dimensions decoded, mime correct ✅
- no file → `400`; unknown project → `404` ✅
- unmigrated `/page-boundary` resolves a repository-created asset ✅ (mixed mode intact)
- `DELETE` project cascaded away both the row **and** the uploaded file — smoke test
  left zero residue, verified by diffing against a pre-test snapshot

JSON store and dev Postgres both unchanged throughout (15 / 14 / 393).

### Next action

**Migrate the Detections domain** — the highest-risk remaining one. Its repository must
own the model→manual flip, `originalClassName` capture and `clearModelDetections`
idempotency, all of which are currently route-level logic that a future caller could
bypass.

---

## Phase 8 (part 5) — Detections domain migrated

**Date:** 2026-08-25
**Goal:** Migrate the highest-risk remaining domain: Detection persistence, including
the model→manual flip, `originalClassName` capture, and `clearModelDetections`
idempotency — currently route-level logic a future caller could bypass.
**Status:** ✅ Complete.

### What moved into the repository

The correction rule that used to live in `detections.routes.ts`'s PATCH handler now
lives entirely in `DetectionRepository.update()`: when a `model`-sourced detection's
class or bbox actually changes, the implementation flips `source` to `"manual"`, pins
`confidence` to `1`, and records `originalClassName` the first time the class changes
(guarded so a second correction can't overwrite what the model originally said). The
Prisma adapter wraps this in a transaction — read-decide-write has to be atomic under
real concurrency in a way the JSON adapter gets for free from Node being
single-threaded.

`clearModelDetections` (§27.5 idempotency) and the interface itself changed shape:
`listByAsset` → `listActiveByAsset` (matches what every real caller needed),
`findInProject(projectId, id)` added alongside the existing unscoped `findById` (only
legitimate for exports, which genuinely only have an id), and `update`/`delete` now
take `projectId` first and `update` returns `{ detection, previous, classChanged,
bboxChanged }` instead of just the row — the route needs `previous` for correction-
history records and can no longer disagree with the repository about what changed.

### Files changed

- `apps/api/src/repositories/types.ts` — `DetectionRepository` extended
- `apps/api/src/repositories/json/detection.repository.ts`,
  `apps/api/src/repositories/prisma/detection.repository.ts` — new
- `apps/api/src/repositories/__tests__/detection.contract.ts` (+ json/prisma runners)
- `apps/api/src/modules/detections/detections.routes.ts` — migrated; `detections.service.ts` deleted (was a pure passthrough once persistence moved out)
- `apps/api/src/modules/detections/detect.job.ts` — `clearModelDetections`/`createMany` now go through the repository
- Eight other call sites that read detections directly, none of them in the detections module — `crops.routes.ts`, `codegen.routes.ts`, `exports.routes.ts`, all four override routes, `training.routes.ts` — migrated too, since leaving them on `db.state` would have meant they silently returned nothing the moment Postgres cutover happened

### A bug caught before it shipped

`repositories/index.ts`'s `build()` had been scaffolded with the Detection imports
present but never wired into either the JSON or Postgres branch — `MigratedRepositories`
declared `detections` as required but nothing constructed it. This would not have
compiled; caught immediately by `npm run typecheck` at the start of this phase.

### Tests

```
detection.contract   38 JSON + 38 Prisma
apps/api             150 passed (6 files)
typecheck/build       clean
check:db-state        OK (baseline ratcheted 75/25 → 53/22; detections.routes.ts
                       added to the zero-tolerance MIGRATED_MODULES list — the third
                       module, after projects and assets, to reach true zero db.state)
```

### Runtime verification (live API, isolated JSON store)

- PATCH a model detection's class → `source` flips to `manual`, `originalClassName`
  captures the pre-correction class, confidence pins to 1 ✅
- Second correction does **not** overwrite `originalClassName` ✅
- POST manual detection, DELETE it, code-generation, style-override PUT, crop.png
  (404 reason correctly shows "source image missing", not "detection not found" —
  proves `findInProject` succeeded before the crop-specific failure) ✅
- Training approve-training correctly reads via `listActiveByAsset` ✅

### Next action

**Boundary repository** — page-boundary persistence, owning the sticky-correction rule
(a manual boundary must survive a later auto-detect).

---

## Phase 8 (parts 6–9) — Boundary, CodeVersion, the four Overrides, Training/Correction, Export, and Jobs migrated

**Date:** 2026-08-25
**Goal:** Migrate every remaining P0 persistence domain in the plan's specified order
(Boundary → CodeVersion → Style → Content → Geometry → Structure → Correction/Training
→ Export → Jobs), completing the repository layer for the whole application.
**Status:** ✅ Complete — all nine domains now behind the repository layer.

Consolidated into one entry since the pattern was identical for each: inspect current
source → write the JSON adapter → write the Prisma adapter → write a shared contract
test run against both → migrate every caller off `db.state` → typecheck/test/build/
db-state guard → a live HTTP smoke test proving the domain's one behaviour-critical
invariant end to end. Per-domain specifics worth recording:

- **Boundary** (`BoundaryRepository`) — `saveRespectingManual` is one domain operation,
  not read-then-write: an `auto` write against an asset with an existing `manual`
  record is refused and the pre-existing manual record returned instead. Prisma adapter
  wraps it in a transaction for the same race-window reason as Detection's `update`.
  `boundaries.service.ts` trimmed to just the pure `toPageBoundary` projection helper.

- **CodeVersion** (`CodeVersionRepository`) — immutability is structural, not just
  convention: the interface has no update/delete method for a version, so a
  mutate-in-place bug is impossible to write, not merely discouraged. `create()` computes
  `versionNumber` internally inside a transaction (Prisma) so concurrent saves can't
  collide; `resolveActive()` returns the pinned version if set and still present, else
  latest. `resolveActiveVersion` in `code-versions.routes.ts` became `async` as a
  consequence — traced every caller; caught and fixed a bug the signature change would
  otherwise have introduced silently (`latestCodeRouter`'s 404 branch, and
  `exports.routes.ts`'s version resolution, were both missing the new `await` and would
  have treated a pending Promise as always-truthy).

- **Four override groups** (`Style`/`Content`/`Geometry`/`StructureOverrideRepository`,
  one shared `OverrideRepository<T>` contract) — each domain has its own "empty means
  delete" rule (Style/Geometry: empty object; Content: no text/altText/href regardless
  of `contentState`; Structure: neither field touched). Structure's `parentDetectionId`
  is genuinely three-state (a detection id / explicit root `null` / "not touched"
  `undefined`) — the Prisma schema already had a `parentDetectionIdSet` boolean
  side-channel for exactly this, since a nullable Postgres column alone can't represent
  three states. Also fixed `codegen.routes.ts` to read all four override maps through
  the new repositories instead of the raw project row — without this, codegen would
  have silently generated override-less code the moment Postgres cutover happened,
  since override data lives in Postgres now, not the JSON file.

- **Training/Correction** (`TrainingRepository`, `CorrectionRepository`) —
  `upsertApproval` does a transactional delete-then-create, not a Prisma `upsert`: an
  `upsert`'s update path would keep the *existing* row's id, but the caller mints a
  fresh id per approval and the JSON adapter genuinely replaces the row — an `upsert`
  would have been a real, silent adapter-parity bug. `CorrectionRepository` doubles the
  three-state parent-id trick (old *and* new sides each need their own `*Set` boolean).
  `corrections.service.ts` deleted (pure passthrough).

- **Export** (`ExportRepository`) — `nextVersionNumber()` and `create()` are
  deliberately two calls, not one transaction: the caller needs the number to compute
  the ZIP's file path *before* streaming it to disk (seconds of I/O), and a transaction
  can't reasonably span that. The pre-existing race window this leaves is unchanged;
  Prisma's `@@unique([projectId, versionNumber])` at least turns a collision into a
  loud error instead of a silently overwritten file, which JSON could not do.

- **Jobs** (`JobRepository`) — the last domain. `failOrphaned` is a single atomic
  Postgres `updateMany`, vs. a read-then-loop on JSON. All nine call sites in
  `detect.job.ts` that mark job state needed `await` added once the service functions
  became async; `server.ts`'s startup orphan-reaping (inside `app.listen`'s callback,
  which cannot itself be `async`) converted to a handled promise so a rejection can't
  silently stop orphan-reaping. Contract test caught a real bug in its own first draft:
  a fake `sourceAssetId` that doesn't correspond to a real asset row passed silently
  under JSON but failed the FK constraint under Postgres — fixed by seeding a real
  asset in the test setup, exactly the kind of parity gap contract tests exist to catch.

**Bonus cleanup, same pass:** the last four stray `db.state` reads anywhere in the
application (`boundaries.routes.ts`, `crops.routes.ts`, `codegen.routes.ts`) were
swapped for the already-migrated Project/Asset repositories, bringing the direct-store-
access count to genuine, permanent **zero** across all 20 application modules.

### Counts

| Metric | End of part 4 | End of part 9 |
|---|---:|---:|
| Migrated domains | 2 | **9 (all)** |
| `db.state` in application code | 75 | **0** |
| `db.save()` in application code | 25 | **0** |
| Zero-tolerance `MIGRATED_MODULES` | 2 | **20 (all application modules)** |

### Tests

```
apps/api               386 passed (26 files) — includes ~280 contract-test assertions
                        run identically against JSON and a real Postgres test database
shared-types            124 passed
typecheck/build          clean
check:db-state           OK (0 db.state, 0 db.save — permanent regression floor)
```

### Runtime verification (live HTTP smoke tests, one per domain, isolated JSON stores)

Boundary sticky-correction rule, CodeVersion immutability (activate an old version,
confirm the newer one is untouched, export follows the reactivated version — verified
by downloading and unzipping the actual export and grep-checking for override content),
all four overrides folding correctly into generated HTML/CSS (verified visually: a
structure override actually nested one element inside another in the output; a style
override's `display: flex` landed on the right selector in the CSS), training
re-approval superseding with a fresh id, correction history rendering chronologically,
export ZIP round-tripped through a real unzip. Full detail in the phase-8 development
session — not reproduced here to keep this entry a reasonable length.

### Next action

**PostgreSQL cutover** — flip `PERSISTENCE_DRIVER=postgres` for the real dev runtime
and run the full regression checklist against it, per the plan's §21/§22 gate and
procedure. All nine checklist preconditions are now met.

---

## Phase 8 (part 10) — PostgreSQL cutover

**Date:** 2026-08-25
**Goal:** Execute the plan's §22 cutover procedure: switch the real dev API from the
JSON store to PostgreSQL and prove nothing regressed.
**Status:** ✅ Complete.

### Pre-cutover verification (plan §22 steps 1–3)

Dev database `sketch2ui` and test database `sketch2ui_test` confirmed as separate
databases on the same local Postgres server, with `vitest.setup.ts`'s existing guards
preventing the test suite from ever touching dev data. Row counts compared directly
between the JSON store and Postgres across all 13 tables **before** touching anything:
they already matched exactly (15 projects, 14 assets, 393 detections, 7 code versions,
12 jobs, 2 training samples, 2 exports, 0 boundaries/corrections/overrides) — the
one-way JSON→Postgres importer had already been run comprehensively in an earlier
phase and kept in sync, which significantly de-risked the cutover.

### A real, pre-existing gap found and fixed along the way

`apps/api/.env` (a symlink to the repo-root `.env`) was **never actually being loaded**
— `apps/api/package.json`'s `dev`/`start` scripts never invoked `dotenv` or Node's
`--env-file` flag, confirmed empirically (`process.env.DATABASE_URL` was `undefined`
under a bare `npm run dev`). This meant `PERSISTENCE_DRIVER=postgres` in `.env` would
have had **zero effect** on the real dev server. Fixed by adding Node's native
`--env-file=.env` (Node 20.6+, project baseline is 20.17.0 — no new dependency) to both
scripts. This surfaced a second, more serious latent bug: `.env`'s `STORE_FILE`/
`DATA_DIR`/`UPLOADS_DIR` used relative paths (`./apps/api/data/store.json` etc.) that
only resolve correctly if the process's cwd happens to be the repo root — but
`npm run dev -w apps/api` sets cwd to `apps/api/`, so enabling `.env` loading would have
silently redirected file storage to an **empty** directory (`apps/api/data/uploads`)
instead of the real one holding the 14 actual uploaded files (`<repo-root>/data/uploads`).
Fixed by removing those three lines from `.env` entirely, letting `env.ts`'s existing
absolute-path (cwd-independent) defaults take over — never triggered before because
`.env` was never loaded, so this was tested and confirmed working before real traffic
ever depended on it.

### Cutover

`.env`: `PERSISTENCE_DRIVER=postgres` set. Real dev server started via
`npm run dev -w apps/api`, hitting the actual `sketch2ui` Postgres database.

### Full 15-step regression checklist — run live against real Postgres, with the real CV worker

Project create → real image upload (reused an existing uploaded sketch) → manual box
→ manual page boundary → **real auto-detection** (actual CV worker inference, 11
detections found; correctly preserved the manual page boundary from the previous step
— sticky-correction rule held under real conditions) → manual correction (renamed a
class) → UI tree (12 detections, correctly mixed manual+model) → HTML/CSS generation →
live preview → hand-edited code version (v4, `source: "edited"`) → style/content/
geometry/structure overrides, regenerated and confirmed folded into the output →
version activation (activated an older version, confirmed the newer one's content was
unchanged, reactivated the latest) → export ZIP (downloaded, unzipped, confirmed the
override content and the reactivated version's content were both present, not the
intermediate reverted version).

### Verification (plan §22 steps 6–7)

Postgres counts increased exactly as expected across every table touched by the run
(projects 15→16, assets 14→15, detections 393→405, code_versions 7→10, exports 2→3,
jobs 12→13, all four override tables and page_boundaries 0→1 each). The JSON store
file's mtime was checked before and after the entire run and never changed — direct,
verifiable proof PostgreSQL is now the sole runtime persistence layer, not an assertion.

### Tests

```
typecheck/build    clean
apps/api           386 passed
shared-types       124 passed
check:db-state     OK (0/0)
```

### Next action

**Minimal E2E test** (plan §24) — one Playwright golden-path test with a mocked
detector, then a security review of the preview/upload paths (plan §33 P1 items).

---

## Phase 9 — Minimal E2E test and security review

**Date:** 2026-08-25
**Goal:** Add exactly one Playwright golden-path E2E test (plan §24), then a security
review of the preview/upload paths and this phase's own changes (plan §33 P1 items).
**Status:** ✅ Complete.

### E2E test

`e2e/golden-path.spec.ts`: create project → upload a deterministic fixture
(`e2e/fixtures/sketch.png`) → detect (against `e2e/mock-cv-worker.ts`, a deterministic
stand-in returning one fixed detection — real CV inference has its own coverage via
`services/cv-worker`'s pytest suite and the manual regression checklist) → correct the
detection's class via the Inspector → generate → verify the live-preview iframe →
export ZIP (verified as a real file download, not a synthetic click).

Selectors were derived directly from component source, not guessed — there are no
`data-testid` attributes anywhere in the web app (confirmed by an exhaustive grep), so
locators are built from placeholder text, button `title` attributes, element `id`s, and
one structural selector (the UI-tree panel's node list, scoped so the mock's single
detection is unambiguous). Orchestrated via `playwright.config.ts`'s multi-`webServer`
support: mock CV worker + API + web, each on a dedicated port, against a fresh
`fs.mkdtempSync` throwaway store per run — the suite never touches real dev data or
Postgres (`PERSISTENCE_DRIVER` is deliberately left unset, defaulting to JSON).

**Environment note:** this sandbox cannot resolve `cdn.playwright.dev` (Playwright's
own browser-download CDN) even though general internet access works — DNS for that one
host fails via Node's `getaddrinfo` while `nslookup` resolves it fine, suggesting a
sandbox-specific allowlist gap rather than a real outage. Worked around by pointing the
Chromium project at the already-installed system Chrome (`channel: "chrome"`) instead
of Playwright's managed browser binary. Transparent for local runs; flagged in-repo
(`playwright.config.ts`'s comment) since a CI runner will need either working access to
that CDN or Chrome pre-installed on the image.

Three consecutive clean runs, ~4–9s each including all three servers starting from cold.

### Security review

The `security-review` skill's git auto-detection assumes a remote-tracking
`origin/HEAD`, which does not exist in this local-only repo (no `origin` remote at
all), so the review was done manually — scoped to this session's persistence-migration
diff plus a direct, dedicated audit of the preview and upload paths the plan names
specifically (§33 P1 item 18).

**Checked and clean:** every unscoped repository `findById()` introduced by the
migration (a real IDOR risk given several are deliberately unscoped by design, e.g.
`Detection.findById`, `Export.findById`) — audited every call site; every route using a
raw user-supplied id correctly verifies `projectId` match before use, and the
deliberately-unscoped calls are all fed pre-resolved, already-scoped values. No raw SQL
anywhere in the new repositories (the only `$queryRaw` is a parameterless health-check
`SELECT 1`). Preview iframe's `sandbox=""` (empty — no scripts, no same-origin, no
forms) confirmed intact and unchanged. Content-override injection defenses (`<`/`>`
rejection, href scheme allowlist rejecting `javascript:`/`data:`) and the style-override
CSS property allowlist confirmed intact and unchanged. Upload path's magic-byte content
sniffing, size limit, and server-generated (non-user-controlled) storage keys confirmed
unchanged. No secrets found in a sweep of every file touched this session; `.env` is
correctly gitignored.

**One finding, fixed:** `e2e/mock-cv-worker.ts` listened on all network interfaces
instead of loopback-only, unlike the real worker (`services/cv-worker` explicitly binds
`host="127.0.0.1"` because "the worker must not be reachable from the public internet,
only through this API"). Low real-world impact (test-only, torn down immediately after
each run, no state to corrupt) but inconsistent with the project's own stated security
posture. Fixed: explicit `server.listen(PORT, "127.0.0.1", ...)`. Re-ran the E2E suite
after the fix to confirm nothing broke.

**Confirmed still true, not a regression:** no authentication anywhere in the API —
this remains an explicitly deferred P2 item per the plan, not an oversight introduced
by this work.

### Next action

Freeze a final-demo fixture (plan §28), then final report / demo prep (plan §37).

---

## Phase 10 — Frontend Design Tokens + Foundation (Design Phase 2A)

**Date:** 2026-08-25
**Goal:** Implement the design-token foundation and reusable primitive components
approved in `docs/frontend/design-tokens.md` and `docs/frontend/component-specification.md`
(the Phase 2 frontend redesign spec) — configuration and new, unwired components only.
Explicitly not a Dashboard/ProjectWorkspace redesign; no backend change.
**Status:** ✅ Complete.

### Files added

- `apps/web/src/components/cn.ts` — dependency-free class-name join helper
- `apps/web/src/components/Button.tsx`, `IconButton.tsx`, `Input.tsx` (+`Textarea`),
  `Select.tsx`, `Field.tsx`, `Tabs.tsx` (+`Tab`), `Badge.tsx`, `Tooltip.tsx`,
  `Panel.tsx`, `SectionHeader.tsx`, `StatusIndicator.tsx` — the primitive set
  prioritized by the Phase 2A brief, per `docs/frontend/component-specification.md`
- `apps/web/src/components/index.ts` — barrel export

### Files changed

- `apps/web/tailwind.config.js` — `theme.extend` populated with the full token set
  (colors, fontFamily, fontSize, spacing, borderRadius, boxShadow,
  transitionDuration, transitionTimingFunction) from `docs/frontend/design-tokens.md`.
  Additive only — no default Tailwind key removed, so every existing hand-written
  className string elsewhere in the app is unaffected.
- `apps/web/index.html` — added Google Fonts `<link>`s for IBM Plex Sans (400/500/600)
  and IBM Plex Mono (400/500/600).
- `apps/web/src/index.css` — added a `@layer base` block (token-driven body
  background/text color, a global `:focus-visible` ring, `::selection` color) and a
  `prefers-reduced-motion: reduce` block.
- `docs/frontend/frontend-implementation-roadmap.md` — Phase 2A section's Result
  subsection filled in with the detail also recorded here.

### Files removed

None.

### Preservation posture

- Zero files under `apps/web/src/pages/`, `apps/web/src/features/`,
  `apps/web/src/services/`, `apps/web/src/stores/`, or `apps/web/src/utils/` were
  touched — Dashboard, ProjectWorkspace, the canvas, the UI tree, the Inspector, the
  code editor, and the preview are all byte-for-byte unchanged.
- `AnnotationCanvas.tsx`/`PageBoundaryOverlay.tsx` still use their original hardcoded
  hex color literals — the new `detection-model`/`detection-manual`/`page-boundary`/
  `primary`/`selection` tokens exist in the Tailwind config for a later phase
  (design doc's Phase 2E) to consume, not wired in now.
- Detection UUID override keying, model→manual correction, Geometry/Structure/Style/
  Content override behavior, correction history, code generation, immutable
  `CodeVersion` behavior, the preview iframe's `sandbox=""`, export behavior, and
  page-boundary behavior — all untouched (no file in any of those paths was edited).
- No API/backend file touched.

### Design decisions

1. **Token application via `theme.extend`, not a wholesale theme replacement.** Every
   table in `design-tokens.md` was added as new or overridden-in-place Tailwind keys
   under `extend`, never by replacing `theme` outright — this is what lets an
   unmigrated component (all of them, in this phase) keep working on Tailwind's
   defaults while new components opt into the named tokens.
2. **`fontFamily.sans`/`.mono` override, not append.** Tailwind's `extend` merges by
   top-level key, so redefining `fontFamily.sans` replaces the default stack entirely.
   Because Tailwind's own preflight sets `html { font-family: theme('fontFamily.sans') }`,
   this one config change re-fonts the whole app without touching a single component
   file — verified live (see Manual verification).
3. **Global `:focus-visible` rule in `index.css`, not a per-component prop.** Applies a
   consistent `2px solid` primary-blue ring to every native focusable element
   site-wide with zero component edits; a component that already sets its own focus
   style (Dashboard's project-name input, pre-existing) keeps winning via Tailwind's
   `utilities` cascade layer outranking `base` — confirmed as expected behavior, not a
   bug, during manual verification.
4. **`Input`/`Select`'s `size` prop required `Omit<..., "size">`** against the native
   HTML attributes interface — the DOM's `size` is `number`, ours is `"sm" | "md"`.
   Caught by `tsc`, fixed before the first typecheck pass completed clean.
5. **No new dependency for class-name joining** (`cn.ts` is ~3 lines) or tooltip
   positioning (`Tooltip.tsx` is fixed centered placement, no collision/flip logic) —
   consistent with the brief's "do not introduce a new styling framework" and this
   phase's zero-risk mandate. Both are flagged as a deliberately minimal foundation,
   not a finished component, in `component-specification.md`'s cross-reference.

### Tests

| Command | Result | Delta from Phase 9 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean (after the `size`-prop fix) | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 96 modules, 681ms | unchanged module count (new components aren't imported anywhere yet, so Vite correctly excludes them from the bundle) |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts` | 1 passed | unchanged |
| `npx playwright test e2e/inspector-overrides.spec.ts` | 2 passed | unchanged |

### Manual verification

Ran `npm run dev:web` against a live project (real Postgres-backed API already
reachable in this environment) and inspected Dashboard, the Workspace toolbar/canvas/
UI-tree/Inspector, the Code tab (Monaco), and the Preview tab:

| Check | Result |
|---|---|
| Dashboard renders, project list loads, no console errors | ✓ |
| `<h1>` computed font-family | `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif` ✓ |
| `<h1>` computed size | `28px` — the new `text-2xl` token ✓ |
| `document.fonts` | 3 IBM Plex Sans weights report `loaded` ✓ |
| `body` computed background / text color | `rgb(244,245,247)` / `rgb(23,26,33)` — exactly `bg`/`text-primary` tokens ✓ |
| Keyboard focus on a project-row button → computed outline | `rgb(47,95,221) solid 2px` — exactly the `primary`/`focus` token, confirming the new global rule fires where no component overrides it ✓ |
| Dashboard's existing project-name input keeps its own pre-existing focus style | ✓ (expected — see Design decision 3, not a regression) |
| Open a project → canvas renders detection boxes (original colors, unchanged), UI tree, Inspector (Detection/Style sections) | ✓ |
| Code tab → Monaco loads, `vs-dark` theme (unchanged, Phase 2E/2H scope), own monospace font unaffected by the page-wide font change | ✓ |
| Preview tab → sandboxed iframe renders the generated page correctly | ✓ |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed. Net effect on the running app today: new
global background/text/focus tokens and IBM Plex Sans/Mono typography are live
everywhere via the base-layer CSS and Tailwind's preflight; a new, currently-unused
primitive component set exists under `apps/web/src/components/` ready for Phase 2B
onward to consume. No visible change to Dashboard's or ProjectWorkspace's layout,
copy, or behavior.

### ML changes

None.

### Known limitations / open decisions

1. This sandbox has no Docker/Postgres provisioning available, so the manual
   verification pass relied on whatever local Postgres the dev API was already
   connected to rather than a freshly provisioned instance. Not a gap in the
   phase's own evidence — both Playwright suites (the reproducible, isolated
   evidence) ran clean against throwaway JSON storage per `playwright.config.ts`.
2. Detection/canvas color tokens are defined but not yet applied inside
   `AnnotationCanvas.tsx`/`PageBoundaryOverlay.tsx` — deliberately deferred to the
   design spec's Phase 2E, not an oversight.
3. No visual-regression or component-test harness exists in this repo to snapshot
   the new primitives against (pre-existing gap, `PROJECT_STATUS.md` §2.6) —
   verified instead by typecheck, build, and the manual checks above.

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2B — App shell /
navigation** (new `AppHeader`/`BrandMark` mounted on both routes, plus inert
`ToastStack`/`DialogHost` scaffolding). Not started — stopping here per this phase's
explicit stop condition; awaiting confirmation before continuing.

---

## Phase 11 — App Shell / Navigation (Design Phase 2B)

**Date:** 2026-08-25
**Goal:** Implement `docs/frontend/frontend-implementation-roadmap.md`'s Phase 2B —
a shared `AppHeader`/`BrandMark` and app-root-level `ToastStack`/`DialogHost`
scaffolding, per `docs/frontend/component-specification.md`'s Dialog/Toast specs and
`docs/frontend/accessibility.md`'s dialog-focus contract. No Dashboard/ProjectWorkspace
redesign; no backend change.
**Status:** ✅ Complete, with one scoped deviation from the roadmap's original file
list — see Design decisions.

### Files added

- `apps/web/src/components/BrandMark.tsx`, `AppHeader.tsx` — built, not mounted (see
  Design decisions)
- `apps/web/src/components/Toast.tsx`, `ToastStack.tsx` — presentational shell +
  `ToastProvider`/`useToast()`
- `apps/web/src/components/Dialog.tsx`, `DialogHost.tsx` — presentational shell +
  `DialogProvider`/`useDialog().confirm()`

### Files changed

- `apps/web/src/App.tsx` — wrapped `<Routes>` in `<ToastProvider><DialogProvider>`
- `apps/web/src/components/index.ts` — barrel export updated
- `docs/frontend/frontend-implementation-roadmap.md` — Phase 2B Result section added

### Files removed

None.

### Preservation posture

Same as Phase 10: zero files under `apps/web/src/pages/`, `features/`, `services/`,
`stores/`, `utils/`, and zero API files touched. `App.tsx`'s only change is wrapping
existing `<Routes>` in two context providers that render no DOM node of their own when
inactive.

### Design decisions

1. **`AppHeader` built but not mounted — deviation from the Phase 2B file list in
   `frontend-implementation-roadmap.md`, which said "mounted on both routes."**
   Discovered while implementing: mounting it globally via `App.tsx` (the only route
   that doesn't require editing `Dashboard.tsx`/`ProjectWorkspace.tsx`, both still
   off-limits) has two real costs, not just a theoretical one — it would sit directly
   above Dashboard's own existing `<h1>Sketch2UI</h1>` (redundant branding), and it
   would push ProjectWorkspace's `h-screen`-rooted layout past 100vh, forcing a
   page-level scroll that doesn't exist today (a real regression against this phase's
   own "no existing page content moves or breaks" acceptance criterion). Both
   conflicts resolve naturally once the page that needs the header is being edited
   anyway — Phase 2C (Dashboard) and Phase 2D (Workspace shell) each already own that
   edit. Full writeup in the roadmap doc's Phase 2B Result section.
2. **Toast/Dialog use React Context + `createPortal`, no new dependency.** Consistent
   with Phase 2A's "no new styling framework" and general minimal-footprint approach —
   this is application state/behavior, not styling, but the same discipline applied:
   a small hand-rolled provider was sufficient for the actual requirement.
3. **`Dialog`'s focus trap is hand-rolled** (`querySelectorAll` for focusable
   descendants, manual Tab/Shift+Tab interception) rather than a focus-trap library —
   same reasoning as #2. Handles the standard case; not hardened against dynamically
   changing dialog content, since nothing in the app produces that yet.
4. **Destructive confirms default focus to Cancel and disable overlay-click-to-
   dismiss**, non-destructive confirms default focus to the primary action and allow
   overlay-click — directly implements `docs/frontend/accessibility.md`'s "safer
   default action" rule at the primitive level so no future call site has to
   re-derive it.

### Tests

| Command | Result | Delta from Phase 10 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged |
| `npm run build` (all 4 workspaces) | Success — Vite 103 modules (up from 96), 697ms | `App.tsx` now actually imports the new providers, so their dependency chain (Button, IconButton, Toast, Dialog, cn) is bundled for the first time |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged |

### Manual verification

Ran `npm run dev:web` against a live project:

| Check | Result |
|---|---|
| Dashboard renders byte-identical to Phase 10 (confirms the `AppHeader` deferral didn't leak in) | ✓ |
| No console errors on either route | ✓ |
| ProjectWorkspace toolbar/banners/canvas/tree/Inspector/version strip load real project data, no layout shift | ✓ |

`Toast`/`Dialog` have no call site yet — nothing in the app invokes
`useToast()`/`useDialog()` today — so their interactive behavior was verified by code
review against `accessibility.md`'s contract plus typecheck/build, not a live trigger.
They get their first real caller in Phase 2C (`ConfirmDialog` replacing
`Dashboard.tsx`'s `window.confirm()`) and later phases (toast replacing
`window.alert()` in `ProjectWorkspace.tsx`).

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above. Net effect on the running app today: identical to Phase 10 visually
and behaviorally — the two new providers are mounted but produce no visible output
until a later phase calls them.

### ML changes

None.

### Known limitations / open decisions

1. `AppHeader`/`BrandMark` are complete but unused pending Phase 2C/2D — see Design
   decision 1.
2. `Dialog`'s focus trap is not hardened against dynamically-changing dialog content
   (see Design decision 3) — not currently exercised, since no dialog in the app is
   dynamic.
3. No visual-regression harness exists in this repo (pre-existing gap,
   `PROJECT_STATUS.md` §2.6) — Toast/Dialog verified by code review + typecheck/build.

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2C — Dashboard**
(implement `dashboard-design.md` in full: `Field`/`Card`/`EmptyState`/`ErrorState`/
`ConfirmDialog`, restructure `Dashboard.tsx`, retire its `window.confirm()` in favor of
`useDialog()`, and this is also where `AppHeader` gets its first real mount). Not
started — awaiting confirmation before continuing.

---

## Phase 12 — Dashboard (Design Phase 2C)

**Date:** 2026-08-25
**Goal:** Implement `docs/frontend/dashboard-design.md` in full — restructure
`Dashboard.tsx` onto the token/primitive foundation from Phases 10–11, replace
`window.confirm()` with the Phase 11 `Dialog` system, mount `AppHeader` for the first
time. List/create/delete behavior must be identical to today.
**Status:** ✅ Complete.

### Files added

- `apps/web/src/components/Card.tsx` — bordered surface, optional `interactive`
  hover/focus-within lift (border-strong + shadow-subtle)
- `apps/web/src/components/EmptyState.tsx` — icon-agnostic empty-state layout
- `apps/web/src/components/ErrorState.tsx` — full-panel error block with `role="alert"`
  and an optional retry action

### Files changed

- `apps/web/src/pages/Dashboard.tsx` — full restructure (see Design decisions)
- `apps/web/src/components/index.ts` — barrel updated

### Files removed

None.

### Preservation posture

- `handleCreate`/`handleDelete`'s actual API calls (`api.createProject`,
  `api.deleteProject`, `api.listProjects`) are byte-identical to before this phase —
  only what wraps them (confirm mechanism, success/failure feedback, loading/empty/
  error rendering) changed.
- No file outside `apps/web/src/pages/Dashboard.tsx` and the three new components was
  touched. No API/backend file touched.

### Design decisions

1. **No `ConfirmDialog.tsx`.** `docs/frontend/frontend-implementation-roadmap.md`'s
   Phase 2C row listed one, but Phase 11's `DialogHost.tsx` already provides
   `useDialog().confirm()` — the identical shape (promise-returning, imperative,
   destructive-aware). Building a second wrapper around the same `Dialog` shell would
   have been the exact kind of duplication the brief's "search before creating"
   rule exists to prevent. `Dashboard.tsx` calls `useDialog().confirm()` directly,
   with the retired `window.confirm()`'s exact message text preserved verbatim in the
   `body` option.
2. **`AppHeader` mounted, Dashboard's old `<h1>Sketch2UI</h1>` retired in favor of
   `<h1>Projects</h1>`.** Keeping both would stack two adjacent "Sketch2UI" labels —
   `AppHeader`'s wordmark directly above a page heading that repeats the same word
   reads as an oversight, not a design. "Projects" names what this page actually
   contains, matching the header-logo-plus-content-heading pattern used elsewhere
   (e.g. a code host's own logo bar next to a "Repositories" title). Checked both
   `e2e/golden-path.spec.ts` and `e2e/inspector-overrides.spec.ts` before making this
   change — neither asserts on the Dashboard H1's text, only on the input placeholder
   and the "Create project" button's accessible name, both unchanged.
3. **List loading state is 3 flat skeleton rectangles**, not spinner text — matches
   `dashboard-design.md`'s "no shimmer, a static skeleton is enough signal" call.
4. **Delete outcome now shows a toast** (`useToast().showToast("success"/"error", …)`)
   instead of silently updating state or (on failure) leaving only inline text — the
   create-project failure path still uses inline error text per
   `dashboard-design.md`'s explicit spec ("replacing nothing structural"), so the two
   failure surfaces in this one page are deliberately different: create is a form
   validation-adjacent error shown at the form, delete is a transient outcome shown as
   a toast, matching each interaction's actual shape.
5. **Card's delete `IconButton` is `opacity-0` at rest**, shown via
   `hover:`/`focus-visible:opacity-100` (and forced visible while its own delete is
   in flight) — visible on hover for mouse users and on focus for keyboard users, per
   `dashboard-design.md`'s "visible on hover/focus, not always-on."

### Tests

| Command | Result | Delta from Phase 11 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 109 modules (up from 103), 737ms | +6 modules: Dashboard now actually imports Card/EmptyState/ErrorState/AppHeader/BrandMark and their dependency chain |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged |

### Manual verification

Ran `npm run dev:web` against the live project list and walked the actual delete flow
rather than only inspecting code:

| Check | Result |
|---|---|
| `AppHeader` renders (wordmark + "Sketch2UI") above the "Projects" H1 | ✓ |
| Create-form button: disabled/washed-out with empty input, solid `bg-primary` once text is entered | ✓ |
| Project card grid renders real data (name + status), hover reveals the delete icon | ✓ |
| Clicking the delete icon opens the dialog: title "Delete project?", body `Delete "Car marketplace"? This cannot be undone.` — compared character-for-character against the retired `window.confirm()` string | ✓ identical |
| `document.activeElement` on dialog open | `"Cancel"` — confirms the destructive-dialog safer-default-focus contract from `docs/frontend/accessibility.md` |
| `Escape` closes the dialog | ✓, focus returned to the trash-icon trigger |
| Project still present in the list after Cancel (not deleted) | ✓ |
| Console errors throughout | none |

Did not execute an actual delete against real project data in this manual pass (the
Cancel path already proves the dialog's full contract — open, focus, copy, dismiss,
focus-restore — without risking a real project); the delete *request* path itself is
exercised by the unchanged `handleDelete` function, which no line of this phase's diff
touches.

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed.

### ML changes

None.

### Known limitations / open decisions

1. `TrashIcon`/`SpinnerIcon` are small hand-written inline SVGs local to
   `Dashboard.tsx` — no icon library is installed yet (consistent with the "no new
   dependency" precedent set in Phases 10–11). `docs/frontend/design-direction.md`
   recommends Lucide for a later phase to replace these in place.
2. The always-hidden-until-hover delete affordance was not verified under touch/
   no-hover input — that is `docs/frontend/responsive-design.md`'s Phase 2J concern.
3. No visual-regression harness exists in this repo (pre-existing gap) — verified by
   typecheck/build/e2e/manual walkthrough, consistent with Phases 10–11.

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2D — Workspace
shell** (extract `WorkspaceToolbar` and the new consolidated `StatusBar` from
`ProjectWorkspace.tsx`; introduce the 4-region `WorkspaceBody` grid shell). Not
started — awaiting confirmation before continuing.

---

## Phase 13 — Workspace Shell (Design Phase 2D)

**Date:** 2026-08-25
**Goal:** Rebuild `ProjectWorkspace.tsx`'s shell on `docs/frontend/workspace-design.md`
— extract the toolbar, consolidate the four stacked banners into one fixed-height
status bar, and move from the old 3-column layout (canvas / tree+inspector sharing a
column / a fixed 480px right column) to the new 4-region layout (Layers / Canvas /
Inspector / bottom dock). Every existing detection/override/codegen/preview/export
behavior must survive untouched — this phase moves JSX, not logic.
**Status:** ✅ Complete.

### Files added

- `apps/web/src/features/workspace/WorkspaceToolbar.tsx`
- `apps/web/src/features/workspace/StatusBar.tsx` — `StatusBar` container +
  `DetectJobSegment`/`PageBoundarySegment`/`ActiveVersionSegment`/`ExportsPopover`
- `apps/web/src/features/workspace/WorkspaceBody.tsx` — the 4-region shell

### Files changed

- `apps/web/src/pages/ProjectWorkspace.tsx` — render section rebuilt; all state/
  effects/memos/handlers above `return` untouched (see Preservation posture)
- `apps/web/src/components/StatusIndicator.tsx` — added a `"boundary"` tone
- `e2e/golden-path.spec.ts` — "Save code version" → "Save version" (2 references)

### Files removed

None.

### Preservation posture

- Every `useState`/`useEffect`/`useMemo`/`useCallback` and every handler function
  (`handleCreate`, `handleUpdate`, `handleDeleteSelected`, `handleChangeClass`,
  `handleBoundaryChange`, `handleApproveTraining`, `handleExport`,
  `handleSaveVersion`, `handleSaveEdit`, `handleActivateVersion`,
  `handleApplyStyle`/`handleResetStyle` and the Content/Geometry/Structure
  equivalents) in `ProjectWorkspace.tsx` is byte-for-byte identical to before this
  phase — confirmed by diff. Only the JSX below the `if (!project) return …` guards
  changed.
- `AnnotationCanvas`, `ClassPicker`, `UITreePanel`, `InspectorPanel`, `PreviewPane`,
  `CodePanel` all receive the exact same props as before — none of those five files
  were opened for editing this phase.
- Detection UUID override keying, model→manual correction, the four override groups,
  correction history, code generation, immutable `CodeVersion` behavior, the preview
  iframe's `sandbox=""`, export behavior, and page-boundary sticky-correction — all
  untouched (no file in any of those paths was edited).
- No API/backend file touched.

### Design decisions

1. **"Empty regions at first" (the original roadmap wording) was not implemented
   literally.** Actually leaving the four content regions empty until Phases 2E–2H
   would have meant the canvas, tree, Inspector, and Preview/Code stopped rendering
   for the duration of this phase — a severe regression against this whole exercise's
   "absolutely preserve" mandate. Instead, every existing feature component moved into
   its new region, unchanged internally, in this same phase. 2E–2H now mean "restyle
   what's already there," not "add what's missing." Recorded as Deviation 1 in
   `docs/frontend/frontend-implementation-roadmap.md`'s Phase 2D result.
2. **The interactive version-switcher pill row moved directly to the bottom dock**
   (next to the Preview/Code tabs it controls), matching where
   `code-preview-design.md` already said it belongs, rather than parking it
   temporarily in the status bar and moving it again later. The status bar's
   `ActiveVersionSegment` is a new read-only summary chip alongside it.
3. **One, and only one, `window.alert()` → `showToast()` swap** — the version-activate
   click handler's inline `.catch()`, which this phase was already relocating. Every
   other `alert()` call site lives inside a handler function this phase did not open,
   so those stay exactly as they were; a full alert→toast migration is not yet
   scheduled to a specific roadmap phase and shouldn't be inferred as done here.
4. **`StatusBar`'s five segments live in one file, not five.** Each is small and has
   exactly one caller; splitting them into five files for its own sake would be
   fragmentation without benefit. `RejectedCountSegment` specifically was folded into
   `PageBoundarySegment` — a rejected-box count is meaningless without the boundary
   context it's reported alongside.
5. **Added a `"boundary"` tone to `StatusIndicator`** rather than reusing `"error"` or
   `"warning"` — page-boundary rose is its own distinct semantic color on the canvas
   (canvas-design.md), and conflating it with error/warning would blur a distinction
   the product already draws carefully elsewhere.

### Tests

| Command | Result | Delta from Phase 12 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean on the first pass | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 117 modules (up from 109), 811ms | +8 modules: the three new workspace-shell files plus their dependency chain |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged pass count — golden-path now exercises the renamed button and the fully rebuilt shell |

### Manual verification

Ran `npm run dev:web` against a real project ("Wild Card Digital," 73 approved boxes,
one saved code version, one export) at a genuine desktop width (1440×900 — the
Browser pane's default viewport is narrower and gives a misleading "canvas looks
starved" read for a shell that hasn't had its responsive pass yet; re-checked wide
before drawing any conclusion):

| Check | Result |
|---|---|
| Toolbar renders with correct tinted button colors (violet Detect, success Approve, info Export, primary Save) | ✓ |
| Status bar: single fixed-height row, `v1 · generated · active` + `Exports (1)` | ✓ |
| Layers (240px) / Canvas (flex, majority of width) / Inspector (320px) proportions | ✓ matches spec, canvas is no longer the starved panel |
| Click a Layers tree row (`nav_item` / "Work") | ✓ same node highlights orange **on the canvas** and **populates the Inspector** — full cross-panel selection sync verified through the new panel boundaries, not just visually similar panels sitting next to each other |
| Console errors throughout | none |

One false alarm during this check, recorded for anyone reproducing it: navigating via
a stale client-side route right after three consecutive Vite HMR updates left the page
stuck on "Loading project…" with all network requests already returned 200 — a dev-
server HMR artifact, not a real bug. A hard navigation to the same URL rendered
correctly on the first paint.

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed.

### ML changes

None.

### Known limitations / open decisions

1. `ExportsPopover`'s outside-click dismissal is a small hand-rolled listener, not a
   shared `Popover` primitive (component-specification.md's Dropdown/Popover is still
   unbuilt) — same "minimal foundation, no new dependency" precedent as Tooltip/Dialog.
2. Bottom dock height is fixed at 40%, not resizable/collapsible yet — 2H/2I scope.
3. Not verified below desktop width this phase — narrow-viewport behavior is 2J scope.
4. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2E — Canvas**
(restyle `AnnotationCanvas`/`PageBoundaryOverlay` stroke/fill colors onto tokens,
preserving all pointer-math; add `CanvasToolbar` with zoom/pan/fit-to-screen and
`CanvasLegend`, both new capabilities). Not started — awaiting confirmation before
continuing.

---

## Phase 14 — Canvas (Design Phase 2E)

**Date:** 2026-08-25
**Goal:** Restyle `AnnotationCanvas`/`PageBoundaryOverlay`'s hardcoded hex stroke/fill
values onto the design-token palette, add zoom/pan/fit-to-screen (new — the canvas had
no zoom control before) and an on-canvas color legend (new — closes the Phase 1
audit's most-cited gap, the color mapping existing only in code comments). Every
pointer-math function (draw/move/resize coordinate transforms) must survive untouched.
**Status:** ✅ Complete.

### Files added

- `apps/web/src/features/annotation/CanvasToolbar.tsx`
- `apps/web/src/features/annotation/CanvasLegend.tsx`
- `apps/web/src/features/annotation/CanvasPanel.tsx` — owns zoom state, composes
  `ClassPicker`+`CanvasToolbar`+`AnnotationCanvas`+`CanvasLegend` (not in the
  roadmap's original file list — see Design decision 1)

### Files changed

- `apps/web/src/features/annotation/AnnotationCanvas.tsx` — hex→Tailwind token
  classes for every stroke/fill; zero changes to any coordinate-transform function or
  event handler
- `apps/web/src/features/detection/PageBoundaryOverlay.tsx` — same treatment; zero
  changes to its drag logic
- `apps/web/src/pages/ProjectWorkspace.tsx` — canvas slot now renders `<CanvasPanel>`

### Files removed

None.

### Preservation posture

- `getImagePoint`, `toPixels`, `toNormalized`, `normalizeRect`, `applyHandle` in
  `AnnotationCanvas.tsx` — byte-for-byte unchanged, confirmed by diff.
- Every `onMouseDown`/drag/draw/resize handler — unchanged.
- `PageBoundaryOverlay.tsx`'s drag/resize logic — unchanged.
- Detection UUID identity, model→manual correction, override behavior, correction
  history, code generation, immutable `CodeVersion`, preview sandbox, export, and the
  page-boundary sticky-correction rule — none of those files were touched.

### Design decisions

1. **Zoom needed zero changes to the pointer-math file.** `getImagePoint` computes
   its screen→image scale from `svgRef.current.getBoundingClientRect()` — the actual
   rendered size, not an assumed one. Since `AnnotationCanvas`'s root is `w-full` with
   an `aspect-ratio`, giving its *parent* an explicit pixel width
   (`asset.width * zoom`) inside a scrollable container makes zoom work correctly
   with zero edits to the file the Phase 1 audit called "hard-won, correct." This is
   the reason `CanvasPanel.tsx` exists — zoom state has to live in the component that
   controls that parent's width, one level above `AnnotationCanvas` itself.
2. **Color classes are a static `Record<DetectionTone, string>` lookup, not template-
   interpolated strings.** Tailwind's JIT scanner requires each class name to appear
   literally in source; `` `fill-${tone}` `` would silently fail to generate CSS in a
   production build even though it works in dev (where Tailwind sometimes has broader
   matching). Every branch (`selected`/`model`/`container`/`manual`) is a complete
   static string.
3. **Label text now matches its own box's color exactly**, replacing the previous
   flat `#1f2937` (leaf and container both) / `#7e22ce` (model, a separately-darkened
   shade from the box's own `#a855f7` stroke). Matches canvas-design.md's explicit
   "Label: … matching stroke color" spec — a deliberate consistency improvement, not
   an accidental color drift.
4. **The on-canvas boundary-confidence label from canvas-design.md §1 was not
   built.** Its justification assumed the status banner had been *removed*; Phase 2D
   relocated that information into the `StatusBar` instead, so it's still visible.
   Building the label anyway would mean threading `confidence` through two files
   scoped to "color constants only" for information already on screen elsewhere.
5. **Pan is the browser's native scroll/trackpad panning inside the zoomed,
   scrollable container**, not a custom space-drag gesture. Covers the same
   functional need (see the canvas at any pan position when zoomed beyond fit)
   without new pointer-event wiring in a phase already touching sensitive files.

### Tests

| Command | Result | Delta from Phase 13 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 120 modules (up from 117), 735ms | +3 modules: the three new canvas files |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged pass count — **critically, the `svg g rect` structural selector in `inspector-overrides.spec.ts` still resolves**, confirming the `<g>`/`<rect>` nesting order survived converting inline `fill`/`stroke` attributes to Tailwind classes |

### Manual verification

Ran `npm run dev:web` against the same live "Wild Card Digital" project (73 approved
boxes) at 1440×900, verifying function over appearance wherever a screenshot alone
would be ambiguous:

| Check | Method | Result |
|---|---|---|
| Zoom in/out | Click, then read the DOM zoom-percentage text in a **separate** follow-up call (React's state update is async — reading in the same synchronous batch as the click showed the stale value and looked like a bug until this was accounted for) | ✓ 29% → 54% after one +25% step |
| Fit to screen | Click, read zoom % | ✓ recomputes from the container's actual measured size |
| Legend | `aria-label="Show canvas legend"` → all 5 labels present (Model/Container/Manual/Selected/Outside page) | ✓ (see Known limitations for a tooling note on how this was clicked) |
| Selection → color → Inspector | Dispatched a real `mousedown`/`mouseup` `MouseEvent` directly on a canvas `<rect>` (not a coordinate click) | ✓ the detection's `<rect>` gained the `fill-selection/8` class; all 6 Inspector sections (Layers, Detection, Style, Geometry, Structure, Content, History) populated |
| Console errors | — | See Known limitations — one artifact investigated and ruled out as a tooling issue, not a live bug |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed.

### ML changes

None.

### Known limitations / open decisions

1. **Two tooling artifacts, investigated and resolved as non-issues, recorded so a
   future session doesn't re-debug them:**
   - `read_console_messages` reported a persistent `ReferenceError: ClassPicker is
     not defined` pointing at a Vite dependency-cache chunk, with an **identical
     timestamp** across a full dev-server restart and `.vite` cache clear. `grep`
     confirmed zero references to `ClassPicker` in `ProjectWorkspace.tsx`, and the
     app rendered and functioned correctly throughout — a real uncaught render error
     would have unmounted the component tree, not left a fully working UI on screen.
     Concluded: a stale/accumulated buffer in the browser-automation tool's console
     reader, not a live page error.
   - The Browser pane's coordinate-based click tool intermittently missed
     `CanvasLegend`'s small (24×24px) button; a real `MouseEvent` dispatched directly
     on the element via JS worked immediately. Automation-precision note, not an
     application defect.
2. `CanvasLegend` has no `Escape`-to-dismiss — same "foundation, not finished"
   precedent as Tooltip (Phase 10) and `ExportsPopover` (Phase 13).
3. Explicit space-drag pan gesture not implemented — native scroll/trackpad panning
   inside the zoomed container covers the same need (see Design decision 5).
4. Not re-verified below desktop width — Phase 2J scope.

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2F — UI Tree**
(extract `LayersPanel` into its own `WorkspaceBody` region if not already fully
separated; add per-type icons and collapse/expand to `TreeNode`, both new). Not
started — awaiting confirmation before continuing.

---

## Phase 15 — UI Tree (Design Phase 2F)

**Date:** 2026-08-25
**Goal:** Restyle `UITreePanel.tsx` onto the design-token palette and add per-type
icons plus collapse/expand for nodes with children (both new). The "extract Layers
into its own region" half of the original roadmap row turned out to already be done
by Phase 13/2D's `WorkspaceBody` shell.
**Status:** ✅ Complete.

### Files changed

- `apps/web/src/features/tree/UITreePanel.tsx` — hex→token colors; indent 14px→16px
  (`space-lg`); added `TypeIcon` (5 icon families) and `ChevronIcon`
  (collapse/expand, local `useState` per node). Root `<ul className="p-2">` and each
  `<li>`'s single direct-child `<button>` kept exactly as before.

### Files added / removed

None.

### Preservation posture

- `buildTreeAndCode`'s output and the `selectedId`/`onSelect` wiring are untouched —
  `UITreePanel` still receives the same `root`/`selectedDetectionId`/`onSelect`/
  `modelDetectionIds` props from `ProjectWorkspace.tsx`, unmodified.
- No detection/override/codegen/persistence file touched. No API file touched.

### Design decisions

1. **Chevron is a `<span onClick>` nested inside the row's `<button>`, not a second
   sibling `<button>`.** Both e2e suites resolve a tree row via
   `page.locator("ul.p-2 > li > button").first()`, which requires exactly one
   direct-child `<button>` per `<li>`. Nesting a real `<button>`/`tabindex` element
   inside a `<button>` violates HTML's content model (browsers render it, but
   focus/activation semantics get unpredictable); a plain `<span>` has no such
   restriction. `stopPropagation()` on the span's click keeps it from also firing the
   row's select handler. Traded off: mouse-only for now — full keyboard tree
   navigation is already `docs/frontend/accessibility.md`'s Phase 2J scope.
2. **Five icon families (container/text/media/interactive/list) via `Set`-based
   lookup, not 41 per-taxonomy-class glyphs.** `node.type` draws from the 41-class
   taxonomy plus synthetic types the layout engine introduces (e.g. `group`) — a
   `Set`-per-family lookup with a safe "container" fallback covers all of them
   without hand-drawing 41 unique icons for a first pass.
3. **Collapsed state is local, unpersisted `useState` per `TreeNode`.** UI-IR node
   ids are reassigned from a per-generation counter on every detection change (a
   pre-existing fact, not new to this phase — see Phase 1's report), so a tree
   rebuild already remounts every node under a new React `key`. Local state resetting
   to its default (expanded) on remount is correct, not a bug — it directly satisfies
   the acceptance criterion ("collapse state doesn't crash on tree rebuild") since
   there's no persisted reference across rebuilds to go stale.

### Tests

| Command | Result | Delta from Phase 14 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 120 modules, 727ms | unchanged module count (edits only, no new files) |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged — `ul.p-2 > li > button` still resolves |

### Manual verification

Ran `npm run dev:web` against the "Wild Card Digital" project (a deeply nested real
tree — page → header/navbar/section×5 → cards/lists), verifying via direct DOM
inspection rather than screenshots alone:

| Check | Result |
|---|---|
| Root `<ul>` class, buttons-per-`<li>` | `rootClass: "p-2"`; exactly 1 direct-child `<button>` per `<li>` |
| Icons render | 2 `<svg>`s in the first row's button (chevron + type icon) |
| Collapse | Dispatched a real click on the chevron `<span>` — nested `<ul>` (11 children) unmounted; **Inspector was not touched**, confirming `stopPropagation` correctly separated "toggle collapse" from "select" |
| Expand | Second click on the same chevron restored all 11 children |
| Row click still selects | Clicked a `logo` row — `#detection-class`'s value became `"logo"` **and** the row's own classes picked up `bg-selection-subtle text-selection`, confirming selection wiring and the new token colors both work together |
| Console errors | The same cached `ClassPicker is not defined` tooling artifact from Phase 14 reappeared (identical timestamp, third occurrence across a hard navigation) — reconfirmed as a stale buffer in the console-reading tool, not a live error, given the app was simultaneously fully functional throughout every check above |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files changed.

### ML changes

None.

### Known limitations / open decisions

1. Chevron collapse/expand is mouse-only — keyboard tree navigation is
   `docs/frontend/accessibility.md`'s Phase 2J scope.
2. Five icon families rather than a unique glyph per taxonomy class — revisit only
   if real usage shows the grouping is too coarse.
3. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2G — Inspector** —
flagged in the roadmap as the single highest-risk phase in the whole plan (restructure
`InspectorPanel.tsx`'s six flat sections into accordion sections while preserving
every handler prop, validator call, and the `EMPTY_STYLE_OVERRIDE` reference-identity
contract; touches the most e2e-asserted selectors of any phase). Not started —
awaiting confirmation before continuing.

---

## Phase 16 — Inspector (Design Phase 2G)

**Date:** 2026-08-25
**Goal:** Restructure `InspectorPanel.tsx`'s six always-expanded sections into
collapsible accordion sections with a shared footer, per
`docs/frontend/inspector-design.md`. Flagged as the highest-risk phase in the entire
Phase 2 plan — every handler, validator, and the `EMPTY_STYLE_OVERRIDE`
reference-identity contract had to survive exactly, and this phase touches the most
e2e-asserted selectors of any phase (`#detection-class`, `#geo-width`, `#content-text`,
three `button[title="..."]` locators, `getByText("Saved")`, `getByText(/may not
contain/i)`).
**Status:** ✅ Complete — two real issues found and fixed during this phase's own
verification, exactly the outcome the roadmap's "do not merge without a full green
run" requirement exists to force.

### Files added

- `apps/web/src/features/inspector/AccordionSection.tsx`
- `apps/web/src/features/inspector/InspectorSectionFooter.tsx`

### Files changed

- `apps/web/src/features/inspector/InspectorPanel.tsx` — JSX restructured onto the
  two new components; every draft/dirty/validation helper function and every handler
  is at the identical scope it was in before this phase (verified by direct
  comparison, not just by test passing)
- `e2e/inspector-overrides.spec.ts` — two lines added (see "Issue 1" below)

### Files removed

None.

### Preservation posture

- `EMPTY_STYLE_OVERRIDE` in `ProjectWorkspace.tsx` and its consumption in
  `InspectorPanel.tsx`'s `useEffect([selected?.id, currentStyle])` — untouched;
  `ProjectWorkspace.tsx` was not edited this phase at all.
- All five Apply/Reset handler functions (`handleApplyStyle` … `handleRevertToModelClass`)
  — identical logic, identical scope, only their surrounding JSX moved.
- `#detection-class`, `#geo-x`/`#geo-y`/`#geo-width`/`#geo-height`,
  `#content-text`/`#content-alt`/`#content-href`, `#structure-parent`/
  `#structure-order`, `#style-*` — every id preserved exactly.
- No detection/override/codegen/persistence file touched. No API file touched.

### Design decisions

1. **Did not build the six per-section files the roadmap's table listed**
   (`DetectionSection.tsx` etc.). Full extraction would mean threading 15–20 props
   into six new components — real surface area for a mismatch bug in the phase this
   whole exercise called "riskiest." `AccordionSection`/`InspectorSectionFooter` are
   genuinely reusable and state-free, so they were built as specified; the six
   sections' actual field JSX stayed inline in `InspectorPanel.tsx`, each now wrapped
   in `<AccordionSection>` in place — zero logic relocation.
2. **Footer labels keep their exact original per-section text**, not
   `inspector-design.md`'s simplified generic table (which proposed one shared
   "No override"/"Applied"/"Unapplied" vocabulary). `e2e/golden-path.spec.ts` asserts
   `getByText("Saved")` verbatim for Detection's clean state — generalizing that
   string would have broken the test for a purely cosmetic gain. The shared
   `InspectorSectionFooter` still standardizes color-by-tone and layout; only the
   label text itself stayed section-specific.
3. **Every button keeps its native `title` attribute alongside the new `Tooltip` and
   `aria-label`** — see Issue 2 below.

### Issue 1 — caught by the required e2e run (not by code review)

First full e2e run after the rewrite: **2 of 3 tests failed.**
`inspector-overrides.spec.ts`'s Geometry and Content tests both timed out with
Playwright reporting `<element> intercepts pointer events` on `#geo-width` /
`#content-text`. Root cause: those sections now default to **collapsed** per
`inspector-design.md`'s explicit spec, but both tests interacted with those fields
immediately after selecting a node, assuming the old always-expanded layout — the
same category of change as Phase 13's toolbar-rename (a deliberate design change a
real user also has to act on, not an application bug). Fixed with one line per test:
`page.getByRole("button", { name: "Geometry"/"Content", exact: true }).click()`
before the first interaction with that section. Re-ran twice more after the fix —
both green, no flakiness traced to the accordion's CSS transition.

### Issue 2 — caught by code review before the first e2e run

The `title=` → `Tooltip`+`aria-label` migration, taken literally, would have removed
the native `title` HTML attribute from every button — silently breaking all three
`button[title="..."]` e2e locators, since a `Tooltip` renders its text in a separate
`role="tooltip"` element on hover/focus, not as a `title` attribute. Caught while
writing the component, before ever running the suites. Fixed with the lowest-risk
option: keep the native `title` **in addition to** the `Tooltip` wrapper and
`aria-label` on every button — zero e2e selector changes needed, at the minor,
documented cost of two tooltip mechanisms technically being present on one element.

### Tests

| Command | Result | Delta from Phase 15 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean on the first pass | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 124 modules (up from 120), 749ms | +4 modules: `AccordionSection`, `InspectorSectionFooter`, plus `Field`/`Select`/`Input`/`Tooltip` now actually imported by the Inspector |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test` — run 1 | **2 failed** (Issue 1) | — |
| `npx playwright test` — run 2 (after fix) | 3 passed | — |
| `npx playwright test` — run 3 (flakiness check) | 3 passed | — |

### Manual verification

| Check | Method | Result |
|---|---|---|
| Collapsed section is genuinely non-interactive | Checked the clipping ancestor's own `getBoundingClientRect().height` (not the input's — a clipped descendant still reports its own natural size) and `document.elementFromPoint()` at the input's nominal position | Ancestor height `0`; hit-test resolved to a **different** element than `#geo-width` — collapse is real, not just visual |
| Style section dirty-detection (not covered by either e2e suite) | Real simulated keystrokes into `#style-gap` (a raw DOM `.value` assignment does **not** reliably trigger React's controlled-input `onChange` — tried first, confirmed it silently fails, switched to real keystrokes) | Footer flipped from "No style overrides" to "Unapplied" correctly |
| Console errors | — | The same cached `ClassPicker is not defined` tooling artifact reappeared a fourth time, identical timestamp — reconfirmed as a stale automation-tool buffer, not a live error, given every functional check above succeeded simultaneously |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed.

### ML changes

None.

### Known limitations / open decisions

1. Every Apply/Reset button carries both a native `title` and a custom `Tooltip` —
   deliberate (Issue 2); a future `data-testid` migration of the three e2e locators
   would allow dropping the redundant native `title`.
2. **Testing note for future sessions**: simulating input into a React-controlled
   field via `element.value = x; dispatchEvent(new Event(...))` does not reliably
   trigger React's `onChange` — use real simulated keystrokes (or RTL's
   `fireEvent`/`userEvent` in an actual test file). Cost real debugging time this
   phase; recorded so it isn't rediscovered from scratch.
3. Structure section's dirty-detection was not independently re-verified (identical
   code shape to Style/Geometry, both verified) — analogy-based confidence, not a
   gap.
4. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2H — Code panel**
(flip Monaco's `theme` prop from `vs-dark` to a light theme; restyle surrounding
chrome; move into the `BottomDock`). The Inspector — the roadmap's single highest-risk
phase — is now behind this plan. Not started — awaiting confirmation before
continuing.

---

## Phase 17 — Code Panel (Design Phase 2H)

**Date:** 2026-08-25
**Goal:** Flip Monaco's hardcoded `vs-dark` theme to light (the one permanently-dark
surface in an otherwise all-light app, per Phase 1's §17/§21 finding) and restyle
`CodePanel.tsx`'s surrounding chrome onto tokens. The draft/dirty state machine and
the `validateGeneratedCode()` gate must survive untouched.
**Status:** ✅ Complete.

### Files changed

- `apps/web/src/features/code/CodePanel.tsx` — `theme="vs-dark"` → `theme="light"`;
  HTML/CSS sub-tabs now use the shared `Tabs`/`Tab` components; Cancel/Save edit/Edit
  code buttons now use `Button`; validation/error banner restyled onto tokens. Zero
  changes to `beginEdit`/`cancelEdit`/`handleSave` or the validator call itself.

### Files added / removed

None.

### Preservation posture

- `validateGeneratedCode()` still gates every Save attempt before any network call —
  verified live, not just by reading the unchanged source (see Manual verification).
- The not-editing/editing draft-tracking `useEffect` and the `dirty` computation are
  untouched.
- No detection/override/codegen/persistence file touched. No API file touched.

### Design decision

**The "Edit code" button's tooltip has no redundant native `title` attribute**,
unlike every Apply/Reset button restyled in Phase 16. That phase kept `title`
alongside the new `Tooltip` specifically because three `button[title="..."]` e2e
locators depended on it; "Edit code" has no such dependency, so this is the first
instance of the pattern's "clean" end state — worth noting as the template for
future buttons once Phase 16's legacy-selector constraint no longer applies elsewhere.

### Tests

| Command | Result | Delta from Phase 16 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 125 modules (up from 124), 754ms | +1 module |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged |

### Manual verification

The one check that actually matters for this phase — whether the validation gate
still blocks a bad save through the restyled component, not just whether the suites
stay green (neither e2e suite exercises this path):

| Check | Result |
|---|---|
| Monaco theme, computed style | `rgb(255, 255, 254)` editor background — confirmed light |
| Entered edit mode, typed `<div><span>unclosed</div>` (a real mouse click into Monaco was required before `Cmd+A`/typed keystrokes registered — a programmatic `.focus()` alone was not enough), clicked Save edit | The exact validator fired: `HTML_UNBALANCED_TAG: Closing </div> does not match the open <span>.` Save was blocked; the panel stayed in editing mode (`Cancel`/`Save edit` still visible, confirming `setEditing(false)` was never reached) |
| Console errors | The same cached `ClassPicker is not defined` tooling artifact reappeared a fifth time, identical timestamp — reconfirmed as a stale automation-tool buffer given every functional check above succeeded |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files changed.

### ML changes

None.

### Known limitations / open decisions

1. No automated e2e coverage for the validation-gate path (pre-existing gap, not
   introduced here) — verified manually instead.
2. Automation-tooling note for future sessions: Monaco requires a real mouse click
   into the editor before keyboard shortcuts/typed input register via browser
   automation — a programmatic `.focus()` call is not sufficient. Same category as
   Phase 16's React-controlled-input finding.
3. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2I — Preview** (add
frame chrome and a loading progress line around `PreviewPane`; the iframe's
`sandbox=""` and `srcDoc` composition logic are explicitly not to be touched — this is
this app's one deliberate security boundary). Not started — awaiting confirmation
before continuing.

---

## Phase 18 — Preview (Design Phase 2I)

**Date:** 2026-08-25
**Goal:** Add frame chrome (viewport width label), a loading progress line, and an
empty state around `PreviewPane.tsx`. The iframe's `sandbox=""` attribute and
`composeDocument()`'s asset-path rewrite are the app's one deliberate security
boundary and are explicitly a hard gate for this phase — any change there needs
explicit sign-off, not routine review.
**Status:** ✅ Complete.

### Files changed

- `apps/web/src/features/preview/PreviewPane.tsx` — width label, loading progress
  line (new optional `loading?: boolean` prop), empty state, viewport toggle restyled
  onto tokens. `composeDocument()` and the iframe's `sandbox`/`srcDoc`/`title`
  attributes are byte-for-byte unchanged.
- `apps/web/src/pages/ProjectWorkspace.tsx` — one call site passes the new `loading`
  prop, reusing the same busy expression already computed for `InspectorPanel`.

### Files added / removed

None.

### Preservation posture — the sandbox gate

Checked three independent ways, per this phase's own "hard gate, explicit sign-off"
requirement:

1. `grep -n 'sandbox' apps/web/src/features/preview/PreviewPane.tsx` — one match,
   `sandbox=""`, run directly against the diff.
2. Live DOM read in the browser: `iframe.getAttribute('sandbox')` → `""`.
3. Full `e2e/golden-path.spec.ts` run, including the export step, which depends on
   the preview pipeline working end to end.

`composeDocument()`'s asset-path rewrite regex and its two-branch style-tag insertion
are unchanged (no lines touched inside that function).

### Design decision

**"Version activation" was left out of the `loading` prop's trigger expression**,
though `code-preview-design.md` named it. `handleActivateVersion` in
`ProjectWorkspace.tsx` has never tracked its own busy flag — confirmed by reading the
function, a bare `await api.activateCodeVersion(...)` with no `setXxx(true/false)`
around it. Adding one to satisfy the doc's literal wording would have contradicted
that same doc's "no new state" instruction one sentence later. Followed the intent
(no new state) over the letter (include version activation) — recorded as a
deviation, not silently dropped.

### Tests

| Command | Result | Delta from Phase 17 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 125 modules (unchanged count), 742ms | edits only |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test e2e/golden-path.spec.ts e2e/inspector-overrides.spec.ts` | 3 passed | unchanged |

### Manual verification

| Check | Result |
|---|---|
| `iframe.getAttribute('sandbox')` | `""` |
| Click "Tablet" → width label + iframe width | Both read `"768px"` |
| Style Apply round-trip (proxy for the loading line) | Footer transitioned to "Applied," confirming `applyingStyle` toggled true→false — the same boolean now drives `loading` |
| Console errors | The same cached `ClassPicker is not defined` tooling artifact reappeared a sixth time, identical timestamp — reconfirmed as a stale automation-tool buffer |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files changed.

### ML changes

None.

### Known limitations / open decisions

1. The loading progress line's on-screen appearance was not caught mid-flight — the
   local dev API resolves well under 100ms, faster than polling could catch. Verified
   indirectly instead: `loading` is a type-checked direct pass-through of state
   already proven to toggle correctly (the Apply succeeded). A quick visual glance
   under real network latency would close this gap if it ever feels unconvincing.
2. Empty-state rendering (`html.trim() === ""`) not exercised against a live
   zero-detection project — low risk, single-condition JSX, not independently
   confirmed live.
3. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2J — Responsive /
accessibility** (canvas keyboard-selection/nudge, full Layers-tree keyboard
navigation, drawer patterns at tablet width, the `WorkspaceUnavailable` mobile
screen, ARIA labeling sweep across every component landed in 2B–2I). This is the
broadest-surface-area phase remaining — it touches most components from prior phases
to add responsive classes and ARIA attributes, per
`docs/frontend/frontend-implementation-roadmap.md`'s own acceptance criteria. Not
started — awaiting confirmation before continuing.

---

## Phase 19 — Responsive / Accessibility (Design Phase 2J)

**Date:** 2026-08-25
**Goal:** Implement `responsive-design.md`'s breakpoint behavior (tablet drawers,
mobile `WorkspaceUnavailable`) and `accessibility.md`'s keyboard/ARIA additions
across every component landed in Phases 10–18. The broadest-surface-area phase in
the plan — touches the canvas, the tree, the workspace shell, and adds two new pages.
**Status:** ✅ Complete.

### Files added

- `apps/web/src/components/useMediaQuery.ts`
- `apps/web/src/components/Drawer.tsx`
- `apps/web/src/pages/WorkspaceUnavailable.tsx`

### Files changed

- `apps/web/src/features/annotation/AnnotationCanvas.tsx` — new separate
  `useEffect` for arrow-key nudge (reuses `onUpdate`, no existing function touched);
  each detection `<rect>` gained `tabIndex`/`role`/`aria-label`/Enter-Space
  `onKeyDown`; the `<svg>` root gained `role="application"` + a live `aria-label`.
- `apps/web/src/features/tree/UITreePanel.tsx` — `onKeyDown` for →/← expand/collapse
  (calls the existing `setCollapsed`) + `aria-expanded`.
- `apps/web/src/features/workspace/WorkspaceBody.tsx` — new `isTablet` prop; renders
  `Drawer`s instead of fixed columns when true. Same content in both branches.
- `apps/web/src/pages/ProjectWorkspace.tsx` — `isMobile`/`isTablet` via
  `useMediaQuery`; early-returns `WorkspaceUnavailable` on mobile, after the
  existing loading/error/not-found guards (hook-call order unaffected).

### Files removed

None.

### Preservation posture

- `AnnotationCanvas.tsx`'s pointer-math functions (`getImagePoint`, `toPixels`,
  `toNormalized`, `normalizeRect`, `applyHandle`) and every existing drag/draw/
  resize/delete handler — untouched; the nudge logic lives in a new, separate effect.
- `UITreePanel.tsx`'s `ul.p-2 > li > button` shape — unchanged (verified by both
  e2e suites still passing).
- No detection/override/codegen/persistence file touched beyond the additive changes
  above. No API file touched.

### Design decisions

1. **Canvas Tab-cycling is native focus order, not a custom Tab-key interceptor.**
   Hijacking the browser's own Tab key while the canvas has focus risks a keyboard
   trap. Making each detection `tabIndex={0}` achieves the same reachability through
   the platform's own mechanism.
2. **Focus does not auto-select** — only Enter/Space does, matching how every other
   focusable control in the app already separates "focused" from "activated."
3. **Tablet-drawer content remounts on a live breakpoint crossing** (window resize
   across 768/1024px mid-session loses canvas zoom/tree-collapse state) — accepted
   as a narrow-scenario MVP trade-off over the added complexity of portal-based
   reparenting.

### Tests

| Command | Result | Delta from Phase 18 |
|---|---|---|
| `npm run typecheck -w apps/web` | Clean on the first pass | unchanged elsewhere |
| `npm run build` (all 4 workspaces) | Success — Vite 128 modules (up from 125), 756ms | +3 modules |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed / 0 failed | unchanged |
| `npx playwright test` (both suites, default desktop viewport) | 3 passed | unchanged — confirms new mobile/tablet branches don't affect the desktop path the suites run at |

### Manual verification

The most thorough live-verification pass of any phase so far — every new
interactive surface was exercised, not inferred from source:

| Check | Method | Result |
|---|---|---|
| Canvas arrow-key nudge | Selected a detection, dispatched `ArrowRight` then `Shift+ArrowDown`, read the rendered `<rect>`'s `x`/`y` between each | `x: 78→79` (1px-equiv.), `y: 78→~88` (10px-equiv., Shift) |
| Nudge actually persists | Read the network log after both nudges | **Two real `PATCH .../detections/:id` → 200** — confirms the nudge round-trips through `handleUpdate`, the same path a mouse drag uses, not a local-only visual change |
| Tree →/← expand/collapse | Focused the root row, dispatched `ArrowLeft` then `ArrowRight` | Collapsed (nested `<ul>`, 11 children, unmounted) then fully restored |
| Tablet drawers (900px) | Clicked "Layers", then "Inspector", toggle buttons | Layers opened left-anchored with the live tree (a prior selection's highlight preserved); Inspector opened right-anchored showing that same node's full accordion state; `Escape` closed the Layers drawer |
| Mobile screen (390px) | Loaded the workspace route directly | `WorkspaceUnavailable` rendered: brand header, project name, explanation copy, status + sketch thumbnail, "View live preview" → full-screen `PreviewPane` with working viewport toggles and "← Back" |
| ARIA attributes | Queried `svg[role="application"]` and a detection `<rect>` directly | Correct live `aria-label` (with the real detection count) on the svg; `tabindex="0"`/`role="button"`/`aria-label="page, manual"` on the rect — first attempt queried the wrong `<svg>` (an icon, not the canvas root) and was corrected with a more specific selector |
| Console errors | — | The same cached `ClassPicker is not defined` tooling artifact reappeared a seventh time, identical timestamp — reconfirmed as a stale automation-tool buffer, not a live error |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files added/changed.

### ML changes

None.

### Known limitations / open decisions

1. Tablet-drawer content remounts on a live breakpoint crossing (Design decision 3).
2. `Drawer` has no focus-trap — Escape + overlay-click only, same scoping precedent
   as Tooltip/ExportsPopover/CanvasLegend.
3. No automated axe/contrast tooling added — optional per this phase's own
   requirement; manual keyboard passes were the verification method.
4. No visual-regression harness in this repo (pre-existing gap).

### Next phase

Per `docs/frontend/frontend-implementation-roadmap.md`, **Phase 2K — Visual QA /
polish** — the final phase: a full-app pass against every design doc, fixing drift,
followed by the complete manual `docs/execution/regression-checklist.md` (15
core-pipeline steps + preservation checks). Not started — awaiting confirmation
before continuing.

---

## Phase 20 — Visual QA / Polish (Design Phase 2K)

**Date:** 2026-08-25
**Goal:** Final phase of the Phase 2 frontend redesign. Full-app pass against every
design doc to catch drift, the full automated suite including `test:py` (not run
once during 2A–2J), both e2e suites, and a live manual regression walkthrough.
**Status:** ✅ Complete. **Phase 2 (design tokens through responsive/accessibility)
is complete as of this entry.**

### Files changed

- `apps/web/src/features/annotation/ClassPicker.tsx` — rewritten onto the `Select`
  primitive (was still on its original `gray-300`/`orange-500` classes — never
  touched by any earlier Phase 2 sub-phase)
- `apps/web/src/features/upload/UploadDropzone.tsx` — restyled onto tokens (same
  reason — never touched before this phase)

### Files added / removed

None.

### What the QA pass actually found

A repo-wide `grep` for legacy Tailwind color classes (`text-gray-*`, `bg-orange-*`,
`border-red-*`, `text-purple-*`, etc.) across every `.tsx` file in `apps/web/src`
turned up exactly two files with real hits: `ClassPicker.tsx` and
`UploadDropzone.tsx`. Both are small, self-contained components that happened to sit
outside every prior phase's stated scope (`ClassPicker` is only rendered inside
`CanvasPanel`, built in Phase 14 but never itself opened for editing; `UploadDropzone`
only appears in the empty-workspace state, which no phase's acceptance criteria
named directly). Fixed both; a second grep pass (legacy classes, raw hex, `rgba()`
fills/strokes) came back clean — one hit remained, inside a code comment referencing
an already-removed hex value, not a live style.

### Tests — full suite, run fresh for this phase

| Command | Result |
|---|---|
| `npm run typecheck` (web + api + scripts) | Clean |
| `npm run test` (Vitest, shared-types + api) | 124 + 386 passed |
| `npm run test:py` (Pytest, cv-worker) | **19 passed** — first run of this suite in the entire Phase 2 effort; confirms the TS/Python boundary-overlap-parity fixture (untouched by any frontend phase) is still intact |
| `npm run build` (all 4 workspaces) | Success — Vite 128 modules, 703ms |
| `npx playwright test` (both e2e suites) | 3 passed |

### Manual regression walkthrough

Real clicks and real typed keystrokes throughout — not JS-dispatched shortcuts,
except where noted:

| Step | Result |
|---|---|
| Dashboard: create "Phase 2K Regression Check" (typed name, clicked Create) | ✅ navigated into a fresh empty workspace showing the newly-restyled `UploadDropzone` |
| Dashboard: delete that project (clicked delete icon → confirm dialog → clicked Delete) | ✅ dialog showed the correct title/body, project removed from the list |
| **Structure section dirty-check** — the one gap Phase 16 explicitly flagged as not independently verified | ✅ typed into `#structure-order`: footer → "Unapplied"; Apply: footer → "Applied"; Reset: footer → "No structure override" — full cycle confirmed, closing that gap |
| Export ZIP | Button present and enabled; not clicked live (would start a real, uninspectable download in this session — `golden-path.spec.ts` already asserts the download event and `.zip` filename on every run) |
| Console errors | The cached `ClassPicker is not defined` tooling artifact reappeared an **eighth** time across a fresh navigation, identical timestamp — final reconfirmation it is a stale automation-tool buffer, not a live error |

**Not performed this phase, and why it's still covered:** a brand-new upload→detect
walkthrough — this session's browser-automation surface has no equivalent to
Playwright's `setInputFiles`, so a live file upload couldn't be driven manually.
`e2e/golden-path.spec.ts` exercises exactly this path (upload → detect → correct →
generate → preview → export) and has been green on every phase's e2e run throughout
Phase 2, which is the reproducible evidence for that step.

### Preservation checks (from `regression-checklist.md`)

| Check | Evidence |
|---|---|
| Model→manual flip on correction | `golden-path.spec.ts`'s class-change step, unchanged code path, green every run |
| Immutable `CodeVersion` rows | No file under `code-versions` routes or the save/activate handlers was touched in any Phase 2 sub-phase |
| Preview sandbox (`sandbox=""`, no `allow-scripts`) | Triple-checked in Phase 18 (grep, live DOM read, e2e); unchanged since |
| Content-override `<`/`>` and href-scheme rejection | Exercised live by `inspector-overrides.spec.ts` on every run |
| Boundary-parity fixture (TS ↔ Python) | `test:py`, 19/19, this phase |

### Database changes

None.

### API changes

None.

### Frontend changes

Summarized above under Files changed.

### ML changes

None.

### Known limitations / open decisions

1. A brand-new upload→detect live walkthrough wasn't performed this session
   (tooling gap) — covered by `golden-path.spec.ts` instead.
2. Export ZIP's download wasn't triggered live this phase — covered by the same
   suite's explicit download-event assertion.
3. No visual-regression harness or automated axe/contrast tooling exists in this
   repo — a pre-existing gap noted in every phase of Phase 2, still open, and a
   reasonable candidate for future work rather than something this phase needed to
   close.

### Phase 2 — closing summary

Eleven sub-phases (2A–2K), logged here as Phases 10–20, took the frontend from zero
design tokens and a 1,035-line God-component workspace to: a full token system;
a primitive component library (Button, Input, Select, Field, Tabs, Badge, Tooltip,
Panel, Card, EmptyState, ErrorState, Dialog, Toast, Drawer, and more); a rebuilt
4-region workspace shell; a token-restyled canvas with new zoom/pan/fit/legend
capabilities and zero changes to its pointer-math; an icon-and-keyboard-enabled
Layers tree; an accordion Inspector preserving every handler, validator, and the
`EMPTY_STYLE_OVERRIDE` identity contract exactly; a light-themed Monaco code panel;
a Preview pane with frame chrome, a loading indicator, and an untouched security
sandbox; full responsive behavior (desktop/tablet drawers/mobile fallback) and
keyboard/ARIA coverage; and a final QA pass that found and fixed real, previously
undetected drift rather than rubber-stamping the prior ten phases.

Zero regressions to detection behavior, override behavior, code generation,
code-version immutability, preview sandboxing, export behavior, or page-boundary
behavior — verified at every phase boundary (typecheck, build, Vitest, both e2e
suites) and repeatedly cross-checked live (DOM state, network requests, real
persisted API calls) well beyond what the automated suites alone assert. Two
deliberate, tracked breaking changes to test selectors (the toolbar button rename in
Phase 13, the accordion-collapse expand-step in Phase 16) were each fixed in the same
phase that introduced them, never left for later.

### Next phase

None — Phase 2 is complete. Any further frontend work (a visual-regression harness,
automated accessibility tooling, the `data-testid` selector migration flagged as
insurance in Phase 16, or a new design-spec phase) would begin a new, separately
scoped effort.

---

## Phase D1 — Authentication (Deadline Execution Plan)

**Date:** 2026-08-25
**Goal:** Convert the single implicit workspace into `authenticated user → owned
projects → authorized resources`, per
`Sketch2UI_Deadline_4_Features_Claude_Code_Execution_Plan.md` §4. Smallest defensible
scope: register/login/logout/session, password hashing, project ownership,
authorization on every project-owned route, protected frontend routes. No OAuth/
SSO/MFA/password-reset/collaboration/RBAC.
**Status:** ✅ Complete.

### Files added
- `apps/api/prisma/migrations/20260825000000_add_auth/` — `User`, `Session`,
  `Project.ownerId`. Generated via `prisma migrate diff` against schema datamodels
  directly (no live database needed — same approach the existing `20260824000000_init`
  migration used, per its own header comment).
- `apps/api/src/modules/auth/` — `auth.routes.ts` (register/login/logout/me),
  `password.ts` (scrypt hash/verify — Node's built-in `crypto.scrypt`, zero new native
  dependencies), `token.ts` (session token generate/hash), `cookies.ts` (manual `sid`
  cookie reader/writer — no `cookie-parser` needed since the token is a high-entropy
  opaque value, not a signed payload), `legacy-owner.ts` (the well-known backfill
  account's fixed id/email), `auth.routes.test.ts` (first HTTP-integration test file in
  `apps/api`, via a new dev-only `supertest` dependency).
- `apps/api/src/middleware/requireAuth.ts`, `requireProjectOwnership.ts`,
  `apps/api/src/types/express.d.ts` (ambient `req.userId` augmentation).
- `apps/api/src/repositories/{json,prisma}/{user,session}.repository.ts` +
  `__tests__/{user,session}.contract.ts` + their `.json.test.ts`/`.prisma.test.ts` arms.
- `apps/api/scripts/backfill-legacy-owner.ts` — explicit, idempotent, run-by-hand
  (deliberately not automatic on server boot — see "Legacy data" below).
- `packages/shared-types/src/{user,session}.ts`.
- `apps/web/src/context/AuthContext.tsx`, `apps/web/src/components/ProtectedRoute.tsx`,
  `apps/web/src/pages/{Login,Register}.tsx`.
- `e2e/auth.ts` — `registerAndLogin(page, email)` helper.

### Files changed
- `apps/api/src/server.ts` — mount `authRouter` before a global `requireAuth` gate;
  `cors({ ..., credentials: true })`; `/uploads` moved below the auth gate.
- `apps/api/src/modules/projects/projects.routes.ts` — `POST /` stamps
  `ownerId: req.userId`; `GET /` calls the new `listByOwner`; `GET|PATCH|DELETE /:id`
  gated by `requireProjectOwnership`.
- `apps/api/src/modules/jobs/jobs.routes.ts` — inline fetch-job-then-check-owner,
  since `GET /api/jobs/:jobId` carries no project id in its own path (the one route
  the shared middleware can't cover).
- 13 nested project-scoped routers (assets, detections, detect, boundaries, training,
  exports, crops, codegen + latestCode, code-versions, the four override groups,
  corrections) — one `router.use(requireProjectOwnership)` line each, no per-handler
  changes.
- `apps/api/src/repositories/types.ts`, `repositories/index.ts`,
  `repositories/json/project.repository.ts`, `repositories/prisma/project.repository.ts`
  — `ownerId` on `CreateProjectInput`/`ProjectRecord`, new `listByOwner`.
- `apps/api/src/middleware/apiError.ts` — `ErrorCode` gains `UNAUTHENTICATED`,
  `FORBIDDEN` (reserved, unused this phase), `EMAIL_IN_USE`, `INVALID_CREDENTIALS`.
- `apps/api/src/db/jsonStore.ts` (`users`/`sessions` arrays),
  `apps/api/src/db/migrate-json-to-postgres.ts` (upserts the legacy owner and maps
  `ownerId` in its `project.createMany`).
- `apps/web/src/App.tsx` (route table gated by `AuthProvider`/`ProtectedRoute`),
  `apps/web/src/services/api.ts` (`credentials: "include"` +
  `register/login/logout/me`), `apps/web/src/components/AppHeader.tsx` (user email +
  logout).
- `e2e/golden-path.spec.ts`, `e2e/inspector-overrides.spec.ts` — call
  `registerAndLogin` before the existing flow, since `/` is now behind
  `ProtectedRoute`.
- 12 existing repository-contract test files — every `projects.create({ name })` call
  site updated to supply the now-required `ownerId`.

### Security decisions
- **Session strategy: server-side `Session` table + opaque random-token httpOnly
  cookie**, not JWT or a stateless signed cookie — logout must actually revoke
  something, and a `Session` table costs no more than a stateless scheme would need
  for equivalent revocation, while matching the existing repository pattern exactly.
  Cookie stores the raw token; the database stores only `sha256(token)`, so a
  database read/leak cannot hand out a usable bearer value.
- **Ownership mismatches return `404`, not `403`**, uniformly with "doesn't exist" —
  avoids an existence-enumeration oracle. Login failures return an identical `401` for
  both "unknown email" and "wrong password."
- **Legacy data**: rather than a silent mutation on server boot, backfilling
  pre-auth projects onto a well-known `legacy-owner@sketch2ui.local` account is an
  explicit, idempotent, run-by-hand script — matching the source plan's own wording
  ("controlled migration," "seeded/configured legacy owner").

### Tests
| Command | Result |
|---|---|
| `npm run typecheck` | clean (web, api, scripts) |
| `npm run test` | 124 (shared-types) + 218 passed / 15 skipped — Prisma contract arms skip cleanly with no reachable test database (`apps/api`) |
| `npm run test:py` | 19 passed |
| `npm run build` | success, all 4 workspaces |
| `npm run test:e2e` | 3 passed (both specs, now auth-aware) |

Plus a manual browser walkthrough: register → dashboard (empty, correctly scoped to
the new account) → logout → redirected to `/login` → log back in → dashboard again.

### Known limitations
1. `/uploads` static file serving is gated by `requireAuth` (must be logged in) but
   not by per-asset project ownership — would need a custom handler resolving
   `storageKey → asset → project → ownerId` on every image request. Deliberate,
   documented residual gap: storage keys are unguessable UUIDs.
2. The legacy-owner backfill script has not been run against this machine's real dev
   data yet (there is currently no `apps/api/data/store.json` in this environment at
   all — see Phase D2's entry). Run `npx tsx apps/api/scripts/backfill-legacy-owner.ts`
   whenever real pre-auth project data exists to backfill.
3. No password-reset flow — consistent with the phase's explicit scope, but means a
   forgotten password has no recovery path today.

### Next phase
D2 — Detector Quality/Evaluation (see next entry, same date).

---

## Phase D2 — Detector Quality / Evaluation (Deadline Execution Plan)

**Date:** 2026-08-25
**Goal:** Per the deadline plan §5: determine whether meaningful new labeled data
exists; if not, do not retrain — evaluate v1.0.0, produce qualitative examples,
document limitations, keep v1.0.0 active.
**Status:** ✅ Complete — no retrain (correctly, per the decision rule below).

### What was checked
- `ml/dataset/{images,labels}/` — still **162 images / 162 label files / 2,917 label
  instances**, byte-identical in count to the 2026-08-24 dataset-quality report
  (`docs/ml/dataset-quality-v1.1.md`). No new annotation work has landed.
- `apps/api/data/store.json` does not exist in this environment (no live project
  data at all here), so `npm run report:active-learning` has nothing to report —
  consistent with "no new data," not a separate finding.
- `docs/ml/model-decision.md` (Phase 6 prep, 2026-08-24) already states the
  preconditions for any v1.1 run are unmet and explicitly identifies the blocker as
  human annotation work: new P0-class examples (`select`, `radio_button`,
  `carousel`), first-ever evaluable `card`/`page` coverage, and genuine hard
  negatives (none exist in the corpus).

### Decision
**Do not retrain.** Re-confirms the Phase 6 prep decision — nothing has changed
since that document was written that would alter it. `ml/models/ui-detector/`
contains only `v1.0.0`; it stays active and immutable.

### Evaluation performed
- Re-ran `npm run eval` against the live `services/cv-worker` (v1.0.0 loaded) and the
  same 5-image corpus as the committed baseline. **Every number reproduced exactly**:
  `endToEndUsablePreviewRate` 1 (5/5), `boundaryMeanIoU` 0.8701, identical per-image
  boundary IoUs, 10/10 layout assertions, all HTML/CSS parses, 0 duplicate ids.
  Written to a scratch file, not overwriting `docs/eval/baseline-v1.0.0.json` (no
  reason to touch the frozen regression benchmark when nothing changed).
- Generated qualitative prediction overlays for all 5 sample sketches
  (`docs/eval/qualitative-v1.0.0/`, via `ultralytics`' own `Results.save()`) —
  visually confirms the model README's confusion-matrix analysis: strong, confident
  boxes on structural classes (`section`/`navbar`/`footer`/`image`), and the
  documented weak classes (`select`, `radio_button`, `carousel`) either missing,
  low-confidence, or mislabeled as a visually similar rectangle class.

### Files added
- `docs/eval/qualitative-v1.0.0/*.pred.jpg` (5 images) + `README.md` explaining how
  they were produced and how to read them.

### Files changed
- `PROJECT_STATUS.md` — §2.9 added (Phase D1 summary), TL;DR and §4.2/§6 updated to
  reflect auth being done and the detector re-confirmation.

### Known limitations
Unchanged from `docs/ml/dataset-quality-v1.1.md` and `model-decision.md` — both
documents already state the situation accurately; this phase found nothing new to
add. The corpus's 4 zero-example classes (`avatar`, `list_item`, `map`, `newsletter`),
25-of-41 unevaluable classes, and complete absence of hard negatives are all still
true and still require human annotation work to fix.

### Next phase
D3 — Minimum Viable Multi-Page, per the deadline plan's sequencing.

---

## Phase D3 — Minimum Viable Multi-Page (Deadline Execution Plan)

**Date:** 2026-08-25
**Goal:** Convert a project from "one asset, one page" into `Project → Page[]`, per
`Sketch2UI_Deadline_4_Features_Claude_Code_Execution_Plan.md` §6. Every project-owned
resource (assets, detections, boundaries, code versions, the four override groups,
corrections) becomes page-scoped; export bundles every page into one ZIP. This phase's
backend half was committed as a mid-phase checkpoint (see `d30ebe9`, "Phases D1-D3
(partial)") ahead of a session/account handoff, with
`docs/execution/d3-multipage-handoff.md` tracking the exact resume point. This entry
covers that handoff's completion — the frontend, e2e, and full regression — and folds
the handoff file's content into the permanent record; the handoff file is deleted as
of this entry.
**Status:** ✅ Complete.

### Files added (backend, from the checkpoint commit)
- `apps/api/prisma/migrations/20260826000000_add_pages/` — new `Page` model; `pageId`
  added to `ProjectAsset`, `Detection`, `CodeVersion`, `PageBoundaryRecord`,
  `CorrectionRecord`, and the four override tables (unique constraint on
  `CodeVersion` moved from `[projectId, versionNumber]` to `[pageId, versionNumber]`).
- `apps/api/src/repositories/{json,prisma}/page.repository.ts` +
  `__tests__/page.contract{,.json,.prisma}.test.ts` — `listByProject`, `findById`,
  `create` (assigns `order` as `existing.length + 1`), `update` (rename), `delete`
  (refuses when it's the project's last page), `setActiveCodeVersion`.
- `apps/api/src/modules/pages/pages.routes.ts` + `pages.routes.test.ts` — CRUD at
  `/api/projects/:id/pages[/:pageId]`, gated by `requireProjectOwnership` only (this
  module defines what pages exist).
- `apps/api/src/middleware/requirePageInProject.ts` — mirrors
  `requireProjectOwnership`'s 404-not-403 existence-enumeration-avoidance reasoning;
  mounted as the second middleware on every page-nested router.
- `apps/api/scripts/backfill-pages.ts` (+ `npm run db:backfill-pages`) — explicit,
  run-by-hand Postgres backfill for a project with zero pages and zero child rows
  (rare, since `pageId` is `NOT NULL` everywhere it's used).
- `packages/shared-types/src/page.ts` (`Page` type).

### Files added (frontend, this session)
- `apps/web/src/features/workspace/PagesStrip.tsx` — one pill per page
  (`Button variant={selected ? "primary" : "ghost"}`), inline rename via a pencil
  `IconButton` that swaps the label for an `Input` (Enter/blur commits, Escape
  cancels), delete via a trash `IconButton` + `useDialog().confirm({ destructive:
  true })` (hidden when it's the project's only page), and a trailing "+ Add page"
  button. Built from existing Button/IconButton/Input primitives, not `Tabs.tsx`
  (no add/rename/delete affordance there).
- `e2e/multi-page.spec.ts` — a second page gets its own independent
  upload/detect/generate cycle; switching back to Page 1 shows Page 1's own state
  without re-running Detect; a `link`-class detection's `href` set to
  `./page-2.html` via the Content Inspector survives into the exported
  `index.html` verbatim; the exported ZIP contains `index.html`, `page-2.html`,
  exactly one `styles.css`, and both pages' own `source-sketch-*` files.

### Files changed (backend, from the checkpoint commit)
- All 13 previously project-nested routers restructured from
  `/api/projects/:id/<resource>` to `/api/projects/:id/pages/:pageId/<resource>`,
  each switched to the new `*ByPage`/`findInPage`/etc. repository methods (old
  `*ByProject` methods kept, not renamed — additive). `exports` stays project-level
  (one export bundles every page); `jobs` stays top-level (`pageId` threaded through
  as an optional field instead).
- `apps/api/src/modules/exports/exports.routes.ts` — rewritten for multi-page
  bundling: `order === 1` exports as `index.html`, every other page as
  `page-{order}.html`, one shared `styles.css` built by plain concatenation (safe
  because `packages/codegen`'s new additive `idPrefix` option namespaces each page's
  UI-IR node ids, so no cross-page CSS id collision is possible).
- `apps/api/src/db/jsonStore.ts` — `backfillPages()` runs on every `load()`,
  idempotently synthesizing "Page 1" for any pre-D3 project and stamping `pageId`
  onto its existing child rows.
- `apps/api/src/modules/projects/projects.routes.ts` — `POST /` now also creates
  "Page 1" for a brand-new project.

### Files changed (frontend, this session)
- `apps/web/src/services/api.ts` — added `listPages`/`createPage`/`renamePage`/
  `deletePage`; every page-owned-resource method gained a `pageId` parameter and its
  URL template now inserts `/pages/${pageId}` — mechanical, mirrors the backend route
  change file-for-file. `exports`/`jobs` methods untouched (project/global-scoped).
- `apps/web/src/stores/projectStore.ts` — added `currentPageId` + `setCurrentPageId`,
  which also clears `selectedId` (a selection from the previous page is meaningless
  after switching).
- `apps/web/src/pages/ProjectWorkspace.tsx` — loads `listPages` on mount and defaults
  to the first page; every data-loading effect and handler now depends on/passes
  `currentPageId`; switching pages resets `asset`/`detections`/`activeVersion`/
  `versionList`/`boundary`/`approval` before reloading that page's own data. Renders
  `<PagesStrip>` between `<WorkspaceToolbar>` and `<StatusBar>`. No changes needed to
  `WorkspaceBody`/`CanvasPanel`/`UITreePanel`/`InspectorPanel`/`CodePanel`/
  `PreviewPane` — they all already consume page-shaped state.
- `apps/web/src/features/detection/useDetectionJob.ts` — `start()` gained a `pageId`
  parameter to match `api.startDetection`'s new signature.
- `scripts/src/evaluate.ts` — added a stub `pageId` to the synthetic in-memory
  `Detection` it builds for evaluation (not persisted); `Detection` gaining a
  required `pageId` field broke this construction site independently of the
  frontend work, caught by `npm run typecheck -w scripts` during full regression.
- `PROJECT_STATUS.md` — §2.10 added (Phase D3 summary); TL;DR, §4.2, and §6 updated
  to mark multi-page done.

### Verification — full regression, run fresh with the frontend changes present
| Command | Result |
|---|---|
| `npm run typecheck` | clean (web, api, scripts) |
| `npm run test` | 124 (shared-types) + 241 passed / 16 skipped (`apps/api` — Prisma contract arms skip cleanly, no reachable test database) |
| `npm run test:py` | 19 passed |
| `npm run build` | success, all 4 workspaces |
| `npm run test:e2e` | 4 passed — golden path, both Inspector-overrides specs, and the new multi-page spec |

The multi-page e2e spec doubles as the manual regression walkthrough the handoff
file's step 7 called for (independent per-page state, correct export bundle
contents, the cross-page-link claim) — run against the real API/web/mock-CV-worker
stack, not mocked at the HTTP layer. The one item from that walkthrough not
exercised here is opening a genuinely pre-D3 project and confirming the JSON-store
backfill shows it with exactly one page — there is no pre-D3 `store.json` in this
environment to open (see Phase D1/D2's entries, same gap), so that path is covered
only by `backfillPages()`'s own unit coverage, not a live walkthrough.

### Known limitations
- No page reordering — `order` is assigned once at creation (`existing.length + 1`)
  and never changed; a page can be renamed or deleted but not moved.
- No per-page thumbnail/preview in `PagesStrip` — pages are distinguished by name
  only, which is fine at small page counts but would get harder to scan with many
  pages.
- Deleting a page is a hard delete of everything on it (assets, detections, code
  versions, corrections) with no undo — mitigated only by the confirm dialog.

### Next phase
D4 — CI/CD, per the deadline plan's sequencing (see §6 of `PROJECT_STATUS.md`).

---

## Phase D4 — CI/CD (Deadline Execution Plan)

**Date:** 2026-08-25
**Goal:** A minimal automated quality gate, per
`Sketch2UI_Deadline_4_Features_Claude_Code_Execution_Plan.md` §7: typecheck, Vitest,
Pytest, a production build, and Playwright E2E, on every push/PR to `main`. No ML
training in CI, no automatic deployment.
**Status:** ✅ Complete.

### Starting state
`.github/workflows/ci.yml` already existed, but as an untouched leftover from the
repo's very first baseline commit (`4bbdc0e`, 2026-08-24) — predating Playwright/e2e
entirely. It had two real problems: an empty `services:` key under one job (YAML
parses it as `null`, not a mapping — dead weight at best), and no E2E check at all,
which is the plan's explicitly required fifth gate. `PROJECT_STATUS.md` §6 called
this "no `.github/workflows` exists yet," which undersold it slightly — the file
existed but wasn't a working gate.

### Files changed
- `.github/workflows/ci.yml` — rewritten from a two-job split (`lint-and-test` →
  `build`, each re-running its own checkout/setup-node/npm ci) into a **single
  linear job** matching the plan's own §7.1 diagram exactly: checkout → setup Node →
  `npm ci` → typecheck → Vitest → setup Python → Pytest → production build →
  Playwright E2E. Added `npx playwright install-deps` (OS shared libraries only, no
  browser download — see below) and a failure-only Playwright report/trace upload
  (`actions/upload-artifact`, 7-day retention) as the one addition beyond the plan's
  literal five checks.
- `PROJECT_STATUS.md` — §2.11 added; TL;DR, §4.5, and §6 updated to mark CI/CD done.

### Design decisions
- **One job, not two.** The removed two-job split bought nothing here (no artifacts
  passed between jobs, no genuine parallelism since `build` already `needs:
  lint-and-test`) while paying for a second checkout + `npm ci`. A single job also
  matches §7.1's literal unbranched chain.
- **No "build shared packages" pre-step.** `packages/shared-types` and
  `packages/codegen` both set `"main"/"types": "./src/index.ts"` — every consumer
  (`apps/api`'s plain `tsconfig.json`, `apps/web`'s `tsconfig.app.json`, both using
  `moduleResolution: "Bundler"`, plus Vite/tsx at runtime) resolves them straight
  from TypeScript source, with no project references. Typecheck/Vitest/Playwright
  never needed those packages prebuilt; the old draft's explicit build step before
  typecheck was dead weight, and `npm run build` later in the same job already
  builds them for the production-build check.
- **No CI-specific test isolation logic was added**, because none was needed:
  `apps/api/vitest.setup.ts` already unconditionally redirects `STORE_FILE` to a
  fresh temp path (with a hard assertion the redirect took) before any Vitest file
  loads, and `playwright.config.ts`'s `webServer` array already points every service
  at a fresh `fs.mkdtempSync` directory. `DATABASE_URL`/`REDIS_URL` are simply never
  set in the workflow, so Prisma contract-test arms skip cleanly (see Verification)
  — this is what "never connect to the real dev database, never use development
  credentials" resolves to in practice: not writing any Postgres/Redis config at all.
- **`services/cv-worker/requirements.txt` installed in full** (torch, ultralytics,
  fastapi, the works), even though the one existing Pytest file
  (`test_boundary_parity.py`) only imports a pure-Python module and would run fine
  with just `pytest` installed. Kept the full install rather than a trimmed
  test-only requirements file — matches "use the exact existing project commands"
  and won't silently need updating the moment a heavier test is added.
- **Python 3.11 in CI**, not 3.9.6 (the version this repo's local `.venv` happens to
  use). `requirements.txt`'s own header comment states "Python 3.9+" — a floor, not
  a ceiling — and torch 2.8.0 publishes wheels through newer Python versions, so
  there's no reason to pin CI to an old dev-machine interpreter.
- **`channel: "chrome"` in `playwright.config.ts` is a pre-existing choice**, made
  because the sandboxed dev box this was authored in can't reach Playwright's
  browser-binary CDN, so the config uses system-installed Google Chrome instead of a
  Playwright-managed download. `ubuntu-latest` GitHub-hosted runners ship Google
  Chrome pre-installed (documented in `actions/runner-images`), so this carries over
  to CI unmodified — the workflow only needs `npx playwright install-deps` (OS
  shared libraries headless Chrome needs; no browser binary download), not
  `playwright install <browser>`.

### Verification
| Command | Result |
|---|---|
| YAML parse (`python3 -c "yaml.safe_load(...)"`) | valid — the old file's empty `services:` key is exactly the class of mistake this would have caught |
| `npm run typecheck` | clean (web, api, scripts) |
| `npm run test` | 124 (shared-types) + 241 passed / 16 skipped (`apps/api` — Prisma contract arms skip cleanly, no `DATABASE_URL` set, confirming the "never touch dev Postgres" property holds with zero extra CI config) |
| `npm run test:py` | 19 passed |
| `npm run build` | success, all 4 workspaces |
| `npm run test:e2e` | 4 passed — golden path, both Inspector-overrides specs, multi-page |

Every command in the workflow is copy-pasted verbatim from this table — nothing
CI-specific was invented. What could **not** be verified from here: the actual
GitHub Actions runner was never executed (no push/PR was made), so the workflow's
correctness beyond YAML validity rests on (a) every step being a command that just
ran green locally, and (b) the documented fact that `ubuntu-latest` ships Chrome
pre-installed. The first real PR against `main` after this lands is the actual
proof; watch that one.

### Known limitations
- No matrix/parallelization across Node or OS versions — a single Ubuntu/Node-20
  run is the entire gate.
- No branch-protection rule was configured to require this check before merge (a
  repo-settings change, not a workflow-file change) — the workflow runs and reports
  status, but nothing yet blocks a merge on it failing.
- No deployment automation of any kind, per the plan's explicit scope.

### Next phase
D5 — Final Integration, per the deadline plan's sequencing (a cross-cutting
regression pass over D1–D4 together, not new feature work).

---

## Phase D5 — Final Integration (Deadline Execution Plan)

**Date:** 2026-08-26
**Goal:** A cross-cutting regression pass over D1–D4 together, per
`Sketch2UI_Deadline_4_Features_Claude_Code_Execution_Plan.md` §8/§9 — not new
feature work. Walk the plan's regression matrix (Authentication, Detection,
Multi-page, Core, CI) against the actual running stack rather than only trusting
automated coverage in isolation.
**Status:** ✅ Complete.

### Approach
All three services (`apps/web`, `apps/api`, `services/cv-worker`) were started for
real — the first time in this environment that `services/cv-worker` has ever been
run outside of its own Pytest suite or the E2E suite's *mocked* stand-in
(`e2e/mock-cv-worker.ts`). This is the one thing no existing automated test proves:
that the real model, loaded from real weights, actually answers real HTTP requests
end to end.

The Browser-pane's `computer` tool's synthetic mouse clicks did not register on
React event handlers in this environment (coordinate- and ref-based clicks both
silently no-op'd on a real, enabled, on-screen button — confirmed via direct DOM
inspection that the element existed, was enabled, and sat exactly where the click
landed). Dispatching `.click()` on the element via `javascript_tool` worked
immediately. Root cause not pursued further since a reliable path existed; noted
here in case it recurs. Separately, injecting a file into a hidden
`<input type="file">` via a hand-built `DataTransfer`/`File` in `javascript_tool`
silently truncated the payload (a 1366-byte fixture arrived as 862 bytes,
producing a real `INVALID_IMAGE` rejection from the CV worker's `PIL.Image.verify()`
decode-check) — traced to the long base64 string itself being truncated in transit
through the tool call, not to any app code. Both are testing-harness artifacts, not
product bugs; documented so a future session doesn't waste time treating them as
regressions. Once diagnosed, verification switched to direct authenticated `curl`
calls against `apps/api` (same session-cookie auth flow the browser uses) with real
files from `ml/dataset/images/test/` — arguably a *more* rigorous check of the HTTP
contract than clicking through the UI, since it exercises the exact request/response
shapes without a browser in between.

### What was verified live, against the real stack
**Authentication** — register → auto-login → Dashboard (via real browser
interaction, correctly empty/scoped to the new account); logout (`204`, session
revoked); a protected route after logout (`GET /api/projects` and `GET
/api/projects/:id` both `401 UNAUTHENTICATED`); a second, unrelated user
registered and pointed at the first user's project — `GET`, `PATCH`, and `DELETE`
all returned `404 NOT_FOUND` (not `403`, matching the existence-enumeration-avoidance
design from Phase D1), and the second user's own project list showed zero leakage.

**Detection (real model, not mocked)** — uploaded a real image from
`ml/dataset/images/test/` (a wireframe the model was actually trained/evaluated
against), ran `POST .../detect` against the live `services/cv-worker`: **9
detections**, high confidence (`footer` 0.989, etc.), completed in ~370ms, `v1.0.0`
loaded correctly. A second real image on a second page produced **10 independent
detections** with zero cross-contamination between pages.

**Core pipeline** — generate (real HTML/CSS emitted, `p1-navbar-7`-style ids
confirming the D3 `idPrefix` option is live, not just tested), export (ZIP
contains `styles.css` + `index.html` + real PNG crops + `README.txt` + the
original source sketch, `40124` bytes across 5 files for the single-page case).

**Multi-page** — added a second page via the real `PagesStrip` UI element and via
the API (`order: 2` assigned correctly), renamed it, uploaded+detected+generated on
it independently of Page 1, reclassed a Page 1 detection to `link` and set its
`href` to `./page-2.html` via the content-override route, regenerated, and
re-exported: the resulting ZIP contained **both** `index.html` and `page-2.html`,
**exactly one** shared `styles.css`, per-page asset crops correctly namespaced
(`assets/p1-image-8.png` vs `assets/p2-image-*.png` — the `idPrefix` feature doing
real work, not just passing a unit test), both pages' own `source-sketch-*` files,
and `index.html` contained `href="./page-2.html"` byte-for-byte — the exact claim
Phase D3's handoff flagged as "worth actually verifying" once a real UI/backend
existed to test it with. Also verified: deleting the non-last page succeeds
(`204`), and deleting the resulting last page is refused (`400
VALIDATION_FAILED`, "A project must keep at least one page").

**CI** — not re-verified here; already covered exhaustively in the Phase D4 entry
immediately above (typecheck/Vitest/Pytest/build/E2E all green, re-run fresh at
that time).

### What was NOT re-verified live here (already covered by existing automated tests)
Page boundary adjustment, hand-edited code + version activation, and the
Style/Geometry/Structure inspector groups were not re-clicked through by hand in
this pass — they're already exercised by the Vitest repository/route contract
suite (241 passing tests) and `e2e/inspector-overrides.spec.ts`'s Geometry-override
and Content-XSS specs, both of which were re-run green as part of Phase D4's
regression immediately before this phase. This pass's value was specifically the
things automated coverage *can't* prove on its own: the real (non-mocked) model
answering real requests, and genuine cross-user data isolation against a live
multi-user database — both now confirmed.

### Files changed
None — this phase is verification only, no code changes. (The `.env`/`STORE_FILE`
path fix and `services/cv-worker` launch config landed in the prior session while
starting the stack for this pass; see the D3+D4 completion commit.)

### Known limitations
- Test artifacts from this pass (`d5-regression@test.local`, `curl-cv-check@test.local`,
  `curl-cross-user@test.local` and their projects) remain in the local dev
  `apps/api/data/store.json` — harmless (isolated to local dev data, same file the
  earlier stray `test@gmail.com`/"d" project already lived in) but not cleaned up.
- The Browser-pane click-registration issue (working around it via
  `javascript_tool`'s `.click()`) was not root-caused. If a future session hits the
  same silent-no-op behavior on a different page, this entry is the pointer to the
  workaround.

### Next phase
None remaining in the deadline execution plan — D1 through D5 are all complete.
Remaining work is whatever `PROJECT_STATUS.md` §4/§6 still lists as not-started
(V2/V3 scope, durable job queue, broader test coverage, deployment automation),
none of which is part of this deadline plan's scope.

---

## SaaS transformation (Phases D0, S1–S14)

**Date:** 2026-08-26 (one session, following D1–D5 above).
**Source brief:** a separate SaaS-transformation instruction set ("turn Sketch2UI
into a public marketing site + user app + admin dashboard"), executed one phase at
a time with a stop-and-report after each. Its own phase numbering (D0–D14) collided
with this log's existing D1–D5 entries above, so every phase in this section is
prefixed `S` instead (`S1` = the brief's own `D1`, etc.) — D0 kept its name since
nothing above used it. Each subsection below is what a code comment means when it
says "see phase-log.md's Phase SN entry" — kept together as one dated entry rather
than fifteen separate top-level ones, since they're one continuous session with one
shared verification trail, not independent efforts spread over time.

**Non-negotiables honored throughout** (per the brief's own repeated instructions,
cross-checked against this project's existing architecture before any code was
written): PostgreSQL/Prisma/the repository layer were never replaced, the detection
pipeline and codegen were never touched, and no phase implemented anything without
first checking whether it already existed.

### Phase D0 — SaaS architecture audit
Read-only inspection, no code changed. Produced a 14-point report (routes, auth
architecture, Prisma models, repository structure, admin capability [none existed],
API authorization pattern, migration risks) directly in conversation rather than a
new doc file. Found: auth/ownership/multi-page were already complete (D1/D3 above);
zero admin functionality anywhere; the phase-numbering collision noted above; and a
real discrepancy — `PROJECT_STATUS.md` §2.7 claims `PERSISTENCE_DRIVER=postgres`,
but the actual `.env` on disk has `PERSISTENCE_DRIVER=json`. That discrepancy was
never resolved this session (see "Known limitations" at the end of this entry) —
every phase below ran against the JSON adapter as a result.

### Phase S1 — Database ownership/integrity audit
D0 found the ownership pattern (`requireProjectOwnership`/`requirePageInProject`,
404-not-403) already correct everywhere but only incidentally tested. Added
`apps/api/src/modules/__tests__/cross-user-security.test.ts` (7 tests: project
PATCH/DELETE cross-user → 404, unauthenticated → 401, page cross-user → 404, job
cross-user → 404) as dedicated, explicit proof rather than relying on other
modules' tests to demonstrate it as a side effect. All 7 passed on first run — this
phase found no bug, only closed a test-coverage gap. Skipped E2E (test-only change,
no request-path behavior moved).

### Phase S2 — Authentication integration
No-op. D0 already confirmed auth (register/login/logout/session/ownership) was
fully built in Phase D1 above; nothing to add.

### Phase S3 — Public marketing website
Greenfield. User chose (via AskUserQuestion) to move the authenticated app from `/`
and `/projects/:id` to `/app` and `/app/projects/:id`, freeing `/` for a real
homepage — the brief's own target structure. New: `apps/web/src/pages/Home.tsx`
(hero, product-demo pipeline strip, how-it-works, core features, why-Sketch2UI,
multi-page workflow, supported-components taxonomy pulled from the real
`packages/shared-types/src/taxonomy.ts`, technology/trust section),
`Pricing.tsx` (three tiers, explicitly labeled "Not live" — no billing exists),
`MarketingHeader.tsx`/`MarketingFooter.tsx` (auth-status-aware CTAs), `LinkButton.tsx`
(a `<Link>` styled like `Button`, needed because CTAs must be real anchors, not
click-handlers — required exporting `Button`'s class recipe as
`BUTTON_SIZE_CLASSES`/`BUTTON_VARIANT_CLASSES`). Updated every internal route
reference for the `/app` move (`App.tsx`, `AppHeader.tsx`, `WorkspaceToolbar.tsx`,
`WorkspaceUnavailable.tsx`, `Login.tsx`, `Register.tsx`, `Dashboard.tsx`) and all 5
existing e2e files' hard-coded paths. Added `e2e/marketing.spec.ts` (4 tests).
Deliberately scoped to `/` and `/pricing` only — no standalone `/features` or
`/how-it-works` routes (in-page anchors instead), no `/about`/`/contact` (no real
company/support content to put there). Found and fixed two real bugs during manual
browser review before calling it done: the footer's "Log in" link ignored auth
status, and the 5-item pipeline strip had an awkward 2-2-1 layout at tablet widths.
Verification: typecheck/build clean; full Playwright suite (10/10, the 6 pre-existing
specs plus 4 new) green, proving the `/app` move broke nothing.

### Phase S4 — User application shell
Added persistent nav to `AppHeader.tsx` (Projects/Account, active-state highlighted)
and a new minimal `Account.tsx` page (email, member-since date — no password-change
field, since the auth backend has no such endpoint to wire it to). Adapted rather
than copied literally: "Dashboard" and "Projects" collapsed into one nav link (same
screen, no separate route), "Templates" skipped (not implemented), the "profile
menu" is flat inline controls, not a dropdown (no such component existed in this
app yet, and building one for a two-item menu was judged more risk than value).
New `e2e/account.spec.ts` (2 tests). Full suite 12/12 green.

### Phase S5 — Dashboard/project management
Audited Phase 4 of the brief's checklist against what already existed — everything
was already built except **rename**, which the API supported
(`PATCH /api/projects/:id`) but no UI ever exposed. Added `api.renameProject()`,
click-to-edit rename on both the Dashboard project card and the Workspace toolbar
title (mirroring `PagesStrip.tsx`'s existing page-rename interaction rather than
inventing a new pattern). New `e2e/project-rename.spec.ts` (2 tests). Found and
fixed a real, pre-existing bug along the way: Playwright's spawned API server never
got `NODE_ENV=test`, so the real DEF-009 rate limiter was silently active against
the whole e2e suite the entire time — harmless until this phase's new
registration-heavy specs pushed the per-run total over the limit and started
intermittently 429-ing a registration mid-suite. Fixed in `playwright.config.ts`
by setting `NODE_ENV: "test"` on the spawned process, matching the bypass
`rateLimiter.ts` already documented as the intended behavior for automated tests.
Full suite 14/14 green, run twice to confirm the flake was gone.

### Phase S6 — Admin shell
Greenfield — D0 found zero admin functionality anywhere. Backend:
`requireAdmin.ts` middleware (403 `FORBIDDEN`, not the ownership-style 404 — this
is a route-level role check, not a per-resource ownership check, so there's
nothing to hide behind an existence-enumeration excuse), `modules/admin/admin.routes.ts`
mounted `requireAuth → requireAdmin → adminRouter` in `server.ts`, one new
repository method (`UserRepository.count()`, JSON+Prisma+contract test),
`GET /api/admin/overview` (Total Users, Total Projects, Generated Projects — real
aggregates only; deliberately excluded "Active Users" [no login-tracking field
exists], Assets/Jobs/Training counts [belong to later phases that own those
domains], "Active Model" [not a database entity]). `apps/api/scripts/promote-admin.ts`
— the sole, deliberate, out-of-band way to grant the admin role (mirrors
`backfill-legacy-owner.ts`'s shape). Frontend: `ProtectedRoute`'s new `requireAdmin`
prop (UX only — the real gate is server-side), `AdminHeader.tsx` (separate
layout/nav from `AppHeader`, per the brief's "admin ≠ user dashboard"),
`AdminOverview.tsx`, `/admin` route. New `admin.routes.test.ts` (3 HTTP-integration
tests: unauthenticated → 401, regular user → 403, admin → real counts). Manually
promoted a real dev user to admin and confirmed both directions live in the
browser. Full suite green (Vitest 273 + Playwright 14/14).

### Phase S7 — Admin Users
Read-only user list (Email, Role, Created, Project count) — deliberately no Status
column (no deactivation concept exists in this app; a column reading "Active" on
every row forever would be decoration) and no role-change control (stays the
out-of-band script). Added `UserRepository.listAll()`/`setRole()` and
`GET /api/admin/users`. A real process bug surfaced here: the first draft of the
test file reached into `db.state` directly to simulate promoting a user to admin,
which tripped `check:db-state` — that guard's zero-direct-access rule turned out to
apply to every file under `apps/api/src`, test files included, not just route
handlers. Fixed by adding `UserRepository.setRole()` as a proper repository method
instead (used by both the test and, after simplifying it, `promote-admin.ts`
itself, replacing its previous hand-rolled JSON/Postgres branching). New
`AdminUsers.tsx`, "Users" added to `AdminHeader`. Verified live: real 9-account
table with correct admin/user badges.

### Phase S8 — Admin Projects
Read-only, searchable (`?q=` on name/owner-email), filterable (`?status=`) project
list across every user, plus a detail page for the one thing a list can't show —
"inspect associated jobs" — showing that project's own job history. Deliberately
NOT gated by `requireProjectOwnership` (the wrong question for an admin, who by
definition needs to see projects they don't own) — `requireAdmin` alone is the
gate. Added `JobRepository.listByProject()`. New `AdminProjects.tsx`,
`AdminProjectDetail.tsx`, "Projects" added to nav with prefix-match active-state
(stays highlighted on `/admin/projects/:id`). 6 new HTTP-integration tests.
Live-verified: cross-user project visibility, a real project's real job history,
status filter, owner-email search all confirmed working against real data.

### Phase S9 — Admin Jobs/Models/Training
The largest single phase — three domains at once, matching the brief's own D9
grouping. `JobRepository.listAll()`, `TrainingRepository.listAll()` (JSON+Prisma+
contract tests each). `modules/admin/models.service.ts` reads the model registry
straight off disk (`ml/models/<family>/<version>/metrics.json`) — the same source
`services/cv-worker` itself loads from; "active" is determined by the exact same
`MODEL_VERSION` env var the CV worker checks (default `v1.0.0`), not a separate
admin concept that could drift from what's actually running. `GET /api/admin/jobs`
(`?status=`), `/models`, `/training` — 8 new HTTP-integration tests. Frontend:
`AdminJobs.tsx`, `AdminModels.tsx`, `AdminTraining.tsx`. Deliberate omissions,
explained rather than faked: no "Started"/"Completed" job timestamps (schema only
has createdAt/updatedAt — labeled "Last updated" instead of inventing a completion
moment), no model delete/promote controls (the brief explicitly rules this out —
promotion stays a `MODEL_VERSION` deployment change), no training-sample reject
action (no such API exists, and the brief says not to redesign the pipeline).
Live-verified against real data: an actual failed-job error message from earlier
debugging, the real trained model's real precision/recall/mAP metrics, a real
approved training sample with 19 boxes across 9 classes.

### Phase S10 — Audit Logs
The first schema change of the whole transformation — every phase before this was
additive at the application layer only. New `AuditLog` Prisma model + `AuditEvent`
enum (migration `20260826010000_add_audit_logs`, generated via
`prisma migrate diff` against schema datamodels directly — no live database
needed, same approach `add_auth`/`add_pages` used above). `AuditLogRepository` is
deliberately append-only: only `record()`/`listRecent()` exist, no update or
delete, making "audit logs should be append-oriented" a compile-time guarantee.
Wired into 6 real call sites, each an existing action, not one built just to have
something to log: `auth.routes.ts` (USER_REGISTERED/LOGIN/LOGOUT — logout resolves
the session's owner *before* deleting it), `projects.routes.ts`
(PROJECT_CREATED/DELETED), `admin.routes.ts` (PROJECT_ACCESSED_BY_ADMIN, on every
admin project-detail view), `training.routes.ts` (TRAINING_APPROVED),
`promote-admin.ts` (ADMIN_ROLE_CHANGED). Deliberately did NOT implement
MODEL_ACTIVATED from the brief's own example list — no route or script in this app
ever activates a model, so logging it would mean fabricating an event that never
fires. `GET /api/admin/audit-logs?limit=` (default 200, capped 1000 — the one
admin list that's genuinely unbounded), `AdminAuditLogs.tsx`. Live-verified: created
a real project, watched `PROJECT_CREATED` then `PROJECT_ACCESSED_BY_ADMIN` appear
with correct actor/target/metadata/timestamp within seconds.

### Phase S11 — Authorization/security tests
An audit-then-fill pass, not a from-scratch build — most of the brief's Phase 22
checklist was already covered incrementally across S1 and S6–S10. Grepped every
route test file to find the real gaps: **detections**, **code versions**, and
**exports** had zero HTTP-integration cross-user tests, despite Phase 15's
question list naming exactly those ("can a user modify another user's detection /
access another user's code version / download another user's export?"). New
`apps/api/src/modules/__tests__/security-authorization.test.ts` (14 tests: the
three gaps above, plus a complete unauthenticated-401 sweep across all 7 admin
routes). All 14 passed first try — this phase proved already-correct code, it
didn't fix a bug.

### Phase S12 — Full E2E
The brief names three E2E journeys; PUBLIC (`marketing.spec.ts`) and USER
(`golden-path.spec.ts` etc.) were already automated. ADMIN had only manual
verification. Since role changes are deliberately never route-driven, a known
admin account is now seeded synchronously in `playwright.config.ts` itself —
written to the isolated store *before* the spawned API server boots (the JSON
store loads once at startup; promoting a user after boot would write to a file the
running process never re-reads). Credentials/hashing live in a separate
`e2e/admin-seed.ts` so the test file importing them doesn't re-trigger the
config's own setup side effects. New `e2e/admin.spec.ts` (2 tests): the full
Overview → Users → Projects → project detail → Jobs → Models → Training Data →
Audit Logs walk with real cross-account data, plus a non-admin-refused check. Two
real bugs found while writing it: the test tried to log out from inside
ProjectWorkspace (no logout button there — only `AppHeader`-mounted pages have
one), and the audit-log assertions initially assumed an empty log, when it's
actually global and persistent across the whole Playwright run (fixed by filtering
on this test's own unique identifiers, not exact counts). Two complete clean full-
suite runs (14/14, then 16/16); later reruns hit Chrome launch timeouts traced via
`ps aux` to the *user's own* 37-process Chrome session (zero Playwright-owned
processes involved) — not a code issue, so no further action taken.

### Phase S13 — Visual QA
A dedicated pass hunting for real defects, not re-confirming what earlier phases
already checked. Static grep for stray hex colors/non-token spacing across every
new file — clean. Two real bugs found and fixed: `AdminHeader` broke at tablet
width (768px) — seven nav items plus brand/badge/exit/email/logout had no overflow
strategy, so flex-shrink squeezed link text until it wrapped mid-phrase; fixed with
`whitespace-nowrap` + `overflow-x-auto` (a scrollable single row, not a hamburger
menu, matching the brief's "desktop-first, responsive enough for basic management"
bar). More seriously: every admin table (6 pages) used `overflow-hidden` on its
`Card` wrapper for rounded-corner clipping, which also clipped the table's own
horizontal overflow — on narrow viewports this made entire columns (Status,
Created, Error, ...) not just visually cramped but completely unreachable, no
scroll possible. Fixed by wrapping each `<table>` in its own inner
`overflow-x-auto` div. Verified the fix by actually scrolling to and reading data
that was previously inaccessible, not just checking it looked better. Full suite
green (Vitest 124+330, Playwright 16/16).

### Phase S14 — Feature freeze
This entry, plus a `PROJECT_STATUS.md` update (§7) and a fix to
`docs/frontend/information-architecture.md`'s route table, which had gone stale
back at Phase D0 (predating Phase D1's auth routes, let alone this transformation)
and was never corrected until now. Final regression baseline: `npm run typecheck`,
`npm run check:db-state`, and the full Vitest suite all clean immediately before
this entry was written.

### Files changed (cumulative, D0–S14)
See each phase's own paragraph above for the specific list — repeating all of them
here would just duplicate what's already written a few lines up. In aggregate:
~40 new frontend files (marketing site, admin shell + 7 admin pages, Account),
~15 new/modified backend files (admin routes, models service, 3 new repository
domains' worth of methods across `users`/`jobs`/`training`/a new `auditLogs`),
one new Prisma migration, ~10 new test files (Vitest + Playwright), zero changes
to the detection pipeline, codegen, or the repository abstraction's existing
contracts.

### Verification (cumulative)
Every phase above ran its own typecheck + build + relevant test subset before
being called done; this entry's own final pass (immediately before writing it) was
`npm run typecheck` (clean), `npm run check:db-state` (clean, 0 remaining), full
Vitest (`packages/shared-types` 124 + `apps/api` 330 passing, 17 skipped Prisma
arms — no `DATABASE_URL` locally, expected), and Playwright (two independent clean
full-suite runs during S12/S13, 16/16 both times).

### Known limitations
- **The `PERSISTENCE_DRIVER` discrepancy from Phase D0 was never resolved.**
  `PROJECT_STATUS.md` §2.7 says postgres; the actual `.env` on disk says `json`.
  Every phase in this transformation — including the new `AuditLog` table and its
  migration — was built and verified against the JSON adapter (with Prisma
  contract-test parity, per the existing convention, but not live-verified against
  a running Postgres instance the way Phase 8 originally was). Confirm which
  driver is actually intended before deploying, and if postgres, run
  `prisma migrate deploy` for `20260826010000_add_audit_logs` first.
- **`AdminHeader` has no mobile-optimized nav** — Phase S13 made it scroll
  cleanly instead of breaking, which meets the brief's "responsive enough for
  basic management" bar, but there's no collapsed/hamburger treatment. Not
  attempted deliberately (see that phase's note) — would be new scope, not a fix.
- **No admin capability beyond what D6–D10 (S6–S10) built**: no user
  deactivation, no in-UI role changes, no model promote/delete, no training-sample
  reject — every one of these was deliberately scoped out because the brief itself
  says not to build them without a clear "if required," and none of the underlying
  APIs exist to wire a button to. Revisit only on an explicit ask.
- Test artifacts from this session's manual browser verification
  (`admin-s7-test@example.com`, `nonadmin-s6-test@example.com`, a handful of
  "Audit Log Live Test"/"Renamed via S5"-named projects, etc.) remain in the local
  dev `apps/api/data/store.json` — same harmless, not-cleaned-up pattern the D5
  entry above already noted for its own test accounts.

### Next phase
None remaining in this SaaS-transformation brief — D0 and S1 through S14 are all
complete. Remaining open items are the ones already listed in
`PROJECT_STATUS.md` §6 (more labeled training data, a durable job queue, broader
component-level test coverage) plus the two new ones this section's "Known
limitations" names above (the persistence-driver discrepancy, admin mobile nav).
