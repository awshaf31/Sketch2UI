---
title: "Sketch2UI — Project Status: Done / In Progress / Not Started"
based_on: "Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md"
status_as_of: "2026-08-24"
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
| Style + Content inspector (§17.3) | **Done** |
| Code editor (hand-edit HTML/CSS, versioned) | **Done** |
| YOLO detector | **Working but explicitly a smoke test** (156 images, 16/41 classes) |
| Persistence | **JSON file, not Postgres** (deliberate, documented stand-in) |
| Background jobs | **In-process, not queued** (no Redis/BullMQ despite docker-compose provisioning it) |
| Auth / accounts | **Not started** (no users, no login, single implicit workspace) |
| Multi-page projects | **Not started** |
| React/Tailwind export, design tokens, themes | **Not started** (V2 scope) |
| Everything V3 (layout transformer, OCR, active learning ML) | **Not started** |

The project is a working single-user prototype that implements the plan's MVP and a
meaningful slice of V1. The computer-vision model is the one piece that is explicitly
**not** production-grade yet, and the codebase says so itself (`ml/models/ui-detector/v1.0.0/metrics.json`
calls it a `"smoke_test"`).

---

## 2. What's DONE

### 2.1 Core pipeline (plan §51 steps 1–12 — "practical build order")

All 12 steps are implemented and wired together:

1. **Project CRUD** — `apps/api/src/modules/projects/projects.routes.ts`. Create/list/get/patch/delete. No auth gate — any request can act on any project.
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

- `npm run test` (Vitest) — 38 passing tests in `packages/shared-types` (boundary-parity + other unit tests).
- `npm run test:py` (Pytest) — the Python side of the boundary-parity fixture, `services/cv-worker/tests/`.
- No React component tests, no Playwright/E2E suite exists yet (plan §20 names Playwright and RTL; only the CV/boundary layer has automated test coverage today).

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

### 3.2 Persistence layer

- `apps/api/src/db/jsonStore.ts` is a **file-backed JSON store** (`apps/api/data/store.json`), explicitly commented as a stand-in for the plan's §8 Postgres/Prisma schema: *"Swap for Prisma/Postgres in Phase 2+ without touching module/route code, since routes only depend on the exported functions below."*
- `docker-compose.yml` **provisions** Postgres + Redis containers, but nothing in `apps/api` currently connects to either — confirmed via grep, no `prisma`, `pg`, `bullmq`, or `redis` imports anywhere in the API source.
- This means: no real transactional guarantees, no concurrent-write safety, and the entire dataset lives in one JSON file that grows unbounded with every project/detection/version.

### 3.3 Background jobs

- Detection jobs run **in-process** (`apps/api/src/modules/detections/detect.job.ts`), not through a queue. Comment in the file: *"Runs IN-PROCESS rather than through Redis/BullMQ."*
- A server restart mid-job orphans it — the server has a startup routine (`failOrphanedJobs()` in `server.ts`) that explicitly fails any job left in "processing" state from a previous run, rather than leaving a client polling forever. This is a reasonable mitigation but not the same as a durable queue.
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
- **User accounts / auth** — no login, no password hashing, no session, no per-user project scoping. Every project is visible to anyone who can reach the API. (The plan's §19 does call this "optional/lightweight for a project like this," so this may be intentional, not an oversight — worth confirming with whoever owns product scope.)
- **Multi-page projects** (§10.5) — the plan explicitly names this "a later implementation." One asset per project workspace today; no page-to-page navigation model, no `Project → Page[]` hierarchy.
- **Camera capture** — upload is file-picker/drag-drop only, no in-browser camera capture flow.
- **Perspective correction** — page boundary can be manually adjusted (quad drag) but there's no actual perspective-warp transform applied to the image before detection.
- **Reusable component palette** — no library of pre-built components to drag onto a page.
- **Correction history / audit log** — `audit_logs` table exists only in the plan's §8 schema design, not implemented (the "Detection / Geometry / Structure" groups of the Inspector, per §17.3, are also unbuilt — only Style and Content exist so far, per your explicit sequencing request).

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
- No backup/recovery strategy for the JSON store or uploaded images.
- No CI/CD pipeline (plan §30) — no `.github/workflows` found in the repo.
- No observability/logging infrastructure beyond ad-hoc `console.log` (plan §29 wants correlation IDs, stage-duration tracking — partially present in job records but not exported to any metrics system).

---

## 5. Inspector completeness (plan §17.3, since this was the most recent work)

The Inspector is speced with **four** groups. Only two exist:

| Group | Status |
|---|---|
| **Style** (display, gap, padding, margin, font-size, alignment) | ✅ Done |
| **Content** (text, alt text, link) | ✅ Done |
| **Detection** (class, confidence, model, source) | ❌ Not built |
| **Geometry** (x, y, width, height, editable) | ❌ Not built |
| **Structure** (parent, display order, re-parenting) | ❌ Not built |

Note: raw detection metadata (class, confidence, bbox) is *visible* elsewhere in the
UI (canvas overlay, tree panel header, the small summary line at the top of the
Inspector), so this isn't a functional gap in reading that data — it's specifically
the **editable Detection/Geometry/Structure panels** described in §17.3 that don't
exist as inspector sections yet.

---

## 6. Suggested next priorities

In rough order of "closes the biggest gap between current state and the plan's own
MVP/V1 definition":

1. **Geometry + Structure inspector groups** — natural continuation of the Style/Content
   work just finished, reuses the exact same override architecture (this document's
   §2.3/§2.4 describe a pattern that a Geometry override could follow almost exactly:
   detection-uuid-keyed, apply-then-regenerate, validated at the API boundary).
2. **More labeled training data + a `v1.1.0` retrain** — the detector is the one piece
   self-flagged as not production-ready; `report:active-learning` already tells you
   what to label next.
3. **Decide the auth question explicitly** — either confirm "no auth is fine for this
   project's scope" or scope out what "lightweight" (§19) means, since right now
   *anyone* can read/write/delete *any* project.
4. **Postgres/Prisma swap** — the JSON store is a real risk once the dataset or user
   count grows past what fits comfortably in one file with no locking.
