---
title: "Sketch2UI — Phase 0 Baseline (Current State)"
phase: 0
status_date: 2026-08-24
purpose: "Reproducible snapshot of the repository at the start of the phased execution plan. All facts here were verified against the working tree on 2026-08-24, not copied from earlier docs."
---

# Phase 0 — Current-State Baseline

This document is the reference point every later phase is measured against. Nothing
here was inferred: file paths, script names, model metadata and test counts were
read directly from the tree, and the test/build commands were run.

Companion documents in this directory:

- [phase-log.md](phase-log.md) — running log of what each phase changed
- [regression-checklist.md](regression-checklist.md) — the manual smoke path to
  re-run at the end of every phase

## 1. Environment

| Thing | Value | Where verified |
|---|---|---|
| OS | macOS (Darwin 24) | `uname` (session env) |
| Node | v20.17.0 | `node -v` |
| npm | 11.4.2 | `npm -v` |
| Package manager | npm workspaces (`workspaces: apps/*, packages/*, scripts`) | `package.json` |
| System Python | 3.9.6 (`/usr/bin/python3`) | `python3 --version` |
| cv-worker venv Python | 3.9.6 (`services/cv-worker/.venv/bin/python`) | direct check |
| ML runtime pins | ultralytics 8.3.0, torch 2.8.0, torchvision 0.23.0 | `services/cv-worker/requirements.txt` |
| Repo path | `/Users/ahsafahmath/Desktop/Skech2UI_New_Project` | working dir |

## 2. Version control

**The project directory is NOT a git repository.** `git status` returns
`fatal: Not a git repository`. There is no `.git`, no branch, no commit history.

Implication for the plan's Rule 4 (git safety) and Phase 0's "create a working
branch": those steps cannot be executed until the user initializes a repo and
imports the current tree. This is captured as a known gap in §11 below and needs
an explicit decision before Phase 1.

The tree does contain `.github/` (a `workflows/` shell), `.gitignore` and
`.env.example`, which suggest the code was authored with git in mind but was
copied into this directory without the `.git` metadata.

## 3. Repository layout (top level)

```
apps/
  api/                Node + Express + TS — HTTP surface, JSON-store persistence
  web/                React + Vite + TS + Tailwind — annotation canvas, inspector, preview
packages/
  shared-types/       Detection / UI-IR / Project types + boundary parity fixture
  codegen/            layout.ts → UI-IR, html.ts + css.ts generators, override folders
scripts/              tsx CLIs: dataset export, external import, v1 subset, eval, active-learning
services/
  cv-worker/          Python FastAPI — YOLOv8n inference, page-boundary detection
ml/
  dataset/            41-class canonical dataset + derived v1/ subset (16 classes)
  training/           train_v1.py + run artifacts
  models/ui-detector/v1.0.0/   Frozen registry entry (weights.pt, metrics.json, classes.txt)
docs/
  execution/          THIS DIRECTORY — baseline, phase log, regression checklist
  ml/                 annotation-guide.md, page-boundary.md, fixtures/
  eval/               baseline-v1.0.0.json (§21 regression benchmark)
  codegen-*.md        Two decision docs on layout + assets
infra/                docker/ nginx/ scripts/ — placeholders (.gitkeep only)
data/
  uploads/            15 uploaded user sketches
  exports/            2 generated ZIP exports
  raw/ processed/ samples/    .gitkeep placeholders
docker-compose.yml    Postgres 16 + Redis 7 — provisioned, not yet used by apps/api
.env / .env.example   PORT, CORS, DATA_DIR, UPLOADS_DIR, STORE_FILE, DATABASE_URL, REDIS_URL, VITE_API_URL
PROJECT_STATUS.md     The source of truth this baseline reconciles against
```

## 4. Package scripts (the actual commands, not paraphrased)

Root `package.json`:

```json
"scripts": {
  "dev:web":  "npm run dev -w apps/web",
  "dev:api":  "npm run dev -w apps/api",
  "build":    "npm run build -w packages/shared-types && npm run build -w packages/codegen && npm run build -w apps/api && npm run build -w apps/web",
  "typecheck":"npm run typecheck -w apps/web && npm run typecheck -w apps/api && npm run typecheck -w scripts",
  "export:dataset":         "tsx scripts/src/export-yolo-dataset.ts",
  "import:external":        "tsx scripts/src/import-external-datasets.ts",
  "build:v1":               "tsx scripts/src/build-v1-subset.ts",
  "report:active-learning": "tsx scripts/src/active-learning-report.ts",
  "eval":                   "tsx scripts/src/evaluate.ts",
  "test":                   "npm run test -w packages/shared-types",
  "test:py":                "cd services/cv-worker && .venv/bin/python -m pytest -q"
}
```

Per-workspace:

| Workspace | dev | build | typecheck | test |
|---|---|---|---|---|
| `apps/api` | `tsx watch src/server.ts` | `tsc -p tsconfig.json` | `tsc --noEmit` | — |
| `apps/web` | `vite` | `tsc -b && vite build` | `tsc -b --noEmit` | — |
| `packages/shared-types` | — | `tsc -p tsconfig.json` | — | `vitest run` |
| `packages/codegen` | — | `tsc -p tsconfig.json` | — | — |
| `scripts` | — | — | `tsc --noEmit` | — |

CV worker (Python, not an npm workspace):

```bash
services/cv-worker/.venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1
services/cv-worker/.venv/bin/python -m pytest -q     # 19 tests
```

Local dev needs **three** processes (per README): API, web, cv-worker.

## 5. Model registry — `ml/models/ui-detector/v1.0.0`

Verified from `metrics.json` and the registry README:

| Field | Value |
|---|---|
| `model_version` | `v1.0.0` |
| `status` | **`smoke_test`** |
| `created_utc` | `2026-08-23T17:26:35Z` |
| Architecture | YOLOv8-nano (fine-tuned from `yolov8n.pt`), **not literal YOLOv5** |
| Classes trained | **16** (of a 41-class taxonomy) |
| Training images | **156** (121 train / 18 val / 17 test) |
| Training config | epochs 60, imgsz 640, batch 8, seed 0, device cpu |
| Runtime pins | ultralytics 8.3.0, torch 2.8.0, python 3.9.6 |
| Val summary | precision 0.7853, recall 0.7651, mAP@0.5 **0.833**, mAP@0.5:0.95 0.638 |
| Test summary | precision 0.8085, recall 0.7451, mAP@0.5 **0.807**, mAP@0.5:0.95 0.647 |
| Weak classes (test AP@0.5) | `select` 0.364, `radio_button` 0.499, `carousel` 0.539 |
| Strong classes (test AP@0.5 = 0.995) | `section`, `footer`, `navbar`, `table`, `image` |
| Class-id namespace | **model output ids 0..15 index the version's own `classes.txt`**, NOT the 41-class taxonomy — anything consuming this model must translate |

Registry entry ships: `weights.pt`, `classes.txt`, `data.yaml`, `metrics.json`,
`README.md`, PR curve, confusion matrix (raw + normalized), `results.png`.

The registry README is unusually honest about *why* the headline metrics overstate
the model (17-image test split, mass carried by easy structural classes, 131/156
images from external datasets). This is the correct starting posture for Phase 6
(model v1.1) and Phase 7 (release gate).

## 6. Dataset structure

Canonical dataset lives at `ml/dataset/`:

```
ml/dataset/
  README.md            attribution + dataset rules
  classes.txt          FULL 41-class taxonomy (frozen ordering, ids 0..40)
  data.yaml            YOLO config for the 41-class canonical set
  v1-classes.txt       Frozen 16-class subset ordering (ids 0..15)
  v1-training-scope.md Rationale + eligibility rule for the subset
  images/{train,val,test}/     JPGs + PNGs (external + in-house)
  labels/{train,val,test}/     YOLO .txt labels per image
  v1/                  Derived 16-class subset (regenerable, do NOT hand-edit)
    data.yaml
    images/{train,val,test}/
    labels/{train,val,test}/
```

Counts (from `v1-training-scope.md`, verified against the directory listing):

| Split | Images | Notes |
|---|---:|---|
| train | 121 | 116 external + 5 user-uploaded + `corr_*` corrections |
| val   | 18  | all external (5 hdwe + 13 wf) |
| test  | 17  | all external (9 hdwe + 8 wf) |
| **total** | **156** | matches `metrics.json` |

Per-class train/val/test counts for the 16 v1 classes are enumerated in
`ml/dataset/v1-training-scope.md`. Range: `textarea` 79 total (smallest eligible),
`input` 387 total (largest). 25 taxonomy classes are excluded solely because they
have 0 instances in val AND 0 in test (largest excluded: `card` with 20).

External sources (`hdwe_*`, `wf_*`) are CC BY 4.0 from Roboflow Universe;
attribution must travel with any redistribution — see `ml/dataset/README.md`.

## 7. Class taxonomy

The taxonomy is defined once in `packages/shared-types/src/taxonomy.ts` and grouped
into five families. Full ordering (`ml/dataset/classes.txt`, ids 0..40):

```
Structural (0-8):     page, header, section, footer, navbar, sidebar, form, card, table
Content (9-17):       logo, heading, text, link, image, video, icon, avatar, nav_item, carousel
Interaction (18-28):  button, input, textarea, select, menu_button, search_box,
                      carousel_prev, carousel_next, carousel_indicator, checkbox, radio_button
Repeated (29-33):     card_title, card_text, card_button, list, list_item
Special (34-40):      breadcrumb, map, social_icon, newsletter, testimonial, divider
```

`CONTAINER_CLASSES` and `ATOMIC_CLASSES` sets in `taxonomy.ts` control the
layout-inference behavior of `packages/codegen/src/layout.ts` — Phase 2 (Structure
inspector) will need to respect this split.

**Two class-id namespaces coexist**:

1. **Full taxonomy** — 41 classes, ordering frozen in `ml/dataset/classes.txt`. The
   canonical UI vocabulary.
2. **v1 subset** — 16 classes, ordering frozen in `ml/dataset/v1-classes.txt` AND
   `ml/models/ui-detector/v1.0.0/classes.txt` (identical). Model output ids index
   this file, not the taxonomy.

Any translation between the two must go through `ml/dataset/v1-training-scope.md`'s
mapping table. This is a live foot-gun for Phase 6+.

## 8. Persistence mechanism

- Runtime store: `apps/api/src/db/jsonStore.ts` — single-file JSON at
  `apps/api/data/store.json`. Loaded once at startup, rewritten on every mutation
  (`fs.writeFileSync`, no locking). Schema is `{ projects, assets, detections,
  codeVersions, jobs, trainingSamples, exports, pageBoundaries }`.
- Uploads: files land under `data/uploads/` with UUID filenames. 15 real user
  uploads currently on disk.
- Exports: generated ZIPs under `data/exports/projects/<projectId>/exports/vN.zip`.
  2 exports currently on disk.
- The store deliberately exposes a small module-level API (`db.state`, `db.save()`,
  `db.reset()`) so it can be swapped for Prisma/Postgres in Phase 8 without
  touching route handlers. The file header comments that.
- `docker-compose.yml` provisions Postgres 16 + Redis 7 with credentials
  `sketch2ui/sketch2ui/sketch2ui`; grep of `apps/api` confirms **nothing imports
  `prisma`, `pg`, `bullmq`, or `redis`** — the containers are dormant.
- `.env.example` already has `DATABASE_URL` and `REDIS_URL` slots for the switch.

## 9. Background jobs mechanism

- Detection jobs run **in-process** in `apps/api/src/modules/detections/detect.job.ts`.
  A route creates a `Job` row (state `processing`), fires `runDetectJob()` without
  awaiting it, and returns immediately; the client polls
  `useDetectionJob.ts` for state transitions.
- On server startup (`apps/api/src/server.ts:50`), `failOrphanedJobs()` scans the
  store and marks any job still in `processing` as `failed`. This is the mitigation
  for the fact that a mid-flight process death would otherwise leave the client
  polling forever. It's a floor, not a durable queue.
- Progress reporting is polling-only. No SSE, no WebSocket.
- The comment in `detect.job.ts` explicitly says: *"Runs IN-PROCESS rather than
  through Redis/BullMQ… Swapping this function body for a queue producer later
  changes nothing the client can observe."* Phase 9 is where that swap happens.

## 10. Inspector capabilities

From `apps/web/src/features/inspector/InspectorPanel.tsx` (verified against the
inline props and constants):

| Group | Status | Notes |
|---|---|---|
| **Style** | ✅ Done | Six allowed properties: `display`, `gap`, `padding`, `margin`, `font-size`, `text-align`. Debounce-then-Apply UX. Server allowlist mirrors the client's `STYLE_FIELDS`. |
| **Content** | ✅ Done | `text`, `altText`, `href` with class-applicability gating via `contentFieldsFor()`. Server rejects `<`/`>` in text and non-allowlisted `href` schemes. |
| **Detection** (class, confidence, model, source) | ❌ Not built | Phase 3 target |
| **Geometry** (x, y, width, height) | ❌ Not built | **Phase 1 target — the very next work** |
| **Structure** (parent, display order, re-parenting) | ❌ Not built | Phase 2 target |

Both existing groups are keyed on the **detection UUID** (stable across
regenerations), not on UI-IR node ids (per-generation counter, unstable). Phases
1-3 must follow the same pattern — this is repeated in every inspector-phase
prompt in the execution plan.

## 11. Automated tests

Run today, from the actual tree:

| Command | Result | What |
|---|---|---|
| `npm run test` | **38 passed / 0 failed** (2 files, 161 ms) | Vitest — `packages/shared-types` (boundary parity + code-validation + others) |
| `npm run test:py` | **19 passed / 0 failed** (10 ms) | Pytest — `services/cv-worker/tests/test_boundary_parity.py` |
| `npm run build` | **success** (~654 ms Vite; all four `tsc` stages green) | shared-types → codegen → apps/api → apps/web |

Coverage gaps to note (per PROJECT_STATUS.md §2.6, confirmed by inventory):

- No React component tests (no Vitest+RTL suite under `apps/web`).
- No Playwright / E2E suite — `tests/` at the repo root only contains `.gitkeep`.
- No Python tests for the detector itself; the sole `test_boundary_parity.py`
  covers only the shared boundary-overlap fixture.

Both existing suites use the shared fixture
`packages/shared-types/fixtures/boundary-overlap-parity.json`, tested against
both the TS and Python implementations of the boundary-overlap algorithm to
prevent drift.

## 12. Known gaps (baseline reconciliation)

These are the deltas between what the plan expects and what is on disk. They are
not new work items — most are already scheduled by the phase plan; the point of
listing them here is that the baseline is what the phase-log will be diffed
against.

1. **No git repository.** Blocks Rule 4 (git safety) and Phase 0's "create a
   working branch". Needs an explicit user decision before Phase 1 (see
   [regression-checklist.md](regression-checklist.md) §0 for the mitigation).
2. **`.github/workflows/`** appears in the tree but is empty (no YAML files) — CI
   is not just deferred to Phase 15, it is not scaffolded either.
3. **Postgres + Redis provisioned but unused.** Phase 8 (Postgres) and Phase 9
   (durable jobs) are the closes.
4. **Detector self-flagged `smoke_test`.** 156 images, 16/41 classes, YOLOv8-nano
   (not literal YOLOv5). Phase 5 (dataset), Phase 6 (v1.1 model), Phase 7 (gate)
   address this in sequence.
5. **Inspector 3/5 incomplete.** Detection, Geometry, Structure groups missing.
   Phases 1-3.
6. **No auth.** Any client can act on any project. Phase 10.
7. **Single-page projects only.** No `Project → Page[]` hierarchy. Phase 11.
8. **No camera capture / perspective correction.** Phase 12.
9. **No reusable component palette.** Phase 13.
10. **No correction history / audit log.** Data lost after each regeneration.
    Phase 4.
11. **Frontend tests missing (RTL, Playwright).** Phase 14.
12. **No CI/CD, no observability infra, no backup strategy.** Phases 15-16.
13. **Two class-id namespaces (41-class vs v1 16-class) with no runtime
    translator on the API side yet.** Latent bug surface once a `v1.1.0` model
    with a different subset arrives; Phase 7 (release gate) must address.
14. **`tests/`** at the repo root is `.gitkeep`-only — reserved for the future
    Playwright/E2E suite but currently unused.
15. **Root-level `yolov8n.pt`** (6.5 MB) sits at the repo root. Per `.gitignore`
    it should not be committed; but with no git repo the file is just an unused
    artifact left over from training. Leave in place — do not delete without user
    confirmation.

## 13. Baseline verification — commands and results (reproducibility record)

Run in the project root on 2026-08-24 by Claude Code. Repeat these to reproduce
the baseline before starting Phase 1.

```bash
# Environment
node -v                                     # v20.17.0
npm -v                                      # 11.4.2
/usr/bin/python3 --version                  # Python 3.9.6
services/cv-worker/.venv/bin/python --version  # Python 3.9.6

# Tests (TS)
npm run test                                # 38 passed / 0 failed
# Tests (Python)
npm run test:py                             # 19 passed / 0 failed
# Build
npm run build                               # 4-stage tsc + vite build, no errors
```

## 14. What Phase 1 may touch (advance flag, not commitment)

Per the execution plan's Phase 1 spec, only the following areas are expected to
change:

- New: `apps/api/src/modules/geometry-overrides/*` (GET/PUT/DELETE)
- New: `packages/shared-types/src/geometry-override.ts` (+ re-export in `index.ts`)
- Modified: `packages/codegen/src/layout.ts` to fold geometry overrides after
  raw detections but before UI-IR nodes are assigned
- Modified: `apps/web/src/features/inspector/InspectorPanel.tsx` to add the
  Geometry section, mirroring the Style/Content shape
- Modified: `apps/api/src/server.ts` to mount the new router
- New: `packages/shared-types/src/__tests__/geometry-override.test.ts`

Nothing in `packages/codegen/src/html.ts`, `packages/codegen/src/css.ts`, the
existing style/content override modules, or the JSON store abstractions should
need to change. If Phase 1 finds otherwise, that discovery is itself a phase
report item.
