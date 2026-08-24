---
title: "Sketch2UI — Detector Architecture Decision (pre-v1.1)"
status_date: "2026-08-24"
status: "DECIDED — Option A (keep YOLOv8-nano) as the primary line, with a controlled YOLOv5n arm deferred to the first data-improved retrain"
purpose: "Execution plan Phase 6 gate. The plan forbids silently changing the detector architecture; this records the decision, the evidence behind it, and the inference-API compatibility analysis BEFORE any training runs."
---

# Detector architecture decision — YOLOv8-nano vs. YOLOv5

**This document is a Phase 6 precondition.** The execution plan (§9, Phase 6)
states: *"Claude Code must not silently replace the model architecture. The
implementation decision must be explicit."* No training has been run and no
weights have changed as of this document.

## 1. The discrepancy being resolved

| | |
|---|---|
| What the project title / original plan says | **YOLOv5 tiny** |
| What `ml/models/ui-detector/v1.0.0/metrics.json` actually records | `"pretrained_weights": "yolov8n.pt"` |
| What `ml/training/train_v1.py` defaults to | `--model yolov8n.pt` |

So the shipped v1.0.0 detector is **YOLOv8-nano fine-tuned from COCO weights**,
not literal YOLOv5. This was already flagged honestly in `PROJECT_STATUS.md`
§3.1 and in the Phase 0 baseline — it is a known, documented divergence, not a
discovery. What was missing is a *decision* about what to do next, which is
what this document supplies.

## 2. The plan frames this as binary. It is actually three options.

The execution plan offers "Option A — keep YOLOv8-nano" vs. "Option B — train
literal YOLOv5 tiny/small". Inspecting the installed stack shows Option B
splits into two genuinely different things with very different risk profiles:

| Option | What it is | Inference-API impact |
|---|---|---|
| **A** | Keep `yolov8n.pt` (C2f blocks, anchor-free head) | none — status quo |
| **B1** | `yolov5n.yaml` **as shipped inside `ultralytics` 8.3.0** — genuine YOLOv5 v6.0 backbone/neck (C3 blocks) with ultralytics' anchor-free `Detect` head | **none** — verified below |
| **B2** | Classic YOLOv5 from the separate `ultralytics/yolov5` repository — original anchor-based head, own training CLI, own `torch.hub` load path | **breaking** — different package, different Results API |

The plan's Option B, read literally ("aligns exactly with the original project
specification"), points at **B2**. That is the expensive one. **B1** delivers
the YOLOv5 *architecture* at essentially zero integration cost, which the plan's
binary framing obscures.

## 3. Evidence — measured, not assumed

All figures produced locally against the project's own pinned stack
(`services/cv-worker/.venv`, ultralytics 8.3.0, torch 2.8.0), not quoted from
upstream documentation.

### 3.1 Both architectures build in the existing stack

```
yolov5n.yaml     params= 2,222,064  modules=  286
yolov8n.yaml     params= 2,724,448  modules=  249
```

YOLOv5-nano is **smaller** than YOLOv8-nano here (2.22M vs 2.72M parameters,
−18%), with more modules (286 vs 249 — C3 blocks decompose into more layers
than C2f). Both instantiate cleanly from YAML at `nc=16` with no errors.

Ultralytics 8.3.0 ships `yolov5.yaml` and `yolov5-p6.yaml` in
`ultralytics/cfg/models/v5/`, so `--model yolov5n.yaml` is a supported,
first-class path — no third-party code, no new dependency.

### 3.2 The two YAMLs differ in backbone, agree on head

Verified by reading both config files directly:

- `yolov5.yaml` backbone/neck: **`C3`** blocks — this is the genuine YOLOv5 v6.0
  topology.
- `yolov8.yaml` backbone/neck: **`C2f`** blocks — YOLOv8 topology.
- **Both terminate identically:** `[[...], 1, Detect, [nc]]` — the same
  ultralytics anchor-free decoupled detection head.

This is the crux of the whole decision. Because the head is identical, the
**output tensor format is identical**, which is what the inference layer
actually couples to.

### 3.3 Inference-API compatibility — the deciding technical fact

`services/cv-worker/app/detector/model.py` touches the model through exactly
three surfaces:

```python
self.model = YOLO(str(weights))              # generic ultralytics loader
results = self.model.predict(...)            # generic ultralytics predict
for xywhn, cls_id, conf in zip(boxes.xywhn, boxes.cls, boxes.conf):
```

None of these are YOLOv8-specific. `boxes.xywhn` / `.cls` / `.conf` are the
ultralytics `Results.boxes` API, produced identically by any model the
`ultralytics` package can load — including `yolov5n`.

**Consequence:** switching A → B1 requires changing **one CLI default** in
`ml/training/train_v1.py` (`--model yolov5n.yaml`) and **zero lines** in
`model.py`, `main.py`, the API, or the frontend. The registry layout
(§9.10 — `weights.pt` + `classes.txt` + `metrics.json` per version) already
carries everything the loader needs, and `MODEL_VERSION` already lets the
worker point at a different version directory without a code change.

Switching A → **B2** would instead require replacing `YOLO(...)` with the
yolov5 repo's `torch.hub` load path, rewriting the result-unpacking loop for a
different `Results` shape, adding a second ML dependency alongside
`ultralytics`, and breaking the "one pinned stack shared by
`ml/training/requirements.txt` and `services/cv-worker/requirements.txt`"
property that currently guarantees weights frozen by training load unchanged in
the worker.

## 4. Decision

> **Keep YOLOv8-nano (Option A) as the primary model line for v1.1.**
> **Do not adopt B2 (classic YOLOv5 repo) at all.**
> **Run B1 (`yolov5n.yaml`) as a controlled second arm — but only once the
> dataset issues from Phase 5 are fixed, and only as an A/B against a v8n
> trained on the identical corpus.**

### Why keep A as primary

1. **The measured bottleneck is data, not architecture.** The v1.0.0 registry
   README's own confusion-matrix analysis concludes: *"Do not fix this by
   retraining with different hyperparameters. The constraint is data volume,
   not optimisation."* Phase 5's quality report independently reconfirmed this
   — 4 classes with zero examples, 25 of 41 unevaluable, ~7.5% of label
   instances coming from duplicate images, no hard negatives in the corpus at
   all. Changing the backbone does not add a single `card` or `page` example.
2. **Changing two variables at once destroys the comparison.** Phase 7 gates
   promotion on comparing v1.1 against `docs/eval/baseline-v1.0.0.json`. If
   v1.1 changes *both* the data and the architecture, a metric movement is
   uninterpretable — there is no way to attribute it. The plan's own §6.2
   promotion rule ("overall metrics ≥ baseline AND critical class metrics not
   materially worse") presumes an attributable comparison.
3. **Zero migration risk on the path that is already working.** The
   sketch → detect → correct → generate pipeline is the project's working core
   (Phase 0 baseline). Rule 2 of the operating rules is "preserve working
   behavior."

### Why B1 is worth doing later, and B2 never

- B1 is nearly free (one flag), is *smaller* (2.22M vs 2.72M params — relevant
  to the "lightweight/tiny detector" role §9 actually describes), and would let
  the project state truthfully that the YOLOv5 architecture was evaluated
  head-to-head rather than dismissed. For an academic prototype whose title
  names YOLOv5, that is a real and legitimate benefit — but it is a benefit
  that costs nothing to defer and is *worth more* when run as a clean
  controlled comparison on a fixed dataset.
- B2's only advantage is literal naming fidelity to the original spec. It costs
  a second ML dependency, a rewritten inference path, loss of the shared-pin
  guarantee, and real regression risk to a working pipeline — in exchange for
  an architecture that B1 already provides. **The cost/benefit is not close.**

### The honest caveat on B1's "YOLOv5-ness"

`yolov5n.yaml` in ultralytics is YOLOv5's **backbone and neck** with
ultralytics' **anchor-free head** (§3.2). It is *not* bit-identical to the 2020
anchor-based YOLOv5. Any write-up must say "YOLOv5 backbone (C3) with an
anchor-free detection head, via Ultralytics 8.3" rather than claiming plain
"YOLOv5" — describing it as the latter would be the same category of
imprecision this document exists to correct.

## 5. Preconditions before ANY v1.1 training run

Derived from `docs/ml/dataset-quality-v1.1.md` §9. Training before these are
met would produce a model that cannot be honestly compared to v1.0.0:

- [ ] **Duplicate images resolved** — 6 byte-identical extra copies inflating
      ~7.5% of label instances. *(Addressed by the content-hash dedup added to
      `export-yolo-dataset.ts` alongside this document — re-run the exporter to
      apply it.)*
- [ ] **4 empty-label files confirmed or fixed** — currently indistinguishable
      from un-annotated uploads; as background negatives they would actively
      teach the model that real UI is background.
- [ ] **New labeled data for P0 classes** — `select`, `radio_button`,
      `carousel` (quality-focused: examples that force the distinguishing mark
      to matter), plus first-ever evaluable `card` and `page` coverage.
      **This requires human annotation work and is the true blocker.**
- [ ] **At least a few genuine hard negatives** — off-page handwritten notes,
      arrows, measurements. None exist in the corpus today.

**Retraining on today's corpus would be theater.** With identical data,
identical config, and a fixed seed, a v1.1 run reproduces v1.0.0's numbers to
within noise. It would produce a version bump, a new registry directory, and no
new information — while consuming the one clean baseline comparison Phase 7
depends on.

## 6. When the preconditions are met — the recommended experiment

Two runs on the **identical** refreshed corpus, differing in exactly one
variable:

```bash
# Arm 1 — primary line, matches v1.0.0's architecture
ml/training/.venv/bin/python ml/training/train_v1.py \
    --model yolov8n.pt --version v1.1.0

# Arm 2 — controlled YOLOv5 comparison, one flag different
ml/training/.venv/bin/python ml/training/train_v1.py \
    --model yolov5n.yaml --version v1.1.0-yolov5n
```

`train_v1.py` already accepts `--model` and `--version` and already freezes a
full §9.10 registry entry per run, so **no training-script changes are needed
to run this experiment** — another point in B1's favour.

Then compare both against `docs/eval/baseline-v1.0.0.json` under the Phase 7
promotion gate. Promote at most one. Keep v1.0.0 immutable either way.

## 7. What this decision does NOT authorize

- No training run (Phase 6 proper).
- No change to `train_v1.py`'s current `--model yolov8n.pt` default. The
  default stays on the primary line; the v5 arm is opt-in via the existing flag.
- No change to `services/cv-worker` — deliberately, per §3.3.
- No promotion of any model to active. That is Phase 7's gate, and requires
  passing metrics, not merely existing.
