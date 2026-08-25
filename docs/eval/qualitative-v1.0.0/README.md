# Qualitative predictions — ui-detector v1.0.0

Generated 2026-08-25 (deadline plan Phase D2), against the same 5-image corpus as
`docs/eval/baseline-v1.0.0.json`
(`sample_images_object_detataction_expectation/`). Not new evidence about accuracy —
`metrics.json`'s per-class AP is the quantitative source of truth — this is a visual
sanity check that the detector's failure modes described in
`ml/models/ui-detector/v1.0.0/README.md` are actually visible on real output, not just
numbers in a table.

## How these were produced

```bash
services/cv-worker/.venv/bin/python - <<'PY'
from ultralytics import YOLO
model = YOLO("ml/models/ui-detector/v1.0.0/weights.pt")
results = model.predict(source="sample_images_object_detataction_expectation/<image>.png", imgsz=640, conf=0.25)
results[0].save(filename="docs/eval/qualitative-v1.0.0/<image>.pred.jpg")
PY
```

Confidence threshold 0.25 (ultralytics' default) — deliberately not raised, so
low-confidence misses stay visible rather than being hidden by a stricter cutoff.

**Reading note:** the five source images already carry small reference annotations
baked into the pixels (from the original hand-verification pass used to build the
boundary/layout ground truth) — those are the thin, small-font labels like `logo`,
`nav_item`, `card`, `hero_image`. The large bold labels ultralytics draws on top
(e.g. `section 0.72`, `image 0.98`) are the actual v1.0.0 model predictions being
evaluated here. The two label sets use different class vocabularies (the reference
overlay uses the full 41-class taxonomy; the model only knows its trained 16), so
don't read them as ground-truth vs. prediction in the same class space — read the
bold overlay alone as "what v1.0.0 thinks is here."

## What's visible

- `5d0083a7…` (wildcard template): `section`/`image`/`text` fire at high confidence
  (0.92–0.99) on large structural regions — consistent with the "easy structural
  classes carry the mean" finding in the model README. The card-grid row is
  correctly boxed as five `section`s at 0.94, each containing an `icon`+`text` pair,
  which is encouraging for the layout engine's grid-detection heuristic. Some
  low-confidence noise (`heading 0.27`, `image 0.29`, `button 0.27`) sits underneath
  higher-confidence boxes for the same region — exactly the kind of overlapping
  low-confidence chatter a real deployment would filter with a higher `conf`
  threshold before it ever reaches layout.
- The other four images show the same pattern: strong, confident boxes on
  `section`/`navbar`/`footer`/`image`, and the weak classes (`select`, `radio_button`,
  `carousel`) either missing, low-confidence, or mislabeled as a visually similar
  rectangle class — matching `README.md`'s confusion-matrix analysis rather than
  contradicting it.

## What this does NOT show

This is 5 images, the same 5 already used for the qualitative/boundary/layout
evaluation — not new statistical evidence, and not a substitute for the 17-image
test-split confusion matrix in `ml/models/ui-detector/v1.0.0/metrics.json`. Its only
purpose is letting a human look at real predicted boxes rather than only a metrics
table before deciding whether the numbers match visible reality. They do.
