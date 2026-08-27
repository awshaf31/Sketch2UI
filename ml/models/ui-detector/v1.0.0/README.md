# ui-detector v1.0.0

⚠️ **PIPELINE SMOKE TEST — NOT A PRODUCTION MODEL.**

Trained on **156 images** across **16 classes**. That is far below what a
16-class hand-drawn-sketch detector needs. The metrics below show the
training and evaluation pipeline runs end to end (§9.8). They are **not** evidence that
this detector is usable, and it should not be wired into `cv-service` or
`backend` on the strength of them.

Frozen per §9.10. Do not overwrite this directory — cut a new version instead.

## Contents

| File | What |
|---|---|
| `weights.pt` | best checkpoint by val fitness |
| `data.yaml` | the exact v1-subset config used for training |
| `classes.txt` | **v1 subset class order — frozen.** Model output ids index THIS file, not `ml/dataset/classes.txt` |
| `metrics.json` | §9.9 metrics, val and test |
| `confusion_matrix*.png`, `results.png`, `PR_curve.png` | §9.8 step 6 diagnostics |

⚠️ **Class-id namespace.** This model emits ids `0..15` indexing
`classes.txt` *in this directory* — the 16-class v1 subset. The full taxonomy has 41
classes with different ids (`ml/dataset/classes.txt`). Anything consuming this model
must translate through the file shipped here.

## Dataset

- Source: `ml/dataset/v1`, a derived view of the full 41-class `ml/dataset`.
- Scope and exclusion rationale: `ml/dataset/v1-training-scope.md`.
- 25 taxonomy classes were **excluded for insufficient data**, not because they are
  unimportant — several (`page`, `card`, `nav_item`) are central to the product.
- Upstream data includes two CC BY 4.0 datasets from Roboflow Universe; see
  `ml/dataset/README.md` for the attribution that must travel with any redistribution.

## Training config

| Setting | Value |
|---|---|
| pretrained weights | `yolov8n.pt` (transfer learning — §9.8 step 4) |
| epochs | 60 |
| image size | 640 |
| batch | 8 |
| seed | 0 |
| device | cpu |
| ultralytics | 8.3.0 |
| torch | 2.8.0 |
| python | 3.9.6 |

## Metrics (§9.9)

| Split | Precision | Recall | mAP@0.5 | mAP@0.5:0.95 |
|---|---:|---:|---:|---:|
| val | 0.7853 | 0.7651 | 0.8326 | 0.6384 |
| test | 0.8085 | 0.7451 | 0.8075 | 0.6475 |

### Per class (test split, val AP@0.5 for comparison)

| Class | P | R | AP@0.5 | AP@0.5:0.95 | val AP@0.5 |
|---|---:|---:|---:|---:|---:|
| `section` | 0.944 | 1.000 | 0.995 | 0.887 | 0.995 |
| `footer` | 0.937 | 1.000 | 0.995 | 0.832 | 0.995 |
| `navbar` | 0.934 | 1.000 | 0.995 | 0.859 | 0.995 |
| `form` | 0.903 | 0.857 | 0.953 | 0.732 | 0.497 |
| `table` | 0.972 | 1.000 | 0.995 | 0.906 | 0.895 |
| `heading` | 0.667 | 0.743 | 0.732 | 0.441 | 0.964 |
| `text` | 0.873 | 0.452 | 0.791 | 0.620 | 0.923 |
| `link` | 0.761 | 0.786 | 0.757 | 0.586 | 0.938 |
| `image` | 0.977 | 1.000 | 0.995 | 0.843 | 0.995 |
| `carousel` | 0.794 | 0.154 | 0.539 | 0.428 | 0.540 |
| `button` | 0.840 | 0.947 | 0.972 | 0.749 | 0.980 |
| `input` | 0.949 | 0.771 | 0.929 | 0.675 | 0.932 |
| `textarea` | 0.554 | 1.000 | 0.774 | 0.679 | 0.577 |
| `select` | 0.523 | 0.140 | 0.364 | 0.311 | 0.548 |
| `checkbox` | 0.898 | 0.571 | 0.634 | 0.494 | 0.834 |
| `radio_button` | 0.410 | 0.500 | 0.499 | 0.318 | 0.713 |

## Known weak classes (§9.8 step 7)

Lowest test AP@0.5:

- `select` — AP@0.5 0.364
- `radio_button` — AP@0.5 0.499
- `carousel` — AP@0.5 0.539

These are not guesses — here is what the test-split confusion matrix actually shows
(columns = ground truth, read as "true X was predicted as…"):

**`select`** — 16 instances, only **1 correct (6%)**:

| predicted as | share |
|---|---:|
| `textarea` | 37.5% |
| `input` | 25.0% |
| `button` | 18.8% |
| `select` ✓ | 6.2% |
| `carousel` / `link` | 6.2% each |

This is §9.3's warning realised almost exactly. A hand-drawn `select`, `textarea`,
`input` and `button` are all *the same drawing* — a rectangle. The only distinguishing
mark is a small chevron, and at 640px with this little data the detector never learns to
key on it. Note the failure is not random: 81% of the mass lands on the three other
rectangle classes.

**`radio_button`** — 8 instances (a very small sample; treat cautiously), 37.5% correct:

| predicted as | share |
|---|---:|
| `radio_button` ✓ | 37.5% |
| `heading` | 37.5% |
| `checkbox` | 25.0% |

The `checkbox` confusion is the expected one — square vs circle at ~8×8px is near the
resolution floor the annotation guide flags. The `heading` confusion is more interesting:
radio buttons are drawn adjacent to their caption text, and the model appears to be
predicting one box over the control-plus-label region rather than the control alone.

**`carousel`** — 13 instances, 23% correct, and **46% missed entirely** (predicted as
background):

| predicted as | share |
|---|---:|
| `background` (missed) | 46.2% |
| `textarea` | 23.1% |
| `carousel` ✓ | 23.1% |
| `navbar` | 7.7% |

Different failure mode from the other two: `carousel` is a large *container* whose
extent is genuinely ambiguous — it overlaps the content it contains, so the model either
fails to fire at all or labels it as some other large rectangle.

One more worth noting even though it did not make the bottom three: **`text` → `heading`
at 22.6%**, and `heading` → `radio_button` at 14.3%. Text and heading differ only by
prominence, which is exactly the kind of relative judgement a detector with 156 images
cannot calibrate.

**Do not fix this by retraining with different hyperparameters.** The constraint is data
volume, not optimisation. §9.8 steps 8-9: add difficult examples for the weak classes,
then retrain.

## Next steps

1. Collect more sketches, especially for the weak classes above and the 25 excluded ones.
   For `select` specifically, the useful examples are ones that force the chevron to
   matter: selects drawn next to visually identical inputs and textareas.
2. Re-run `npm run export:dataset && npm run import:external && npm run build:v1`.
3. Retrain as a new version — never overwrite this one.
4. Only wire a model into `cv-service` (§51 step 9) once its metrics justify it.

## Why the headline numbers overstate this model

test mAP@0.5 of 0.807 looks respectable and is misleading. Three reasons:

1. **The test split is 17 images.** Several classes have single-digit instance counts
   (`radio_button` n=8, `carousel` n=13), so their AP moves in large jumps and carries
   almost no statistical weight.
2. **The score is carried by easy structural classes.** `section`, `footer`, `navbar`,
   `table` and `image` all sit at AP@0.5 0.995 — they are large, high-contrast, and
   roughly one-per-image, so a detector can learn them from very few examples. They pull
   the mean up while the classes that actually distinguish UI semantics (`select`,
   `radio_button`, `carousel`) sit between 0.36 and 0.54.
3. **131 of 156 images come from two external datasets** with their own drawing
   conventions. Performance on *our* users' sketches is not measured here — only five
   in-house sketches exist, and all five are in `train`.

Read the per-class table, not the headline mAP.
