# Sketch2UI — Implementation Roadmap

*Status as of 2026-08-24. Source of truth for scope: `Sketch2UI_Complete_Highly_Detailed_Implementation_Plan.md`, cross-checked against the current repo (`README.md`, `packages/shared-types`, `services/cv-worker`).*

This roadmap restates the plan's practical build order (§51) and feature list (§16) as phases, marks what is actually built, and lays out what's left — grouped into near-term, mid-term, and long-term work rather than the plan's original 12-week calendar (§ Appendix G), since the project is already past that schedule's original pacing.

---

## Phase 0 — Foundation *(done)*

Repository, monorepo layout, and shared types.

- [x] Monorepo: `apps/web`, `apps/api`, `packages/shared-types`, `packages/codegen`, `services/cv-worker`, `ml/`, `scripts/`
- [x] Shared `Detection` / `BBox` / taxonomy types (`packages/shared-types`) — 26-class taxonomy across structural, content, interaction, repeated-content, and special categories (§33)
- [x] Local JSON store (`apps/api/data/store.json`) standing in for the Postgres schema in §8
- [x] `docker-compose.yml` provisioning Postgres + Redis for the eventual swap

## Phase 1 — Manual wireframe editor *(done — plan Steps 1–6)*

The "sketch interpretation is manual" vertical slice (§51, up to Step 6).

- [x] React + TS + Vite + Tailwind workspace (`apps/web`)
- [x] Sketch upload and project dashboard
- [x] Manual bounding-box annotation canvas (draw box, pick class)
- [x] UI tree derived from annotations
- [x] HTML/CSS generation from the manual tree (`packages/codegen`)
- [x] Live preview panel, code viewer

## Phase 2 — Dataset and detector *(done — plan Steps 7–9)*

- [x] Dataset export pipeline: annotation canvas output → YOLO format (`npm run export:dataset`, with `--clean` / `--dry-run`)
- [x] External CC BY dataset import and merge (`npm run import:external`, with attribution)
- [x] Trained detector: `ui-detector/v1.0.0`, frozen in `ml/models/`
- [x] `services/cv-worker` (Python/FastAPI) serving frozen-model inference
- [x] **Detect** button in the workspace — model boxes render dashed/purple with confidence, correcting one adopts it as a manual annotation

⚠️ **Known limitation carried forward:** v1.0.0 was trained on only 156 images; per-class AP@0.5 ranges 0.36–0.995, with `select`, `radio_button`, and `carousel` near chance. This is the direct driver for Phase 4 below.

## Phase 3 — Page filtering and layout reconstruction *(done — plan Steps 10–12)*

- [x] Page-boundary detection and hard filtering of out-of-page annotations (§10, `docs/ml/page-boundary.md`)
- [x] Automatic layout reconstruction: detections → UI-IR tree, with parent inference, row/column/grid/flex heuristics (§11, documented deviations in `docs/codegen-layout-findings.md`)
- [x] Correction feedback loop: **Approve for training** snapshots corrected boxes as ground truth, merged into `ml/dataset` under a `corr_` prefix (§36, FR-11)
- [x] Evaluation tooling: `npm run eval` (baseline JSON per model version), `npm run report:active-learning` (ranks which sketches most need labeling attention)
- [x] ZIP export: `index.html`, `styles.css`, `assets/` (real image crops per §15.5), source sketch, `README.txt` — every export retained and re-downloadable

**All 12 steps of the plan's practical build order (§51) are complete.** The system runs the full sketch → detection → correction → layout → code → preview → export loop end to end.

---

## Phase 4 — Near-term: close the detector's accuracy gap

This is the plan's own stated next move (§36 active learning, §22.6 dataset versioning) and what the README's "Next steps" section already points at.

- [ ] Use `report:active-learning` output to prioritize which new sketches to collect/label
- [ ] Expand the dataset past 156 images, particularly for the near-chance classes (`select`, `radio_button`, `carousel`)
- [ ] Retrain as `ui-detector/v1.1.0`
- [ ] Compare against `docs/eval/baseline-v1.0.0.json` per the §20.6 regression-benchmark process before promoting the new model version
- [ ] Apply the §30 "ML checks" gate going forward: a model shouldn't go active without an evaluation artifact, metric thresholds, class-list compatibility, and an inference smoke test

## Phase 5 — Mid-term: harden the MVP into V1

Remaining **Core MVP** (§16) polish plus the infrastructure swaps the current build deliberately deferred.

Infrastructure:
- [ ] Swap the JSON store for the real Postgres schema (§8: `users`, `projects`, `project_assets`, `detections`, `ui_nodes`, `code_versions`, `training_samples`, `audit_logs`) via Prisma
- [ ] Stand up the BullMQ job queue (§27) and chain `image_preprocess → detect_components → rebuild_layout → generate_code → create_export`, with the retry/idempotency rules in §27.4–27.5
- [ ] Basic observability: structured logs and metrics per §29 (inference duration, detections/image, job failure rate, queue wait, preview errors)
- [ ] CI/CD pull-request gate (§30): lint, type-check, unit tests, API tests, frontend build, Python tests

Security (§19), currently unimplemented since there's no multi-user auth yet:
- [ ] Authentication (sessions or short-lived tokens) and per-user project authorization
- [ ] Upload validation hardening (size/MIME/dimension/extension checks, server-generated storage names)
- [ ] Preview iframe permission isolation
- [ ] Rate limiting on detection / codegen / export endpoints
- [ ] Confirm the CV worker stays internal-only, reachable only through the API/queue layer

V1 features not yet built (§16 "V1 enhanced"):
- [ ] User accounts and project history
- [ ] Multiple pages per project
- [ ] Camera capture + perspective correction for photographed sketches
- [ ] Responsive preview (device simulation, §15.7)
- [ ] In-browser code editor (edit generated HTML/CSS directly)
- [ ] Reusable component palette
- [ ] Full correction history (beyond the current approve-for-training snapshot)

## Phase 6 — Long-term: V2 / V3 research extensions

Deferred by design (§16); revisit only once V1 is stable.

**V2:** collaborative editing, React export, Tailwind export, design tokens, theme presets, component library, style editor, AI-assisted text extraction / OCR (including multilingual handwriting), advanced layout learning.

**V3 (research):** layout transformer, multimodal UI understanding, OCR + detection fusion, learned layout reconstruction, visual-similarity-optimized generation, a full active-learning loop, automatic hard-example mining.

---

## Summary

| Phase | Scope | Status |
|---|---|---|
| 0 | Repo, shared types, storage scaffolding | Done |
| 1 | Manual wireframe → code → preview | Done |
| 2 | Dataset + trained detector + Detect button | Done |
| 3 | Page filtering, layout reconstruction, feedback loop, export | Done |
| 4 | Retrain detector as v1.1.0 on a larger dataset | Not started |
| 5 | Postgres/Prisma + queue + auth + CI/CD + remaining V1 features | Not started |
| 6 | V2/V3 (collab, framework export, OCR, learned layout) | Not started |

The core product loop (§51 Steps 1–12) is fully built and usable end to end. Everything from Phase 4 onward is scope the plan always described as coming after the working skeleton — none of it blocks using the tool today.
