# Final demo fixture

Frozen per the deadline plan's §28: "Do not use a randomly uploaded image during the
final presentation. The demo should be reproducible."

## Contents

- `sketch.png` — the sketch to upload during the live demo. A car-marketplace wireframe
  ("CARSALE") chosen because it's the cleanest of the available sample sketches and
  hits every component type the plan's §27 demo checklist asks for in one page: header,
  logo, navbar, heading, text, image, button, cards, section, footer — plus a bonus
  email-subscribe input (form). Same file already used elsewhere in this repo as a real
  uploaded asset and as ML training data, so its behavior with the current detector is
  already proven, not a fresh unknown.
- `expected/detections.json` — what `ui-detector/v1.0.0` actually found when this exact
  file was run through the real pipeline (see below), trimmed to the stable fields
  (`className`, `bbox`, `confidence`, `status` — ids and timestamps are non-deterministic
  across runs and dropped). **This is a rehearsal reference, not a strict pass/fail
  fixture**: normalized bbox coordinates and confidence scores can drift by small
  amounts across model reloads, hardware, or a future model version, without being a
  regression. Use it to sanity-check *what kind of result to expect* (roughly 21
  detections: 1 button, 3 headings, 4 images, 6 sections, 7 text blocks), not to assert
  byte-exact equality in an automated test.
- `expected/index.html`, `expected/styles.css` — the generated code from that same run,
  for the same rehearsal-reference purpose.

## How this was captured

Real pipeline, real CV worker (not the E2E suite's mock), against an isolated
JSON-mode server so it never touched dev data: create project → upload `sketch.png` →
POST detect → generate code → export. See `docs/execution/phase-log.md`'s Phase 9
entry for the full session this was produced in.

## Why the detector doesn't find "logo", "navbar", "card", or "footer" here

`ui-detector/v1.0.0` is trained on 16 of the taxonomy's 41 classes (see
`docs/ml/model-decision.md` and `PROJECT_STATUS.md` §3.1) — it genuinely does not know
those four classes yet, so `expected/detections.json` correctly has none of them. This
is not a bug in the fixture. It is also a good live-demo moment: the §27 user journey's
step 5 ("Correct one detection") is exactly where a presenter can manually draw a
`logo` or `navbar` box the model missed, showing the human-in-the-loop correction loop
working as designed rather than papering over the model's honestly-documented limits.

## Running the demo with this fixture

```bash
npm run dev:api
npm run dev:web
# separately: cd services/cv-worker && .venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1
```

Then follow the plan's §27 user journey, uploading `sketch.png` from this directory at
step 1.
