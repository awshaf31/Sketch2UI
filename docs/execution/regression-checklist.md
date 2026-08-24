---
title: "Sketch2UI — End-of-Phase Regression Checklist"
purpose: "Manual smoke path re-run after every phase so a code change cannot silently break the core sketch → detect → correct → generate → preview → export pipeline."
---

# Regression Checklist

Run this checklist after every phase, before writing the phase report in
[phase-log.md](phase-log.md). If any step fails, do not mark the phase complete —
open a fix in the same phase.

## Prerequisites (do these once per session)

- [ ] `npm install` succeeds
- [ ] `services/cv-worker/.venv/` exists and its Python is 3.9.x
- [ ] Three terminals ready: API (`npm run dev:api` → :4000), web
      (`npm run dev:web` → :5173), cv-worker (`cd services/cv-worker &&
      .venv/bin/uvicorn main:app --port 8000 --host 127.0.0.1` → :8000)
- [ ] `curl http://localhost:8000/health` returns
      `{"status":"ok","modelVersionId":"v1.0.0","modelLoaded":true,"classes":16}`

## Automated (must be green)

- [ ] `npm run test` — 38 passed / 0 failed (baseline)
- [ ] `npm run test:py` — 19 passed / 0 failed (baseline)
- [ ] `npm run build` — succeeds through all four workspaces

## Core pipeline (15 steps, manual, per plan §51)

Use a sketch from `sample_images_object_detataction_expectation/` or one already
in `data/uploads/`.

1. [ ] **Project create** — dashboard "New project" creates a row, opens the
       workspace.
2. [ ] **Image upload** — drag-drop a PNG/JPEG; asset appears; UUID filename
       lands in `data/uploads/`.
3. [ ] **Manual box creation** — pick a class in the ClassPicker, drag a box in
       the AnnotationCanvas; the box appears in the tree with the chosen class.
4. [ ] **Page boundary** — auto-detected (dashed outline). Manually drag a
       corner; boxes outside the boundary become greyed/filtered live.
5. [ ] **Auto detection** — click **Detect** (Beta). Dashed purple model boxes
       appear; a job row transitions `processing` → `completed`.
6. [ ] **Manual correction of a model detection** — resize a model box or change
       its class. The overlay changes color/style (source flips to `manual`).
       Re-run Detect — the correction survives.
7. [ ] **UI tree** — UITreePanel shows a nested tree that reflects container /
       atomic relationships (per `taxonomy.ts`).
8. [ ] **HTML generation** — CodePanel HTML tab shows generated markup with
       semantic tags, escaped content, `data-node-id` attributes.
9. [ ] **CSS generation** — CodePanel CSS tab shows layout blocks
       (flex/grid/stack) followed by any override rules.
10. [ ] **Live preview** — PreviewPane iframe renders the generated page.
        Desktop/tablet/mobile toggles change viewport.
11. [ ] **Code edit** — toggle Monaco to editable, change a heading string,
        press **Save edit**. A new `CodeVersion` with `source: "edited"`
        appears in the version list. Validator rejects unbalanced tags/braces.
12. [ ] **Version activation** — activate an older version. Preview and any
        subsequent export use that version. Reactivate current.
13. [ ] **Export ZIP** — click Export. A ZIP downloads (also lands under
        `data/exports/`). Extract: `index.html`, `styles.css`, `assets/`,
        `source-sketch.*`, `README.txt` present. Open `index.html` directly in a
        browser — no server needed, layout matches preview.
14. [ ] **Style inspector** — select a node. Change `padding` to `24px`, press
        **Apply**. New `CodeVersion` (`source: "generated"`) appears; preview
        reflects change; export ZIP contains the padding rule.
15. [ ] **Content inspector** — select a text/heading node. Change the string to
        "Hello". Attempt to submit `<script>` — API returns 400 "text must not
        contain `<` or `>`". Save valid text; preview + export reflect it.
        Reset — placeholder returns.

## Preservation checks (must NOT regress in later phases)

- [ ] Editing a **model** detection flips `source` to `manual`, and a
      subsequent re-detect does **not** silently overwrite it (§26 of the
      execution plan).
- [ ] Every code version is immutable: activating an old version does not
      mutate any row (Phase 1+ must not turn versions into editable rows).
- [ ] Preview `iframe` has no `allow-scripts` sandbox flag added; content
      overrides still reject `<`/`>` in text and `javascript:` in `href`.
- [ ] Boundary parity fixture (`packages/shared-types/fixtures/
      boundary-overlap-parity.json`) still passes on both TS and Python sides.

## After Phase 1 (Geometry Inspector) also verify

- [ ] Selecting a node shows a **Geometry** section with x/y/width/height fields.
- [ ] Applying valid normalized values persists, regenerates, and the box moves
      on the overlay AND in the export.
- [ ] Reset removes the override; the box returns to the raw detection position.
- [ ] The override survives a re-detection that changes UI-IR node ids (the
      override is keyed on detection UUID, not node id).

## Recording the result

In [phase-log.md](phase-log.md), under the phase entry's "Manual verification"
section, record each step as `pass` / `fail` / `n/a` and cite any failing step
by number.
