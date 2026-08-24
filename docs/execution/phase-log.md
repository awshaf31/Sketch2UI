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


