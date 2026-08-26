# Sketch2UI

Hand-drawn wireframe → HTML/CSS → live preview. Full plan in
[`Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md`](./docs/planning/Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md).

## Current state

Steps 1-12 of the plan's practical build order (§51) are done: sketch → manual
annotation **or** automated detection → page-boundary filtering → UI tree → HTML/CSS →
live preview, with a trained detector behind the **Detect** button.

```
apps/web            React + TS + Vite + Tailwind — upload, annotation canvas, UI tree,
                     code viewer, live preview
apps/api             Node + Express + TS — projects, asset upload, detections, codegen
packages/shared-types Detection / UI-IR / Project types shared by web, api and codegen
packages/codegen      Layout reconstruction (detections -> UI-IR) + HTML/CSS generators
scripts               Build-time tools — YOLO dataset export
ml/dataset            YOLO dataset (classes.txt, data.yaml, images/, labels/)
ml/training           Detector training (§9.8-9.10)
ml/models             Frozen model registry — ui-detector/v1.0.0
services/cv-worker     Python/FastAPI inference service (loads the frozen model)
```

Dataset and labelling: [`docs/ml/annotation-guide.md`](./docs/ml/annotation-guide.md),
[`ml/dataset/README.md`](./ml/dataset/README.md). Page boundary:
[`docs/ml/page-boundary.md`](./docs/ml/page-boundary.md).

## Running it

```bash
npm install
cp .env.example .env

# three terminals
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173

cd services/cv-worker && .venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1
```

The CV worker is optional — everything except the **Detect** button works without it.
See [`services/cv-worker/README.md`](./services/cv-worker/README.md) for setup.

Then: create a project on the dashboard, upload a sketch image, draw boxes over
its regions (pick a class first), and the UI tree / HTML / CSS / preview panels
update live. "Save code version" persists a `CodeVersion` via the API.

## Persistence

`apps/api` currently stores projects/assets/detections/code versions in a local
JSON file (`apps/api/data/store.json`) and uploaded images under `data/uploads/`.
This stands in for the Postgres schema in the plan (section 8) so the skeleton
runs without any infrastructure. `docker-compose.yml` provisions Postgres + Redis
for when that swap happens (Prisma, BullMQ job queue — plan sections 8, 27).

## Building the dataset

The annotation canvas in `apps/web` *is* the labelling tool — drawing a box and picking
a class produces exactly the records the exporter consumes. Label per
[`docs/ml/annotation-guide.md`](./docs/ml/annotation-guide.md), then:

```bash
npm run export:dataset              # -> ml/dataset/{images,labels}/{train,val,test}
npm run export:dataset -- --clean   # drop stale manual labels first (after re-annotating)
npm run export:dataset -- --dry-run # report only

npm run import:external             # merge the two external CC BY datasets
```

Run the exporter first — it regenerates `classes.txt` from the taxonomy, and the
importer refuses to run against a stale one. Both print per-class counts and flag
classes with too few examples to train on (§9.3).

The external sources are CC BY 4.0 and **require attribution on redistribution** — see
the attribution section of [`ml/dataset/README.md`](./ml/dataset/README.md).

## Automated detection (beta)

With the CV worker running, **Detect** on the project workspace runs the frozen detector
over the sketch and adds its boxes alongside your manual ones. Model boxes render dashed
purple with their confidence; correcting one adopts it as yours.

⚠️ **Experimental.** `ui-detector/v1.0.0` was trained on 156 images and its per-class
AP@0.5 ranges from 0.36 to 0.995 — `select`, `radio_button` and `carousel` are near
chance. Check every box. See
[`ml/models/ui-detector/v1.0.0/README.md`](./ml/models/ui-detector/v1.0.0/README.md).

## Layout reconstruction

`packages/codegen` turns detections into a UI-IR tree and then HTML/CSS. What happened
when it first met real detector output — and the one fix that needed — is in
[`docs/codegen-layout-findings.md`](./docs/codegen-layout-findings.md).

## Exporting

**Export ZIP** on the workspace packages the project's latest saved code version into a
self-contained download (§18.8, FR-09): `index.html`, `styles.css`, `assets/`, the
original `source-sketch.*`, and a `README.txt`. Open `index.html` directly — no server.
Every export is kept and re-downloadable from the toolbar strip.

Images in `assets/` are **real crops of the source sketch** (§15.5). Which classes get
cropped vs. stay symbolic is a documented decision — see
[`docs/codegen-assets.md`](./docs/codegen-assets.md).

## Tests

```bash
npm run test      # TypeScript (vitest)
npm run test:py   # Python (pytest, cv-worker)
```

Both run the **same** golden fixture,
`packages/shared-types/fixtures/boundary-overlap-parity.json`, against their own
implementation of the boundary-overlap algorithm. It is implemented twice because it must
run in two languages; the shared fixture is what stops the two copies drifting apart —
verified by perturbing one side and watching 12 of 19 cases fail.

## Feedback loop and evaluation

**Approve for training** on the workspace snapshots an asset's current boxes as ground
truth (§36, FR-11). `npm run export:dataset` merges approved snapshots into `ml/dataset`
under a `corr_` prefix, superseding the plain manual export for the same image.

```bash
npm run report:active-learning   # §36 — which sketches most need attention next
npm run report:dataset-quality   # read-only label/dataset checks — see docs/ml/dataset-quality-v1.1.md
npm run eval                     # §21 — writes docs/eval/baseline-<version>.json
```

`docs/eval/` is the §20.6 regression benchmark future model versions are compared
against — see [`docs/eval/README.md`](./docs/eval/README.md) for what it does and does
not measure.

## Next steps (per the plan's practical build order)

All 12 steps of the practical build order are complete. Natural next work: collect more
sketches (the active-learning report ranks which), retrain as `v1.1.0`, and compare it
against `docs/eval/baseline-v1.0.0.json`.
