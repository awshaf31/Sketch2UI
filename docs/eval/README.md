# Evaluation baselines

Plan references: §21 (evaluation framework), §20.6 (regression benchmark), §51 step 12.

`baseline-<modelVersion>.json` is the **regression benchmark**. A future model version is
compared against the current baseline rather than judged in isolation.

```bash
cd services/cv-worker && .venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1 &
npm run eval                                        # -> docs/eval/baseline-v1.0.0.json
npm run eval -- --out docs/eval/baseline-v1.1.0.json
```

The corpus is the 5 original hand-drawn sample sketches. It is small — treat every number
below as directional, not statistically meaningful.

## What is measured

| § | Metric | How |
|---|---|---|
| 21.2 | page boundary IoU | against **hand-verified** ground-truth polygons, read off each image against a decile grid (±0.01 normalized). Axis-aligned IoU, applied to both sides consistently. |
| 21.3 | layout structure | **hand-authored structural assertions** — not full expected trees, which are too laborious to keep honest. Each assertion states one property a human reading the sketch would expect. |
| 21.4 | code metrics | HTML tag balance, CSS brace balance, duplicate ids, and components with no codegen mapping (asserted zero, not assumed). |
| 21.7 | end-to-end | % of sketches reaching a **usable preview**, defined operationally below. |

### §21.7 "usable preview" — operational definition

All of:

1. detection succeeded with **≥1 accepted** detection;
2. boundary filtering completed without crashing;
3. layout produced a **non-degenerate** tree (≥1 top-level node);
4. generated HTML **and** CSS parse;
5. **no duplicate element ids** (a duplicate id makes the preview's DOM invalid).

## What is deliberately NOT measured

**§21.1 detection metrics** — precision/recall/mAP/per-class AP/confusion matrix are
produced at training time and already live in
`ml/models/ui-detector/v1.0.0/metrics.json`. Not duplicated here.

**§21.5 visual similarity (SSIM / image-diff)** — **out of scope, not attempted.** There
is no reference-design benchmark to compare against; the corpus is sketches, not
sketch↔target-render pairs. Building one would mean inventing "correct" target renders,
and scoring against invented targets is not a real evaluation. The plan itself flags
these as supplementary "because the target is a sketch rather than a pixel-perfect
design".

**§21.6 human evaluation** — **out of scope, not attempted.** Scoring structural
similarity, usefulness, editability, code readability and time saved requires actual
human evaluators. Simulating or approximating it would fabricate the one signal that
only people can give.

## v1.0.0 results

| Metric | Value |
|---|---|
| end-to-end usable preview | **5/5 (100%)** |
| boundary mean IoU | **0.870** |
| boundary found (4 of 5) | `6de3567a` returns no boundary → Strategy C manual fallback |
| layout assertions | **10/10** |
| HTML+CSS all parse | yes |
| duplicate ids | 0 |
| unmapped component types | 0 |

Per-image boundary IoU: `5d0083a7` 0.994 · `881ceb2a` 0.995 · `cf91f277` 0.993 ·
`642be96a` 0.776 · `6de3567a` 0.592 (no boundary found; scored against the full-image
fallback, which is the honest number — a miss, not an exemption).

### Reading these numbers honestly

100% end-to-end does **not** mean the output is good. It means the pipeline completes and
emits a valid page for every sketch. Per-class detection AP still ranges 0.36–0.995
(`ml/models/ui-detector/v1.0.0/README.md`), so a "usable preview" can still be missing
components or mislabelling them. This metric measures *does the machine finish*, not
*is a designer happy* — the latter is §21.6, which is out of scope.
