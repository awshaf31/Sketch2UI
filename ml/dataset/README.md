# Sketch2UI YOLO dataset

Plan references: §9.4–9.7 (dataset requirements, negatives, annotation policy, split),
§22 (training and dataset management workflow), §51 step 7.

Labelling rules live in [`docs/ml/annotation-guide.md`](../../docs/ml/annotation-guide.md).
That guide is the contract; this file describes the layout and the split.

## Layout

```
ml/dataset/
├── classes.txt        # frozen class list — index = YOLO class id
├── data.yaml          # Ultralytics/YOLO config
├── images/{train,val,test}/
└── labels/{train,val,test}/
```

Each `images/<split>/<name>.<ext>` has a matching `labels/<split>/<name>.txt`. Label
lines are `class_id x_center y_center width height`, all normalized to `[0, 1]`.

Both `classes.txt` and `data.yaml` are **generated** by the exporter — do not hand-edit.

`classes.txt` is committed: it is the machine-independent label contract. `data.yaml`,
`images/` and `labels/` are **not** committed — they are build output, and `data.yaml`
embeds an absolute `path:` for the machine that generated it. Run the exporter after
cloning.

## Generating it

The dataset is built from two independent sources, in this order:

```bash
# 1. our own manual annotations (unprefixed filenames)
npm run export:dataset              # from the repo root
npm run export:dataset -- --clean   # drop stale manual labels first (after re-annotating)
npm run export:dataset -- --dry-run # report only, write nothing

# 2. the external CC BY datasets (hdwe_ / wf_ prefixed filenames)
npm run import:external
npm run import:external -- --dry-run
npm run import:external -- --redownload
```

Run the exporter **first**: it regenerates `classes.txt` from the taxonomy, and the
importer refuses to run against a stale one.

`--clean` on the exporter removes only *unprefixed* (manually-annotated) files. Files
carrying an external source prefix are spared, because the exporter cannot regenerate
them — re-run `import:external` to refresh those.

The exporter reads `apps/api/data/store.json` and `data/uploads/`, takes every
`Detection` with `status === "active"` and `source === "manual"`, converts it to YOLO
format, and writes the image/label pairs. Model-produced detections are excluded on
purpose: training on them would be self-training on the detector's own output.

The labelling tool is the **existing annotation canvas in `apps/web`** — drawing a box
and picking a class there produces exactly the records this script consumes. There is no
separate labelling tool.

## External data sources and attribution

Two externally-sourced datasets are merged in by `npm run import:external`. **Both are
licensed CC BY 4.0, which requires attribution on redistribution** — keep this section
intact in anything derived from this dataset, and carry it into the model card when a
detector is trained on it.

| Prefix | Source dataset | Images | Upstream | License |
|---|---|---:|---|---|
| `hdwe_` | Hand Drawn Web Element | 51 | Roboflow Universe — workspace `web-element-detection`, project `hand-drawn-web-element` | CC BY 4.0 |
| `wf_` | wireframe | 100 | Roboflow Universe — workspace `sketch-tsqe0`, project `wireframe-ktxpn` | CC BY 4.0 |

License text: https://creativecommons.org/licenses/by/4.0/

**Note on provenance.** The zips actually downloaded are *forks* in the
`ahsaf-ahamed` workspace (`hand-drawn-web-element-sgzvd` and `wireframe-ktxpn-fbnvc`),
so the `roboflow:` block inside each `data.yaml` names the fork, not the original
author. The upstream workspace/project above is what CC BY attribution is owed to, and
was supplied out-of-band rather than read from the archives — **verify it against the
Universe listings before publishing**, since a fork's metadata cannot confirm it.

### Class remapping

Neither source uses our taxonomy, so `import-external-datasets.ts` holds an explicit
remap table per source. Anything not in the table is dropped, counted, and reported —
never guessed at.

Two `wireframe` mappings were judgement calls and are printed as a callout on every run.
Both have now been spot-checked against `wf_0`, `wf_11` and `wf_12` (3 of 100 images):

| Source class | Maps to | Status |
|---|---|---|
| `container` | `section` | **Verified.** It is the main content rectangle — the navbar and footer sit *outside* it, so it is not the page boundary. |
| `frame` | `image` | **Corrected.** Originally mapped to `page`. `wf_12` carries two `frame` boxes landing exactly on its two crossed-out image placeholders, and a page boundary is unique per sketch — so `frame` means image placeholder here. |

Re-verify if you extend the review to more of the set. Note the consequence: the
`wireframe` source contributes **no** `page` labels, so every `page` example in the
merged dataset comes from our own manual annotations.

From Hand Drawn Web Element, `Pagination`, `Table head`, `Table row` and `Table data`
are **dropped**: they are sub-boxes of the same region already labelled `Table`, and
keeping them would stack differently-classed detections over the same pixels, which the
annotation guide's Rule B forbids.

## Class ids are frozen

`classes.txt` is derived from `ALL_CLASSES` in
`packages/shared-types/src/taxonomy.ts`, and a class's **position is its id**. Every
label file on disk stores those integers.

**Reordering or removing an entry silently invalidates every existing label file.** The
exporter compares `classes.txt` against the taxonomy on each run and aborts with a diff
if they disagree, rather than writing corrupt labels.

To add a class: append it to the end of its group in `taxonomy.ts` such that it lands at
the end of `ALL_CLASSES`, delete `classes.txt`, re-export, and bump the dataset version.

## Training subsets (§9.3)

Not every taxonomy class has enough data to train or evaluate on. §9.3 warns that too
many visually-similar classes on too little data just produces confusion, so a model
version may train on a **subset**:

```bash
npm run build:v1        # -> ml/dataset/v1/ + v1-classes.txt + v1-training-scope.md
```

`ml/dataset` stays the **full 41-class source of truth**. `ml/dataset/v1/` is a derived
view, fully regenerated on each run and never hand-maintained. Building it does not
touch `classes.txt`, `data.yaml`, `images/`, `labels/`, or `taxonomy.ts`.

⚠ **Two separate class-id namespaces.** YOLO requires contiguous ids `0..nc-1`, so the
subset is renumbered. A v1 label's class `3` is *not* full-taxonomy class `3`.
`ml/dataset/v1-classes.txt` is the frozen translation for that model version, and it is
shipped inside the model registry directory alongside the weights. Never mix the two.

Eligibility rule and the excluded-class list live in
[`v1-training-scope.md`](./v1-training-scope.md). Exclusion means *insufficient data*,
never *unimportant* — the excluded classes remain fully part of the taxonomy and should
still be labelled.

## Split policy (§9.7)

| Split | Target | Actual bucket |
|---|---|---|
| train | 70–80% | hash % 100 < 75 |
| val | 10–20% | 75–89 |
| test | 10–15% | 90–99 |

The split is **deterministic**, from an FNV-1a hash of the asset id — not random. So
re-running the export never moves an image between splits, and a sketch cannot leak from
train into test on a later run.

⚠ **The hash cannot detect near-duplicates.** §9.7 requires that near-identical sketches
never land in different splits, and two photos of the same drawing have unrelated asset
ids. Until a perceptual-hash grouping step exists, **manually verify** that redraws,
re-scans, or multiple photos of one sketch all end up in the same split — or keep only
one copy in the dataset.

With a small dataset the percentages will not land near the targets; the hash only
approaches them as image count grows. Check the exporter's printed split summary.

## Negative / background images (§9.5)

Not yet present. Once available, the dataset should include images whose label file is
**empty** — teaching the model that these are not UI components:

- off-page notes ("this image remains static", "add more sections")
- arrows, brackets, leader lines to callouts
- measurements and dimension marks
- random handwriting, decorative strokes
- table/grid rules, ruled-paper lines
- page titles written outside the page frame

The exporter already writes an empty `.txt` for any image with no labels and warns about
it, since an un-annotated sketch is indistinguishable from an intentional negative. Treat
that warning as a to-do list until negatives are deliberately curated.

## Dataset requirements (§9.4)

Coverage to aim for as the set grows: different paper types, pen/pencil thickness, camera
angles, lighting, handwriting, UI structures, page lengths, and annotation styles.

## Versioning (§22.6)

Snapshot as `dataset-v1`, `dataset-v2`, … recording class list, image count, split,
annotation rules, source, and validation results. Not yet versioned — v1 should be cut
once the class coverage gaps in the exporter's report are filled.
