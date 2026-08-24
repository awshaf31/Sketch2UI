---
title: "Sketch2UI — Dataset Quality Report (pre-v1.1)"
status_date: "2026-08-24"
purpose: "Execution plan Phase 5 — assess current dataset quality and prioritize labeling gaps BEFORE any retrain. No model weights were touched producing this report."
---

# Dataset Quality Report — pre-v1.1

This is Phase 5 of the execution plan: dataset quality only. **No training was
run and no model weights were changed to produce this document.** Every
number below was computed directly against the files in `ml/dataset/` and
`apps/api/data/store.json` on 2026-08-24, not copied from an earlier
document — see §7 for the exact commands.

Companion documents:
- [`ml/dataset/v1-training-scope.md`](../../ml/dataset/v1-training-scope.md) — the frozen 16-class subset v1.0.0 trained on
- [`ml/models/ui-detector/v1.0.0/README.md`](../../ml/models/ui-detector/v1.0.0/README.md) — per-class AP@0.5
- [`docs/ml/annotation-guide.md`](annotation-guide.md) — class definitions, hard-negative policy (Rule C)
- [`docs/execution/current-baseline.md`](../execution/current-baseline.md) — Phase 0 baseline

---

## 1. Current corpus at a glance

The **full 41-class** dataset on disk (`ml/dataset/{images,labels}/`), not
the derived 16-class `v1/` subset:

| Split | Images | Labels (label files) |
|---|---:|---:|
| train | 127 | 127 |
| val   | 18  | 18  |
| test  | 17  | 17  |
| **total** | **162** | **162** |

This is 6 images more than the `v1/` subset's 156 — `build-v1-subset.ts`
drops any image that ends up with zero boxes after filtering to the 16
trained classes, and 6 of the full corpus's images only carry annotations
for excluded classes.

**Total label instances (all 41 classes): 2,917.**

## 2. Per-class instance counts — full 41-class corpus

Computed by parsing every `.txt` label file directly (not from the frozen
`v1-training-scope.md`, which only covers the 16-class subset).

| Class | Train | Val | Test | Total | In v1.0.0? |
|---|---:|---:|---:|---:|:---:|
| `input` | 316 | 36 | 35 | 387 | ✅ |
| `text` | 312 | 35 | 31 | 378 | ✅ |
| `heading` | 244 | 21 | 35 | 300 | ✅ |
| `image` | 197 | 26 | 25 | 248 | ✅ |
| `button` | 181 | 21 | 19 | 221 | ✅ |
| `checkbox` | 168 | 22 | 14 | 204 | ✅ |
| `section` | 114 | 12 | 8 | 134 | ✅ |
| `select` | 91 | 12 | 16 | 119 | ✅ |
| `link` | 89 | 13 | 14 | 116 | ✅ |
| `radio_button` | 92 | 8 | 8 | 108 | ✅ |
| `navbar` | 85 | 12 | 8 | 105 | ✅ |
| `footer` | 82 | 12 | 8 | 102 | ✅ |
| `table` | 88 | 5 | 9 | 102 | ✅ |
| `carousel` | 73 | 10 | 13 | 96 | ✅ |
| `form` | 77 | 2 | 7 | 86 | ✅ |
| `textarea` | 67 | 5 | 7 | 79 | ✅ |
| `card` | 20 | 0 | 0 | 20 | ❌ |
| `nav_item` | 18 | 0 | 0 | 18 | ❌ |
| `card_text` | 17 | 0 | 0 | 17 | ❌ |
| `icon` | 16 | 0 | 0 | 16 | ❌ |
| `social_icon` | 14 | 0 | 0 | 14 | ❌ |
| `list` | 7 | 0 | 0 | 7 | ❌ |
| `video` | 6 | 0 | 0 | 6 | ❌ |
| `page` | 5 | 0 | 0 | 5 | ❌ |
| `header` | 5 | 0 | 0 | 5 | ❌ |
| `logo` | 5 | 0 | 0 | 5 | ❌ |
| `card_title` | 4 | 0 | 0 | 4 | ❌ |
| `card_button` | 4 | 0 | 0 | 4 | ❌ |
| `menu_button` | 2 | 0 | 0 | 2 | ❌ |
| `search_box` | 2 | 0 | 0 | 2 | ❌ |
| `sidebar` | 1 | 0 | 0 | 1 | ❌ |
| `carousel_prev` | 1 | 0 | 0 | 1 | ❌ |
| `carousel_next` | 1 | 0 | 0 | 1 | ❌ |
| `carousel_indicator` | 1 | 0 | 0 | 1 | ❌ |
| `breadcrumb` | 1 | 0 | 0 | 1 | ❌ |
| `testimonial` | 1 | 0 | 0 | 1 | ❌ |
| `divider` | 1 | 0 | 0 | 1 | ❌ |
| `avatar` | 0 | 0 | 0 | 0 | ❌ |
| `list_item` | 0 | 0 | 0 | 0 | ❌ |
| `map` | 0 | 0 | 0 | 0 | ❌ |
| `newsletter` | 0 | 0 | 0 | 0 | ❌ |

**4 classes have zero examples anywhere: `avatar`, `list_item`, `map`,
`newsletter`.** They exist in the taxonomy and have documented definitions
(annotation-guide.md), but not one labeled instance exists in the corpus.

All 41 classes DO have a documented definition in
[`docs/ml/annotation-guide.md`](annotation-guide.md) — verified by checking
every class name appears backtick-quoted in that file. Definition coverage
is not the gap; example coverage is.

## 3. Model quality — the 16 already-trained classes

From `ml/models/ui-detector/v1.0.0/metrics.json` (test split, 17 images —
already flagged in that model's own README as too small for the low-count
classes' AP to be statistically meaningful):

| Class | Test AP@0.5 | Test instances | Quality band |
|---|---:|---:|---|
| `section` | 0.995 | 8 | strong |
| `footer` | 0.995 | 8 | strong |
| `navbar` | 0.995 | 8 | strong |
| `table` | 0.995 | 9 | strong |
| `image` | 0.995 | 25 | strong |
| `button` | 0.972 | 19 | strong |
| `form` | 0.953 | 7 | strong |
| `input` | 0.929 | 35 | strong |
| `textarea` | 0.774 | 7 | medium |
| `text` | 0.791 | 31 | medium |
| `link` | 0.757 | 14 | medium |
| `heading` | 0.732 | 35 | medium |
| `checkbox` | 0.634 | 14 | **weak** |
| `carousel` | 0.539 | 13 | **weak** |
| `radio_button` | 0.499 | 8 | **weak** |
| `select` | 0.364 | 16 | **weak** |

The registry README's own root-cause analysis (already correct, re-verified
here, not repeated in full): `select`/`textarea`/`input`/`button` are drawn
as visually-identical rectangles and the detector confuses them; the
`radio_button`↔`checkbox` confusion sits at the annotation-guide's own
documented resolution floor; `carousel`'s extent is genuinely ambiguous as a
container.

## 4. Priority matrix (plan §5.2 / §5.7 format)

**P0 — fix before anything else.** Low AP AND high product importance AND
already has meaningful volume in the corpus:

| Class | Why P0 |
|---|---|
| `select` | AP 0.364 — worst in the trained set. Every form-heavy sketch needs it. 119 instances already exist — the gap is quality of examples (chevron-distinguishing), not quantity. |
| `radio_button` | AP 0.499. Confused with `checkbox` at the annotation resolution floor and with `heading` (control+caption boxed as one region — a labeling consistency issue, not a data volume issue). |
| `carousel` | AP 0.539, and 46% of test instances are missed entirely (predicted as background). Container-extent ambiguity needs a labeling-guide clarification, not just more images. |
| `card` | **Currently untrained** (0 in val, 0 in test — cannot even be evaluated) despite driving the card-grid layout inference in `packages/codegen/src/layout.ts` (per `v1-training-scope.md`'s own exclusion note). Only 20 instances, all in train. |
| `page` | **Currently untrained.** Drives §10's page-boundary detection, the product's core differentiator. Only 5 instances (the 5 in-house sketches), all in train, 0 measurable. |

**P1 — next priority.** Medium AP with high visual/structural value, or
meaningfully-sized excluded classes:

| Class | Why P1 |
|---|---|
| `checkbox` | AP 0.634, 204 instances — best-represented of the "weak" group; likely the closest to crossing into "strong" with a modest data push. |
| `heading` / `text` / `link` | AP 0.73-0.79 — near-universal in any UI, worth tightening even though they're not failing. |
| `textarea` | AP 0.774, smallest "eligible" class at 79 instances — thin margin above the eligibility floor. |
| `nav_item` | 18 instances, drives navbar child structure; excluded only for lack of val/test coverage. |
| `card_title` / `card_button` | 4 each — drive the same card-grid inference as `card`; too thin to even discuss training yet, but P1 for *labeling* priority. |
| `icon`, `social_icon` | 16 / 14 instances — common in real UI, currently excluded. |

**P2 — low frequency, optional, defer:**

| Class | Count | Note |
|---|---:|---|
| `list`, `video`, `header`, `logo` | 5-7 | Present but thin; not core to layout inference the way `card`/`page` are. |
| `menu_button`, `search_box` | 2 each | Niche controls. |
| `sidebar`, `carousel_prev`, `carousel_next`, `carousel_indicator`, `breadcrumb`, `testimonial`, `divider` | 1 each | Single-instance classes; cannot be meaningfully evaluated with any split. |
| `avatar`, `list_item`, `map`, `newsletter` | **0** | Zero examples anywhere. Lowest priority by volume, but flagged because a class with a definition and zero examples is exactly the "looks trained but isn't measurable" trap `v1-training-scope.md` already warns about — do not add these to a future training run's class list until they have real examples. |

## 5. Dataset quality checks (plan §5.4)

Ran directly against every `.txt` label file and every image file in
`ml/dataset/{images,labels}/{train,val,test}/` (162 images, 2,917 label
instances):

| Check | Result |
|---|---|
| Zero-area boxes (`width <= 0` or `height <= 0`) | **0** |
| Non-finite coordinates | **0** |
| Boxes outside `[0,1]` beyond a 0.001 tolerance | **0** |
| Class ids not in `classes.txt` | **0** (parser would have skipped them; none found) |
| Empty label files | **4**, all in `train`: `4a61adec…`, `4c130724…`, `7d3fdf80…`, `de56b742…` |
| Stems appearing in more than one split (filename-level leakage) | **0** |
| Images with no matching label file, or vice versa | **0** |
| **Exact byte-identical duplicate images (MD5)** | **5 groups, 11 files, 6 "extra" copies** — see §5.1 |

Labels are geometrically clean: no malformed, zero-area, or out-of-bounds
boxes anywhere in the corpus. The two real findings are duplicate images and
the empty-label files, both detailed below.

### 5.1 Duplicate images — the most actionable finding in this report

MD5-hashing every image file found **156 unique images across 162 files** —
6 files are exact byte-for-byte duplicates of another file already in the
corpus:

| Duplicate group | Files | Extra label instances counted twice |
|---|---|---:|
| 1 | `4a61adec…`, `7c0d1e90…`, `eac50861…` (3 copies of one image) | 49 + 1 = 50 |
| 2 | `4c130724…`, `dd110664…` | 30 |
| 3 | `7225c308…`, `corr_aa1cc263…` | 73 |
| 4 | `7d3fdf80…`, `corr_0d7ca9e8…` | 65 |
| 5 | `corr_5182df8b…`, `de56b742…` | 0 |

**All 6 extra copies live in `train` only** — confirmed by inspecting each
group; no duplicate crosses into `val` or `test`. This means **the current
dataset has no duplicate-driven train/test leakage** (the specific harm the
plan's Appendix D warns about), which is the good news.

The bad news: **218 of the corpus's 2,917 label instances (≈7.5%) are
counted from images that are byte-identical to another image already in the
dataset.** This inflates the per-class counts in §2 above without adding any
real visual diversity — the model sees the exact same pixels multiple times
labeled the exact same way, which teaches nothing a single copy wouldn't.

**Root cause, from the asset ids involved:** these are the small number of
distinct in-house sketches, re-uploaded across multiple test/demo projects
during development (project names visible in `report:active-learning`
output include "Detect test", "Step10 verify", "Step11 e2e", "E2E final",
"Correction test", "Boundary test" — clearly iterative development sessions
reusing the same handful of source images). Each re-upload gets a fresh
asset UUID, so the exporter treats it as a new, distinct image. The
exporter's existing "supersede" logic
(`removeUnprefixedExport` in `export-yolo-dataset.ts`) only deduplicates
**the same asset id** when it gets approved — it has no cross-asset,
content-level dedup, so two *different* assets that happen to share image
bytes both get exported.

**Recommendation:** before the next `npm run export:dataset` run intended to
feed a real training run, either (a) delete the redundant projects/assets in
`apps/api/data/store.json` so only one upload per distinct sketch survives,
or (b) add a content-hash dedup pass to `export-yolo-dataset.ts` that keeps
only the first asset per image MD5.

> **UPDATE (same day, Phase 6 prep):** option (b) was implemented —
> `export-yolo-dataset.ts` now hashes image content and refuses to export the
> same bytes twice, with approved-correction samples claiming their hash first
> (they are the authoritative version of an image). Option (b) was chosen over
> (a) because it is non-destructive — no user data is deleted — and it prevents
> the problem recurring on every future re-upload rather than cleaning it up
> once.
>
> Running the exporter against the **live store** (`data/uploads/`, 14 files)
> rather than the already-exported corpus surfaced **one additional duplicate
> pair this report's original scan missed**: `4c6b43be…` / `3eb8232e…`. Both are
> un-annotated uploads, so neither had ever been exported with labels — they
> were invisible to a scan of `ml/dataset/images/`. The live store contains
> **8 unique images across 14 files** (independently confirmed with `md5` and
> `cmp`), i.e. **6 duplicate copies**, which is exactly what the new dedup pass
> now skips.
>
> The fix is in place but **has not been applied to the on-disk corpus** — that
> requires a real (non-`--dry-run`) `npm run export:dataset`, which is a data
> operation left for whoever runs the next training refresh.

### 5.2 Empty label files

4 images in `train` have empty label files (`de56b742…`, `4c130724…`,
`4a61adec…`, `7d3fdf80…`). Cross-checking these against the store: the live
`npm run export:dataset --dry-run` run (§7) flagged 7 currently-unannotated
assets in the live store, of which these 4 previously made it to disk with
empty labels. Per the annotation guide (§9.5, quoted in
`export-yolo-dataset.ts`'s own report logic): an empty label file is only
correct for a deliberate background/negative example. These 4 do **not**
appear to be deliberate negatives — they read as simply un-annotated
uploads that got swept into an export before anyone drew boxes on them. **Do
not treat these as background training signal without manual confirmation**
— an accidentally-empty label teaches the model that a page full of real UI
is background, which actively hurts recall.

## 6. Hard negatives (plan §5.5) — status: not yet present in the corpus

The annotation guide already has the correct **policy** (Rule C, §9.5:
"Sweep for negatives — confirm nothing outside the page frame got a box"),
and the page-boundary filtering system (`services/cv-worker/app/
preprocessing/boundary_filter.py` + `packages/shared-types/src/
boundary-geometry.ts`) already implements the runtime mechanism for
rejecting off-page detections.

What's missing is **corpus content**: images that actually contain
handwritten notes, arrows, or measurements outside the page frame, correctly
left unlabeled, so the detector learns what to ignore rather than only
being told to ignore it by post-hoc geometric filtering.

This cannot be verified by parsing label files alone — a hard negative is
defined by the *absence* of a label in a region that a naive detector might
fire on, which requires looking at the actual images. From what's
verifiable without opening every image:

- Only the 5 in-house sketches (`page` class, 5 instances) have real page
  structure; the 156 external images are professionally-drawn wireframes
  from Roboflow Universe, unlikely to contain handwritten off-page notes.
- `docs/ml/fixtures/hdwe_radio_heavy.overlay.jpg` and
  `sample_wildcard.overlay.jpg` (used by the boundary-parity/page-boundary
  test fixtures, not the training set) are the only images in the repo
  explicitly associated with boundary-edge-case content — worth checking as
  candidates for hard-negative examples, but they are TEST fixtures, not
  currently part of the training corpus.

**Recommendation:** the 5 in-house sketches are the only realistic source of
genuine hard negatives today. Before/during the next annotation round,
deliberately photograph or sketch 3-5 new samples that include off-page
handwritten notes, arrows, and measurements per the plan's exact list
(§5.5), and confirm during annotation that Rule C is followed (nothing
outside the drawn page gets a box). This is a data-collection action item,
not something achievable by re-processing the existing corpus.

## 7. Reproducibility — exact commands run

```bash
npm run report:active-learning
npm run export:dataset -- --dry-run
```

Plus three inline Node scripts (not committed as standalone tools — see
§8's recommendation) that:
1. tallied per-class/per-split instance counts and ran the zero-area /
   non-finite / out-of-bounds / cross-split-stem checks by parsing every
   `ml/dataset/labels/**/*.txt` file directly;
2. MD5-hashed every file in `ml/dataset/images/**/*` to find exact
   duplicates;
3. cross-referenced every class name in `ml/dataset/classes.txt` against
   `docs/ml/annotation-guide.md` for definition coverage.

`npm run import:external` was **not** run — it downloads two external ZIPs
from Roboflow Universe over the network, which is unnecessary here since
the already-imported files are on disk and directly inspectable. Running it
is safe (dry-run available) but adds a network dependency this report did
not need.

## 8. What this report does NOT do (by design — plan §5 scope)

- **No retraining.** No `ml/training/train_v1.py` run, no new
  `ml/models/ui-detector/*` directory.
- **No model weight changes.** `ml/models/ui-detector/v1.0.0/weights.pt` is
  untouched.
- **No dataset mutation.** `ml/dataset/` was only read, never written to —
  the `--dry-run` flag was used on every script that could write.
- **No de-duplication tooling built yet.** §5.1's recommendation (content-
  hash dedup in the exporter) is a Phase 6 prerequisite, not implemented
  here. Building it now would be scope creep against "focus only on
  dataset quality" (the Phase 5 prompt's explicit instruction) — flagging
  the gap accurately is this phase's job; fixing the exporter is next
  phase's or a dedicated data-cleanup phase's job.
  *(Superseded — see the UPDATE in §5.1: the dedup pass was implemented
  immediately afterwards as Phase 6 preparation, since it is a hard
  precondition for a defensible v1.1 comparison.)*
- **No expansion to the full 41-class training set.** Per plan §5.3, doing
  so requires every class to have definition + positive examples + negative
  examples + enough images + annotation consistency. Definitions are
  complete (§2); the other four are not, for 25 of 41 classes (§4).

## 9. Recommended next actions, in priority order

1. **Resolve the 6 duplicate-image assets** in the live store (§5.1) before
   any export intended for real training — either delete the redundant
   projects or add exporter-side content-hash dedup.
2. **Manually confirm or fix the 4 empty-label images** (§5.2) — either
   annotate them or explicitly mark them as deliberate negatives.
3. **Collect true hard-negative examples** (§6) — off-page handwritten
   notes, arrows, measurements — since none currently exist in the corpus.
4. **Target new annotation effort at the P0 classes** (§4): more/better
   `select`, `radio_button`, `carousel` examples (quality-focused per the
   registry README's own diagnosis, not just volume), plus first-ever
   `card` and `page` examples with enough volume to populate val/test.
5. Only after 1-4: consider a `v1.1` retrain and re-run this report against
   the refreshed corpus before deciding whether to promote it (Phase 6/7).
