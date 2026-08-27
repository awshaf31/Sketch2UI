# Sketch2UI

Turn a hand-drawn wireframe into working HTML/CSS. Upload a sketch, annotate the regions
(or let the trained detector find them), and Sketch2UI reconstructs the layout into a UI
tree, generates HTML/CSS, and renders a live preview you can export as a self-contained ZIP.

[![CI](https://github.com/awshaf31/sketch2ui/actions/workflows/ci.yml/badge.svg)](https://github.com/awshaf31/sketch2ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-20%2B-brightgreen)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)

---

## Features

- **Sketch upload** — drop a wireframe image straight onto the dashboard or into a project.
- **Annotation canvas** — draw class-tagged boxes over regions; keyboard nudge, zoom, fit-to-screen.
- **Automated detection** *(beta)* — a YOLO detector proposes boxes; correcting one adopts it as yours.
- **Page-boundary filtering** — strips everything outside the drawn page frame.
- **Layout reconstruction** — detections → UI-IR tree → semantic HTML + CSS.
- **Live preview** — sandboxed iframe that updates as you edit.
- **Inspector overrides** — per-element geometry, style, content and structure edits.
- **Multi-page projects** — several pages per project, with working cross-page links.
- **Export ZIP** — `index.html`, `styles.css`, real image crops in `assets/`, and the source sketch.
- **Accounts & admin** — email/password + Google Sign-In, password reset, an admin console
  (users, projects, jobs, models, audit logs).

---

## Architecture

```
          ┌────────────┐        REST         ┌────────────┐
          │  frontend  │ ──────────────────► │  backend   │
          │ React + TS │ ◄────────────────── │  Node + TS │
          └────────────┘                     └─────┬──────┘
                                                   │ HTTP (loopback only)
                                                   ▼
                                            ┌────────────┐
                                            │ cv-service │
                                            │  FastAPI   │
                                            │  + YOLO    │
                                            └────────────┘
                     ┌───────────────────────────┴──────────┐
                     ▼                                      ▼
              PostgreSQL / JSON store              ml/models registry
```

The frontend never talks to the CV service directly — the backend proxies it, so the
inference service stays off the public internet.

---

## Project structure

```
sketch2ui/
├── frontend/                 React 18 + TypeScript + Vite + Tailwind
│   ├── public/                 static assets
│   └── src/
│       ├── components/         design-system primitives (Button, Dialog, Panel, …)
│       ├── features/           annotation, workspace, inspector, code, preview, tree, upload
│       ├── pages/              routed screens (Dashboard, ProjectWorkspace, Admin*, auth)
│       ├── services/           API client
│       ├── stores/             Zustand state
│       └── context/            providers (toast, dialog, auth)
│
├── backend/                  Node + Express + TypeScript
│   ├── database/               Prisma schema + SQL migrations
│   ├── src/
│   │   ├── modules/            HTTP routes + services by domain
│   │   ├── repositories/       storage abstraction — json/ and prisma/ adapters
│   │   ├── middleware/         auth, ownership, rate limiting, error handling
│   │   ├── config/             environment resolution
│   │   └── db/                 JSON store + JSON→Postgres migration
│   └── scripts/                one-off operational scripts (promote-admin, backfills)
│
├── cv-service/               Python + FastAPI inference service (loads the frozen model)
│
├── packages/
│   ├── shared-types/           Detection / UI-IR / Project types shared across all three
│   └── codegen/                layout reconstruction + HTML/CSS generators
│
├── ml/
│   ├── dataset/                YOLO dataset (classes.txt, data.yaml, images/, labels/)
│   ├── training/               detector training
│   ├── models/                 frozen model registry — ui-detector/v1.0.0
│   └── evaluation/             regression baselines new model versions are scored against
│
├── scripts/                  build-time tooling (dataset export, reports, eval)
├── e2e/                      Playwright end-to-end specs
├── tests/fixtures/           golden demo fixture
├── data/                     runtime storage — uploads/, exports/
├── docker-compose.yml        Postgres + Redis for local development
└── .github/workflows/ci.yml  typecheck, guard, tests, build, E2E
```

`frontend`, `backend`, `packages/*` and `scripts` are npm workspaces; `cv-service` is a
separate Python venv.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Monaco |
| Backend | Node 20, Express, TypeScript, Multer, Prisma |
| Database | PostgreSQL (Prisma) — with a JSON file store as the default local driver |
| CV service | Python 3.11, FastAPI, Ultralytics YOLOv8 |
| Testing | Vitest, Pytest, Playwright |
| CI | GitHub Actions |

---

## Getting started

### Prerequisites

- Node.js 20+
- Python 3.11+ (only for the CV service)
- Docker (optional — only for Postgres/Redis)

### Install

```bash
git clone https://github.com/awshaf31/sketch2ui.git
cd sketch2ui
npm install
cp .env.example .env
```

### Run

Two terminals:

```bash
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

The CV service is optional — everything except the **Detect** button works without it:

```bash
cd cv-service
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1
```

Then create a project, upload a sketch, draw boxes over its regions (pick a class first),
and the UI tree / HTML / CSS / preview panels update live.

---

## Commands

Every command runs from the repository root. Workspace-level scripts are delegated, so
you never need to remember which package owns what.

### Develop

| Command | Does |
|---|---|
| `npm run dev:backend` | API with watch-reload on `:4000` |
| `npm run dev:frontend` | Vite dev server on `:5173` |

### Build & run

| Command | Does |
|---|---|
| `npm run build` | Production build of all workspaces, in dependency order |
| `npm start` | Run the built backend |

### Verify

| Command | Does |
|---|---|
| `npm run typecheck` | TypeScript across every workspace |
| `npm run check:db-state` | Architecture guard — no module bypasses the repository layer |
| `npm test` | Unit + integration (Vitest) |
| `npm run test:py` | CV service (Pytest) |
| `npm run test:e2e` | End-to-end (Playwright) |

### Database

| Command | Does |
|---|---|
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Apply migrations |
| `npm run db:import-json` | One-way import of the JSON store into Postgres |
| `npm run admin:promote -- <email>` | Grant the admin role |

### Dataset & model

| Command | Does |
|---|---|
| `npm run dataset:export` | Annotations → YOLO dataset |
| `npm run dataset:import` | Merge the external CC BY datasets |
| `npm run dataset:build-v1` | Rebuild the v1 training subset |
| `npm run dataset:report` | Read-only label/dataset quality checks |
| `npm run model:eval` | Score a model into `ml/evaluation/` |
| `npm run model:active-learning` | Rank which sketches to annotate next |

Most accept `-- --dry-run`; `dataset:export` also takes `-- --clean`.

---

## Configuration

All settings live in `.env` — see [`.env.example`](./.env.example) for the annotated list.
The essentials:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Backend port | `4000` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `VITE_API_URL` | Backend URL the frontend calls | `http://localhost:4000` |
| `PERSISTENCE_DRIVER` | `json` or `postgres` | `json` |
| `DATABASE_URL` | Prisma connection string | — |
| `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` | Google Sign-In (optional) | unset |
| `RESEND_API_KEY` | Password-reset email (optional) | unset — link is logged instead |

Every optional integration degrades gracefully: unset Google credentials hide the
Sign-In button, and an unset Resend key logs the reset link to the console.

---

## Database

The default `json` driver keeps everything in `backend/data/store.json`, so the app runs
with no infrastructure at all. To use Postgres:

```bash
docker compose up -d postgres redis
npm run db:generate      # generate the Prisma client
npm run db:migrate       # apply migrations
npm run db:import-json   # optional: import existing JSON data
```

Two one-off backfills exist for data predating the auth and multi-page work. They are
deliberately manual rather than run on boot, so they never silently mutate real data:

```bash
npm run db:backfill-legacy-owner -w backend   # assign ownerless projects
npm run db:backfill-pages -w backend          # give page-less projects a "Page 1"
```

Then set `PERSISTENCE_DRIVER=postgres` in `.env`. The schema and migrations live in
[`backend/database/`](./backend/database). Uploaded images are stored on disk under
`data/uploads/` under both drivers.

---

## Testing

The five verification commands are listed under [Commands](#verify). CI runs all of them
on every push and pull request.

`check:db-state` is an architecture guard rather than a test: it enforces the
repository-layer boundary, failing the build if any application module reaches past it
into the store directly.

The boundary-overlap algorithm is implemented twice — once in TypeScript, once in Python —
because it has to run in both. Both suites run it against the *same* golden fixture,
`packages/shared-types/fixtures/boundary-overlap-parity.json`, which is what stops the two
copies drifting apart.

Repository tests rewrite `DATABASE_URL` to a `_test` database and refuse to run otherwise,
so they can never truncate development data.

---

## Dataset and model

The annotation canvas *is* the labelling tool — drawing a box and picking a class produces
exactly the records the exporter consumes.

Run `dataset:export` before `dataset:import` — the exporter regenerates `classes.txt`
from the taxonomy, and the importer refuses to run against a stale one.

**Approve for training** in the workspace snapshots an asset's current boxes as ground
truth; the next `dataset:export` merges them under a `corr_` prefix.

> ⚠️ **The detector is experimental.** `ui-detector/v1.0.0` was trained on 156 images and
> its per-class AP@0.5 ranges from 0.36 to 0.995 — `select`, `radio_button` and `carousel`
> are near chance. Check every box. See
> [`ml/models/ui-detector/v1.0.0/README.md`](./ml/models/ui-detector/v1.0.0/README.md).

The external dataset sources are CC BY 4.0 and **require attribution on redistribution** —
see the attribution section of [`ml/dataset/README.md`](./ml/dataset/README.md).

---

## Export format

**Export ZIP** packages the project's latest saved code version into a self-contained
download: `index.html`, `styles.css`, `assets/`, the original `source-sketch.*`, and a
`README.txt`. Open `index.html` directly — no server needed. Every export is kept and
re-downloadable from the workspace toolbar. Images in `assets/` are real crops of the
source sketch; symbolic classes (icons, form controls) are rendered as markup instead.

---

## License

[MIT](./LICENSE) © awshafahmath.

One carve-out: the two **external datasets** merged in by `npm run dataset:import` are
CC BY 4.0 and carry their own attribution requirements, which travel with any
redistribution independently of this repository's licence. See the attribution section of
[`ml/dataset/README.md`](./ml/dataset/README.md).
