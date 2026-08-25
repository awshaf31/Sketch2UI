---
title: "Sketch2UI — Project Status: Done / In Progress / Not Started"
based_on: "Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md"
status_as_of: "2026-08-25"
---

# Sketch2UI — Detailed Project Status

This document maps the actual state of the codebase against the 54-section
implementation plan (`Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md`).
Every claim below was verified against the current source tree, not assumed from
memory — file paths and route registrations are named so they can be checked directly.

---

## 1. TL;DR

| Layer | Status |
|---|---|
| Core pipeline (sketch → detect → correct → generate → preview → export) | **Done, working end-to-end** |
| Style + Content + Detection + Geometry + Structure inspector (§17.3, all 5 groups) | **Done** |
| Code editor (hand-edit HTML/CSS, versioned) | **Done** |
| Correction history / audit log | **Done** — every class/bbox/parent/order change is recorded (§4 execution plan Phase 4) |
| YOLO detector | **Working but explicitly a smoke test** (156 images, 16/41 classes) |
| Persistence | **PostgreSQL via Prisma — fully migrated and live** (Phase 8; JSON store retired as of 2026-08-25). Every domain (projects, assets, detections, boundaries, code versions, the four override groups, training/corrections, exports, jobs) is behind a repository layer with JSON+Prisma adapters proven equivalent by a shared contract-test suite (see `docs/execution/phase-8-architecture-amendment.md` and `docs/execution/phase-log.md`). |
| Background jobs | **In-process execution, Postgres-backed persistence** — durable across restarts and orphan-reaped on startup; execution substrate is still in-process, not Redis/BullMQ (a deliberate, documented deferral — see phase-log.md's Jobs entry) |
| E2E test coverage | **Three Playwright suites** — `e2e/golden-path.spec.ts` (create → upload → detect (mocked) → correct → generate → preview → export), `e2e/inspector-overrides.spec.ts` (Geometry override + Content XSS rejection), and `e2e/multi-page.spec.ts` (a second page with independent state, cross-page link, multi-page export bundle), all against isolated throwaway storage |
| Frontend design system | **Done** (Phase 2, 2026-08-25) — token system, primitive component library, rebuilt workspace shell, restyled canvas/tree/Inspector/code panel/preview, responsive (desktop/tablet/mobile) + keyboard/ARIA coverage. See `docs/frontend/README.md` (spec) and `docs/execution/phase-log.md` Phases 10–20 (implementation record). Zero behavior changes — same detection/override/codegen/persistence this table describes throughout, just restyled and reorganized. |
| Auth / accounts | **Done** (Phase D1, 2026-08-25) — email/password registration, HTTP-only session cookies, `Project.ownerId`, and authorization enforced on every project-scoped route (see §2.9 and `docs/execution/phase-log.md`'s Phase D1 entry) |
| Multi-page projects | **Done** (Phase D3, 2026-08-25) — a project now owns a `Page[]`; every project-scoped resource is page-scoped, and export bundles every page into one ZIP (see §2.10) |
| CI/CD | **Done** (Phase D4, 2026-08-25) — `.github/workflows/ci.yml` runs typecheck, Vitest, Pytest, a production build, and Playwright E2E on every push/PR to `main`, against isolated throwaway storage with no dev database or credentials touched (see §2.11) |
| React/Tailwind export, design tokens, themes | **Not started** (V2 scope) |
| Everything V3 (layout transformer, OCR, active learning ML) | **Not started** |

The project is a working single-user prototype that implements the plan's MVP and a
meaningful slice of V1, now running entirely on PostgreSQL. The computer-vision model
is the one piece that is explicitly **not** production-grade yet, and the codebase says
so itself (`ml/models/ui-detector/v1.0.0/metrics.json` calls it a `"smoke_test"`).

---

## 2. What's DONE

### 2.1 Core pipeline (plan §51 steps 1–12 — "practical build order")

All 12 steps are implemented and wired together:

1. **Project CRUD** — `apps/api/src/modules/projects/projects.routes.ts`. Create/list/get/patch/delete, scoped to the authenticated caller's `ownerId` since Phase D1 (see §2.9).
2. **Image upload** — `apps/api/src/modules/assets/assets.routes.ts`. Validates file type/size/decode, stores to `data/uploads/`.
3. **Annotation canvas** — `apps/web/src/features/annotation/AnnotationCanvas.tsx` + `ClassPicker.tsx`. Draw boxes, pick a class, drag/resize/delete. This is the manual detection path and also the dataset-labeling tool.
4. **Page boundary** — `apps/api/src/modules/boundaries/`, `packages/shared-types/src/boundary-geometry.ts`, `apps/web/src/features/detection/PageBoundaryOverlay.tsx`. Auto-detected via the CV worker OR manually dragged; boxes outside the boundary are filtered client-side with live re-partitioning as the boundary moves (§10.4).
5. **YOLO detection** — `services/cv-worker` (Python/FastAPI), triggered via `apps/api/src/modules/detections/detect.job.ts` (runs in-process, not queued). Model boxes render dashed purple in the canvas, labeled "Beta."
6. **Detection correction** — `apps/api/src/modules/detections/detections.routes.ts`. Editing a model detection flips its `source` to `manual` so a later re-detect can't silently overwrite the correction.
7. **Layout reconstruction (UI-IR)** — `packages/codegen/src/layout.ts`. Detections → semantic tree: parent inference by bbox containment, reading-order via row grouping, repeated-sibling grouping into synthetic grid containers, and duplicate-detection suppression via IoU (documented with real measured thresholds from actual detector output, not assumed values).
8. **HTML generation** — `packages/codegen/src/html.ts`. Per-type tag mapping, semantic tags over absolute-positioned divs, escaped content, accessible attributes (alt text, aria-labels).
9. **CSS generation** — `packages/codegen/src/css.ts`. Token system, flex/grid/stack inference, mobile responsive fallback, component-class base styles.
10. **Live preview** — `apps/web/src/features/preview/PreviewPane.tsx`. Sandboxed `srcdoc` iframe, desktop/tablet/mobile viewport toggle.
11. **Code versioning** — `apps/api/src/modules/codegen/code-versions.routes.ts` + `codegen.routes.ts`. Every generation is an immutable `CodeVersion` row; `Project.activeCodeVersionId` picks which one preview/export use.
12. **Export** — `apps/api/src/modules/exports/exports.routes.ts`. Self-contained ZIP (`index.html`, `styles.css`, real image crops in `assets/`, source sketch, README), built from the *active* code version, re-downloadable from history.

### 2.2 Code editor (plan §6.9, §39 V1 — "read-only initially, then add editable mode")

- `apps/web/src/features/code/CodePanel.tsx` — Monaco editor toggles from read-only to an editable draft; explicit **Save edit** (not autosave-per-keystroke, per §6.12).
- Validation before persisting: `packages/shared-types/src/code-validation.ts` — a lightweight structural HTML/CSS parser (balanced tags, balanced braces, duplicate-id detection). The **same validator** runs in three places: the browser (instant feedback), the API (before persisting), and `scripts/src/evaluate.ts` (the §21 eval harness) — one implementation, not three that could drift.
- A saved hand-edit creates a **new** `CodeVersion` with `source: "edited"` — never mutates an existing row. `PUT /code-versions/:id/activate` lets a user switch which version preview/export use, including reverting to an older generated version.
- Verified end-to-end against a live API: edit → save → new version → export ZIP contains the edited text; activating an older version correctly switches both preview and export.

### 2.3 Style inspector (plan §6.7 / §17.3 — Style group)

- `packages/codegen/src/style-overrides.ts` — `applyStyleOverrides()`, folds manual per-node style onto the auto-inferred tree.
- `packages/codegen/src/css.ts` emits override rules (`#node-id { ... }`) **after** the layout blocks, so a manual override wins the cascade without stripping the parent grid/flex the element still depends on.
- Overrides are keyed on **detection UUID**, not UI-IR node id — node ids are assigned from a per-generation counter that shifts whenever detections change, but the detection UUID is stable.
- `apps/api/src/modules/style-overrides/style-overrides.routes.ts` — GET/PUT/DELETE, with a hard allowlist of the six §17.3 properties (`display`, `gap`, `padding`, `margin`, `font-size`, `text-align`) and character-set validation against CSS injection.
- `apps/web/src/features/inspector/InspectorPanel.tsx` — debounce-then-explicit-Apply UX (§6.12), dirty indicator, Reset.
- Applying a style change goes through the normal generate-code path, producing a `source: "generated"` version — reuses the version-activation/preview/export machinery with zero new plumbing needed there. Verified live.

### 2.4 Content inspector (plan §17.3 Content group, Appendix Q)

- `packages/shared-types/src/content-override.ts` — `ContentOverride { text?, altText?, href?, contentState }`, `contentState: "known" | "unknown" | "user-edited"`, plus a `CONTENT_APPLICABILITY` table mapping UI class → which fields make sense (text/heading/link accept `text`; image/avatar/logo accept `altText`; link/logo accept `href`).
- `packages/codegen/src/content-overrides.ts` — same fold-onto-matching-detection shape as style overrides.
- `apps/api/src/modules/content-overrides/content-overrides.routes.ts` — validation is stricter than style overrides because text/href become an HTML injection surface:
  - Rejects `<`/`>` in text/alt (script-tag injection blocked, verified live)
  - `href` scheme allowlist: `http`, `https`, `mailto`, `tel`, or a relative/fragment path — `javascript:` and `data:` explicitly rejected (verified live)
  - An override on a class the field doesn't apply to (e.g. `text` on a `card` container) is a **400**, by deliberate choice, not a silent no-op — documented in the route file
- `InspectorPanel.tsx` Content section only renders the fields applicable to the selected node's class.
- Verified live end-to-end: placeholder → edit → regenerate → export ZIP contains edited text → delete override → placeholder returns.

### 2.5 Dataset / ML tooling (plan §9, §22, §36)

- `scripts/src/export-yolo-dataset.ts` — converts annotation-canvas boxes into YOLO-format labels, regenerates `classes.txt` from the taxonomy, prints per-class counts and flags underrepresented classes.
- `scripts/src/import-external-datasets.ts` — merges two CC BY 4.0 external wireframe datasets.
- `scripts/src/build-v1-subset.ts` — carved a 16-class training-ready subset (`ml/dataset/v1/`) out of the full 41-class taxonomy for the first trainable model.
- `scripts/src/active-learning-report.ts` (§36) — ranks which sketches most need correction attention next.
- `scripts/src/evaluate.ts` (§21) — writes `docs/eval/baseline-<version>.json`, the regression benchmark future model versions get compared against.
- "Approve for training" (`apps/api/src/modules/training/training.routes.ts`) — explicit human approval snapshots a sketch's current boxes as ground truth; feeds back into `export:dataset` as a `corr_`-prefixed sample.
- **Page boundary and boundary-overlap logic is implemented TWICE on purpose** (TypeScript in `packages/shared-types/src/boundary-geometry.ts` and Python in `services/cv-worker/app/preprocessing/boundary_filter.py`) because it has to run in both languages. A shared fixture (`packages/shared-types/fixtures/boundary-overlap-parity.json`) is tested against **both** implementations (`npm run test` and `npm run test:py`) so they can't silently drift apart — verified by deliberately perturbing one side and confirming 12 of 19 cases fail.

### 2.6 Testing

- `npm run test` (Vitest) — 124 passing tests in `packages/shared-types`, 386 in `apps/api` (includes ~280 repository contract tests run against **both** the JSON and Prisma adapters — the same assertions, proving the two are behaviourally equivalent).
- `npm run test:py` (Pytest) — the Python side of the boundary-parity fixture, `services/cv-worker/tests/`, 19 passing.
- `npm run test:e2e` (Playwright) — one golden-path browser test (`e2e/golden-path.spec.ts`): create project → upload → detect (mocked CV worker) → correct a detection → generate → preview → export ZIP. Runs against isolated throwaway storage on dedicated ports; never touches real dev data.
- No React component tests beyond the E2E suite (plan §20 names Playwright and RTL; RTL/unit-level component tests are still not present).

### 2.7 Persistence migration (Phase 8 — complete)

- **Repository layer**: `apps/api/src/repositories/` defines one contract interface per domain (`types.ts`), with `json/` and `prisma/` adapters for each. `apps/api/src/repositories/index.ts` is the single factory (`getRepositories()`) every route imports from — no module reaches into `db.state` or `@prisma/client` directly. Enforced by a static guard (`npm run check:db-state`), which currently reports **zero** direct-store-access occurrences across all 20 application modules, locked in as the permanent regression floor.
- **Domains migrated**: projects, assets, detections (owns the model→manual flip, `originalClassName` capture, `clearModelDetections` idempotency), page boundaries (owns the sticky-correction rule), code versions (immutable, transactional version numbering), the four inspector override groups, training samples, correction history, exports, and jobs.
- **PostgreSQL cutover**: `PERSISTENCE_DRIVER=postgres` is set in `.env`; the JSON store (`apps/api/data/store.json`) is no longer read or written at runtime. Verified live: full 15-step regression checklist run against the real dev Postgres database, including real CV-worker inference, with before/after row counts confirming every write landed in Postgres and the JSON file's mtime proving it was untouched throughout.
- **Contract tests**: every repository has a shared contract (`apps/api/src/repositories/__tests__/*.contract.ts`) executed identically against the JSON adapter and against a real Postgres test database (`sketch2ui_test`, isolated from dev by `vitest.setup.ts`'s guards).
- See `docs/execution/phase-log.md` for the full per-domain migration log and `docs/execution/phase-8-architecture-amendment.md` for why a repository layer was needed at all (the JSON store's `db.state` was a synchronous mutable object graph, not the swappable abstraction the original plan assumed).

### 2.8 Frontend design system redesign (Phase 2 — complete)

A full audit-then-redesign of `apps/web`'s frontend, run as its own numbered
sub-plan (Phases 2A–2K, logged as `docs/execution/phase-log.md` Phases 10–20)
separate from the backend/persistence work above. **Zero behavior change** — every
detection/override/codegen/persistence/export behavior this document describes is
identical before and after; only the frontend's visual system, component structure,
and responsive/accessibility coverage changed.

- **Design specification**: `docs/frontend/` — direction, design tokens,
  information architecture, per-screen specs (Dashboard, Workspace, Canvas,
  Inspector, Code/Preview), component specification, responsive strategy,
  accessibility strategy, and a design-to-code mapping, written before any
  implementation began.
- **Foundation**: a real token system (`apps/web/tailwind.config.js` — colors,
  type scale, spacing, radius, shadows, motion) and a primitive component library
  (`apps/web/src/components/` — Button, Input, Select, Field, Tabs, Badge, Tooltip,
  Panel, Card, EmptyState, ErrorState, Dialog, Toast, Drawer, and more).
- **Workspace rebuilt**: the old 3-column layout (canvas / tree+inspector sharing a
  column / a fixed 480px right column) became a 4-region shell (Layers / Canvas /
  Inspector / a bottom Code+Preview dock), with the four old stacked status banners
  consolidated into one fixed-height status bar.
- **Canvas**: restyled onto tokens with zero changes to its pointer-math (draw/move/
  resize coordinate transforms untouched); gained zoom/pan/fit-to-screen and an
  on-canvas color legend (previously undocumented outside code comments); gained
  keyboard support (arrow-key nudge of the selected detection, Tab-reachable
  detections via native focus order).
- **Inspector**: its six sections became a collapsible accordion while every
  handler, validator, and the `EMPTY_STYLE_OVERRIDE` reference-identity contract
  were preserved exactly — verified by direct code comparison, not just by tests
  passing.
- **Code panel**: Monaco's theme flipped from a hardcoded dark theme to light
  (previously the one permanently-dark surface in an all-light app); the
  `validateGeneratedCode()` save gate is unchanged and was verified live (typed an
  unbalanced tag, confirmed the save was blocked with the exact validator message).
- **Preview**: frame chrome, a loading indicator, and an empty state added; the
  `sandbox=""` iframe attribute and `srcDoc` composition were explicitly treated as
  a hard gate and checked three independent ways (source `grep`, live DOM read, and
  the full e2e export flow).
- **Responsive**: desktop (full 4-region shell), tablet 768–1023px (Layers/Inspector
  become toggleable overlay drawers), and mobile <768px (a dedicated
  `WorkspaceUnavailable` screen — the full annotation editor is not attempted on a
  phone screen, by deliberate product decision, stated on screen rather than left
  as a silently-broken layout).
- **Accessibility**: keyboard nudge/selection on the canvas, keyboard expand/
  collapse on the Layers tree, `aria-label` enforced at the type level on every
  icon-only button, dialog/drawer focus handling.
- **Verification discipline**: every sub-phase ran `typecheck` + `build` + Vitest +
  both e2e suites before being called complete; two deliberate, tracked breaking
  changes to e2e selectors (a toolbar button rename, an accordion-collapse expand
  step) were each fixed in the same phase that introduced them. The final phase
  (2K) ran the full suite including `test:py` (not run once during the rest of
  Phase 2) and a live manual regression pass, which caught and fixed real drift in
  two components (`ClassPicker.tsx`, `UploadDropzone.tsx`) that had escaped every
  earlier phase's scope.

### 2.9 Authentication (Phase D1 — complete)

Converts the single implicit workspace into `authenticated user → owned projects →
authorized resources`, per the deadline execution plan. See
`docs/execution/phase-log.md`'s Phase D1 entry for the full file list.

- **Backend**: `User`/`Session` Prisma models (migration `20260825000000_add_auth`),
  `Project.ownerId`; a new `auth` module (`POST /api/auth/{register,login,logout}`,
  `GET /api/auth/me`) using Node's built-in `crypto.scrypt` for password hashing and
  an opaque, sha256-hashed session token in an httpOnly cookie (real server-side
  revocation on logout — not a stateless JWT).
- **Authorization**: `requireAuth` (global gate in `server.ts`) and
  `requireProjectOwnership` (one line on each of the 13 nested project-scoped
  routers) enforce ownership on every project-owned resource — projects, assets,
  detections, boundaries, code versions, all four override groups, training,
  corrections, exports, and jobs (the latter via an inline fetch-then-check, since
  `/api/jobs/:jobId` carries no project id in its own path). Ownership mismatches
  return `404`, not `403`, to avoid an existence-enumeration oracle.
- **Legacy data**: pre-auth projects are assigned to a well-known
  `legacy-owner@sketch2ui.local` account via an explicit, idempotent script
  (`apps/api/scripts/backfill-legacy-owner.ts`), not an automatic on-boot mutation.
- **Frontend**: `/login` and `/register` pages, an `AuthContext`/`ProtectedRoute`
  gating the Dashboard and Workspace routes, `AppHeader` showing the current user +
  logout.
- **Not implemented** (explicitly out of scope for this phase): OAuth, SSO, MFA,
  password-reset email, collaboration/sharing, RBAC beyond a reserved `role` field.
  `/uploads` static file serving is gated by login but not by per-asset ownership
  (storage keys are unguessable UUIDs) — a deliberate, documented residual gap.
- **Tests**: repository contract tests for `User`/`Session`; the first HTTP-
  integration test file in `apps/api` (`modules/auth/auth.routes.test.ts`, via
  `supertest`) covering register/login/logout/`me` and cross-user ownership; both
  Playwright e2e specs updated to register+login before exercising the golden path.

### 2.10 Multi-page projects (Phase D3 — complete)

Converts a project from "one asset, one page" to `Project → Page[]`, per the
deadline execution plan's §6. See `docs/execution/phase-log.md`'s Phase D3 entry for
the full file list.

- **Backend**: a new `Page` model; `pageId` added to every project-owned table
  (`ProjectAsset`, `Detection`, `CodeVersion`, `PageBoundaryRecord`,
  `CorrectionRecord`, the four override tables). All 13 previously project-nested
  routers restructured to `/api/projects/:id/pages/:pageId/...`, gated by a new
  `requirePageInProject` middleware (mirrors `requireProjectOwnership`'s 404-not-403
  reasoning). A `PageRepository` refuses to delete a project's last page — a project
  can never have zero pages. Pre-existing (pre-D3) projects get a synthesized
  "Page 1" via an idempotent `backfillPages()` on every JSON-store load (and an
  explicit `db:backfill-pages` script for the rare Postgres edge case).
- **Export**: rewritten for multi-page bundling — one page exports as `index.html`,
  every other page as `page-{order}.html`, sharing one concatenated `styles.css`
  (collision-safe because `packages/codegen`'s new `idPrefix` option namespaces each
  page's UI-IR node ids). Each page's own crops and source sketch are bundled
  separately (`source-sketch-index.*`, `source-sketch-page-2.*`, ...).
- **Frontend**: `apps/web/src/features/workspace/PagesStrip.tsx` — one pill per page
  (select/rename/delete/add), built from the existing Button/IconButton/Input
  primitives. Every page-owned `api.ts` method and `projectStore`'s `currentPageId`
  now thread a `pageId`; switching pages clears the current selection and reloads
  that page's asset/detections/overrides/code version from scratch.
- **Cross-page links need no new mechanism**: a `link`-class detection's `href` set
  to a relative path like `./page-2.html` via the existing Content Inspector survives
  into the exported HTML unchanged — `isSafeHref()` already accepted relative paths
  before this phase. Verified end-to-end by `e2e/multi-page.spec.ts`.
- **Tests**: new `PageRepository` contract tests (including the last-page-delete
  guard) and an HTTP-integration suite for the pages CRUD routes (cross-project
  isolation, cross-page detection isolation). New `e2e/multi-page.spec.ts` — a
  second page with independent upload/detect/generate, switching back preserves
  Page 1's state, and the exported ZIP contains both pages, one `styles.css`, both
  pages' source sketches, and the cross-page link verbatim.

### 2.11 CI/CD (Phase D4 — complete)

`.github/workflows/ci.yml` — a single linear job (`checkout → setup Node → npm ci →
typecheck → Vitest → setup Python → Pytest → production build → Playwright E2E`),
matching the deadline execution plan's §7.1 diagram exactly. Runs on every push and
pull request against `main`.

- A workflow file existed before this phase, but it was an untouched leftover from
  the repo's very first baseline commit (predating Playwright/e2e entirely) with an
  empty `services:` key under one job and no E2E check at all — effectively not a
  real gate. This phase replaced it rather than patching around it.
- Uses the exact existing npm scripts (`typecheck`, `test`, `test:py`, `build`,
  `test:e2e`) with no CI-specific variants. No `DATABASE_URL`/`REDIS_URL` is ever
  set, so Vitest's Prisma contract-test arms skip cleanly (proven locally: 241
  passed / 16 skipped) and `test:e2e`'s throwaway-temp-dir storage means neither
  step can touch development data — no isolation logic needed beyond what already
  existed for local `npm test`/`npm run test:e2e`.
- Playwright's one project pins to `channel: "chrome"` (system-installed Google
  Chrome, not a Playwright-managed download) — a pre-existing choice made because
  the dev sandbox can't reach Playwright's browser CDN. `ubuntu-latest` GitHub
  runners ship Chrome pre-installed, so CI needs only `npx playwright install-deps`
  (OS shared libraries, no browser download) rather than `playwright install`.
- On failure, uploads the Playwright HTML report and trace directory as a build
  artifact (7-day retention) — the one addition beyond the plan's literal five
  checks, since `trace: "retain-on-failure"` was already being produced and
  discarded.
- Not done: no ML training in CI (explicitly out of scope per the plan), no
  automatic deployment, no matrix/parallelization across Node or OS versions.

---

## 3. What's PARTIALLY done / working-but-flagged

### 3.1 YOLO detector — `ml/models/ui-detector/v1.0.0`

Working, wired into the product (`Detect` button in the workspace), but the model
registry's own `metrics.json` says:

> `"status": "smoke_test"` — *"Trained on 156 images across 16 classes. Far below the
> data needed for a reliable detector. These metrics demonstrate the pipeline runs end
> to end; they are not evidence the detector works in production."*

- Trained on **156 images**, **16 of the 41 taxonomy classes** (`ml/dataset/v1-training-scope.md` documents the deliberate subset decision).
- Per-class AP@0.5 ranges from ~0.36 to 0.995 — `select`, `radio_button`, `carousel` perform near chance.
- Model is `yolov8n.pt` (Ultralytics YOLOv8-nano) fine-tuned — functionally the "tiny detector" role the plan describes (§9), but not literally the YOLOv5 architecture named in the plan title.
- The UI itself is honest about this: the Detect button is labeled "Beta," and the workspace shows a warning banner ("This model is experimental — accuracy varies a lot by component type, so check every box").

**What's needed to move this out of "partial":** more labeled images (the active-learning report already tells you which sketches to prioritize), training across the full 41-class taxonomy, a `v1.1.0` retrain compared against `docs/eval/baseline-v1.0.0.json`.

### 3.2 Persistence layer — RESOLVED, see §2.7

As of Phase 8 (2026-08-25) this moved from "partial" to done: the JSON store is
retired at runtime, every domain is behind a repository layer backed by PostgreSQL via
Prisma, and `docker-compose.yml`'s Postgres container is now what the API actually
talks to. `docker-compose.yml`'s Redis container is still unused — see §3.3.

### 3.3 Background jobs

- Detection jobs run **in-process** (`apps/api/src/modules/detections/detect.job.ts`), not through a queue. Comment in the file: *"Runs IN-PROCESS rather than through Redis/BullMQ."* This is unchanged by the Phase 8 persistence migration — only *where job records are stored* moved to Postgres; *how* jobs execute did not.
- A server restart mid-job orphans it — the server has a startup routine (`failOrphanedJobs()` in `server.ts`) that explicitly fails any job left in "processing" state from a previous run, rather than leaving a client polling forever. This is a reasonable mitigation but not the same as a durable queue. It is now backed by a single atomic `UPDATE ... WHERE status IN (...)` on Postgres rather than a JSON-array scan-and-rewrite.
- Progress reporting is **polling only** (`apps/web/src/features/detection/useDetectionJob.ts`) — the plan's §7.5 WebSocket/SSE option was never built (comment in the code says as much).

---

## 4. What's NOT STARTED

Everything below has **zero implementation** — no partial scaffolding, no stub routes, confirmed by direct search of the codebase.

### 4.1 Explicitly deferred by the plan itself (§1.3 "Out of scope for MVP")
- Automatic business-logic generation
- Enterprise auth / SSO
- Production-grade multi-user collaborative editing
- Arbitrary JavaScript execution from uploads (deliberately excluded for safety — preview iframe has no script sandbox path)
- Perfect image-to-image visual matching
- Backend application logic generation from a sketch
- Automatic conversion to every frontend framework

### 4.2 Named V1 items not yet built
- ~~Multi-page projects~~ — **done, see §2.10** (Phase D3, 2026-08-25).
- **Camera capture** — upload is file-picker/drag-drop only, no in-browser camera capture flow.
- **Perspective correction** — page boundary can be manually adjusted (quad drag) but there's no actual perspective-warp transform applied to the image before detection.
- **Reusable component palette** — no library of pre-built components to drag onto a page.

### 4.3 V2 scope (plan §16)
- Collaborative editing
- React export
- Tailwind export
- Design tokens / theme presets
- Component library
- Full visual style editor beyond the current six-property inspector
- AI-assisted text extraction / OCR
- Multilingual handwritten text extraction

### 4.4 V3 research scope (plan §16, §37)
- Layout transformer model
- Multimodal UI understanding
- OCR + detection fusion
- Learned layout reconstruction (current layout engine is fully rule-based/geometric, no ML)
- Visual similarity optimization
- Active-learning loop automation (the *report* exists — `report:active-learning` — but nothing acts on it automatically; a human still decides what to label next)
- Automatic hard-example mining

### 4.5 Deployment / ops (plan §44–§45)
- No cloud deployment configured — `docker-compose.yml` is local-only.
- No backup/recovery strategy for uploaded images or exported ZIPs (Postgres itself now has real transactional guarantees and could be backed up with standard `pg_dump`, but no scheduled backup job exists).
- ~~No CI/CD pipeline~~ — **done, see §2.11** (Phase D4, 2026-08-25). Still no
  deployment automation — CI is test/build gating only, plan §30's broader "cloud
  provisioning" scope stays out of scope.
- No observability/logging infrastructure beyond ad-hoc `console.log` (plan §29 wants correlation IDs, stage-duration tracking — partially present in job records but not exported to any metrics system).

---

## 5. Inspector completeness (plan §17.3)

All **five** groups are built and, as of Phase 8, all persisted through PostgreSQL:

| Group | Status |
|---|---|
| **Style** (display, gap, padding, margin, font-size, alignment) | ✅ Done |
| **Content** (text, alt text, link) | ✅ Done |
| **Detection** (class, confidence, model, source) | ✅ Done |
| **Geometry** (x, y, width, height, editable) | ✅ Done |
| **Structure** (parent, display order, re-parenting) | ✅ Done |

Every group is backed by its own repository (`apps/api/src/repositories/{style,content,geometry,structure}-override.repository.ts`, JSON + Prisma) keyed on detection UUID, with a shared `OverrideRepository<T>` contract and per-group contract tests.

---

## 6. Suggested next priorities

The four items previously listed here (Geometry + Structure inspector groups,
Postgres/Prisma swap) are now **done** — see §2.7 and §5. Remaining, in rough order of
"closes the biggest gap between current state and the plan's own MVP/V1 definition":

1. **More labeled training data + a `v1.1.0` retrain** — the detector is the one piece
   self-flagged as not production-ready; `report:active-learning` already tells you
   what to label next. See `docs/ml/model-decision.md` for why a v1.1 retrain on the
   same corpus was judged not worth doing without new data. Re-confirmed on
   2026-08-25 (Phase D2 of the deadline plan): the corpus is still exactly 162
   images / 2,917 label instances, unchanged since the 2026-08-24 dataset-quality
   report, so retraining remains "theater, not progress" until new annotation work
   lands. `npm run eval` reproduces `docs/eval/baseline-v1.0.0.json` exactly;
   qualitative prediction overlays for all 5 sample sketches are in
   `docs/eval/qualitative-v1.0.0/`.
2. ~~Decide the auth question explicitly~~ — **done, see §2.9** (Phase D1,
   2026-08-25).
3. ~~CI/CD~~ — **done, see §2.11** (Phase D4, 2026-08-25).
4. ~~Multi-page projects~~ — **done, see §2.10** (Phase D3, 2026-08-25).
5. **Durable job queue (Redis/BullMQ)** — in-process execution is documented and
   mitigated (startup orphan-reaping is now an atomic Postgres update) but still not a
   durable queue; `docker-compose.yml` already provisions Redis, unused.
6. **Broader test coverage** — three Playwright E2E specs exist (golden path,
   Inspector overrides, multi-page), all auth-aware and now run automatically in CI
   (see §2.11); still no React component/unit tests.
7. **Final integration pass (Phase D5)** — the deadline plan's last phase: a
   cross-cutting regression sweep of D1–D4 together (see the plan's §8 and §9).
