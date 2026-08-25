---
title: "Sketch2UI — Final QA Report"
status_date: "2026-08-26"
companion: "docs/qa/MASTER_DEFECT_REGISTER.md — full per-defect detail, evidence, and reproduction steps"
---

# Final QA Report

## Scope of this pass

A full-application audit across the 35 areas requested (dashboard through CV worker
integration), using three parallel deep-dive investigations (CV detection pipeline
forensics against the actual model/worker/API code; frontend effective-state and
upload/dashboard flow; accessibility/security/performance) plus direct, hands-on
verification against the live running application (web + api + the real cv-worker,
not mocked). Every defect below was reproduced or directly evidenced — none are
speculative, and several exist specifically *because* a design doc's claim didn't
match what the code actually does.

This was **not** a rebuild and did not touch: the YOLO model, inference, confidence
math, detection coordinates, the UI-IR, PostgreSQL schema, API contracts, or
repository architecture, per the stated constraints.

## Totals

| | Count |
|---|---:|
| **Total defects logged** | **14** |
| P0 | 1 |
| P1 | 2 |
| P2 | 7 |
| P3 | 4 |
| **Fixed this pass** | **5** |
| Deferred (real, documented rationale) | 8 |
| Inconclusive (flagged, not confirmed) | 1 |

**All audited P0 and P1 issues are fixed** (1/1 P0, 2/2 P1) — this claim is scoped
exactly to what this pass actually audited; see "What this does NOT claim" below.

## Fixed

1. **DEF-001 (P0, SECURITY)** — Stored-XSS bypass in the content-override `href`
   allowlist: a whitespace/control-character embedded in a `javascript:` scheme
   (`"java\nscript:alert(1)"`) slipped past the scheme-detection regex and was stored
   verbatim, later normalized back to an executable `javascript:` URI by the browser
   on click. Fixed by rejecting any href containing such a character before the
   scheme check runs.
2. **DEF-002 (P1, STATE/API)** — Manually dragging the page boundary updated Canvas
   and the Layers tree live, but never touched the persisted `Detection.status`
   column — so Preview, the Code panel, and export could silently keep showing the
   *old* boundary's accept/reject decisions indefinitely, even after clicking "Save
   Version." Fixed by re-deriving every model detection's status against the new
   boundary at save time, using the same shared logic the detect job already applies
   in the mirror-image case.
3. **DEF-003 (P1, ACCESSIBILITY)** — The app's most-used muted-text color
   (`text-muted`, tree labels/section captions/status text, routinely 11px) measured
   3.33:1 / 2.92:1 contrast against its two real backgrounds — both fail WCAG AA's
   4.5:1, directly contradicting the design doc's claim of "verified ≥4.5:1." Fixed
   by darkening the token (same hue) to a value that clears 4.5:1 against both
   backgrounds with real margin.
4. **DEF-004 (P2, API/UX)** — An oversized or wrong-MIME-type upload returned a
   generic `500 "An unexpected server error occurred"` instead of a proper `413`/`400`
   with a specific message, because multer's own error path bypasses the route
   handler entirely. Fixed with a small dedicated error-normalizing middleware.
5. **DEF-005 (P3, ACCESSIBILITY)** — The tablet-width Layers/Inspector drawer claimed
   `aria-modal="true"` without an actual focus trap (Tab could escape into the page
   behind it) and had no visible close button. Fixed by mirroring the app's own
   `Dialog.tsx`'s already-correct focus-trap implementation and adding a close
   control; live-verified the full open→Tab-trap→close→focus-returns-to-trigger
   round trip.

## Deferred (real, not fixed — see the register for full rationale per item)

Per the deadline rule against starting new major architecture, these require
meaningful new engineering (a new dependency, a rewritten interaction model, a
batched-query rewrite) rather than a small, contained fix:

- **DEF-006 (P2)** No detection deduplication beyond YOLO's own built-in NMS —
  overlapping/different-class boxes on the same region can both persist.
- **DEF-007 (P3)** No audit trail for confidence-threshold-dropped detections; a
  dead per-request confidence override parameter.
- **DEF-008 (P2)** `/uploads` static file route checks authentication but not
  per-asset ownership (low-likelihood given UUID storage keys, but real).
- **DEF-009 (P2)** No rate limiting on login/register.
- **DEF-010 (P2)** Layers tree has no arrow-key navigation between sibling rows
  (contradicts the accessibility doc's claim that this exists) — the most
  concretely scoped item in this list, recommended first for a follow-up pass.
- **DEF-011 (P2)** Canvas detection resize handles are keyboard-inaccessible.
- **DEF-012 (P2)** N+1 query/image-decode pattern in the export route — will scale
  poorly on projects with many pages/images.
- **DEF-013 (P3)** No route-level code-splitting (mitigated by Monaco already being
  CDN-offloaded).

## Inconclusive

- **DEF-014 (P3)** — Observed, during this session's own extensive interactive
  testing, that a test project's original page (and its 3 saved code versions) was
  at some point replaced by a new page of the same name with no code versions. The
  two most plausible code-level causes (a page-delete cascade bug; a stale-closure
  bug in the delete-confirm flow) were each investigated and **ruled out** by direct
  code inspection — neither explains it. Most likely a testing-methodology artifact
  (rapid synthetic UI actions), not a product defect, but this could not be
  deliberately reproduced, so it is logged as genuinely open rather than resolved
  either way.

## Tests

- **Added:** 3 new HTTP-integration test files, 19 new test cases total
  (`content-overrides.routes.test.ts` ×16, `boundaries.routes.test.ts` ×1,
  `assets.routes.test.ts` ×2). Every new test was confirmed to **fail** when its
  corresponding fix was reverted (via `git stash`) and pass with the fix restored —
  not just written to pass against the current code.
- **Full suite, run fresh after all fixes:**

| Command | Result |
|---|---|
| `npm run typecheck` | clean (web, api, scripts) |
| `npm run test` | 124 (shared-types) + 260 passed / 16 skipped (apps/api — up from 241 before this pass; Prisma contract arms skip cleanly, no reachable test DB) |
| `npm run test:py` | 19 passed |
| `npm run build` | success, all 4 workspaces |
| `npm run test:e2e` | 4/4 passed (golden path, both inspector-overrides specs, multi-page) |

No existing test was modified or weakened to make it pass.

## Known limitations of this audit

- The 35-area checklist was covered by depth-of-investigation proportional to risk,
  not by exhaustively re-testing every already-covered happy path — items with prior
  automated coverage (e.g. the core upload→detect→correct→generate→preview→export
  pipeline) were spot-checked against the specific state-consistency question this
  audit was probing (effective state), not re-verified line-by-line.
- DEF-014 is explicitly unresolved — treat it as "watch for recurrence," not "ruled
  out."
- No live PostgreSQL instance was available in this environment; database-sync
  claims rely on the existing JSON/Prisma repository contract-test suite (already
  passing, unchanged by this pass), not a fresh live-Postgres run.
- Performance findings (DEF-012, DEF-013) are based on code-path analysis, not
  load-testing with real traffic/data volumes — the *direction* (this will scale
  worse as data grows) is confirmed; the *magnitude* was not measured.

## Remaining risks

- **DEF-008/DEF-009** (uploads ownership gap, no rate limiting) are the two
  highest-value security follow-ups — both are well-understood, standard fixes,
  just deliberately out of scope for "smallest fix, not new architecture" here.
- **DEF-002's fix pattern should be reviewed for other "client re-derives, server
  never does" cases** — this exact class of bug (client-side live state diverging
  from server-persisted state with no reconciliation path short of a heavy
  operation) is worth a deliberate audit pass of its own if time allows, since this
  investigation only went looking for it around the page-boundary flow specifically.
- **DEF-006 (no dedup beyond YOLO's NMS)** is a plausible *contributor* to
  "overlapping/messy detections" user complaints from earlier phases — worth
  connecting explicitly to any future work in that area rather than treating as
  unrelated.

## What this report does NOT claim

**This does not claim "all bugs are fixed."** It claims: all P0 and P1 issues
*found during this specific audit* are fixed and regression-tested. Eight real,
verified P2/P3 issues remain, deliberately deferred with stated rationale, and one
finding (DEF-014) is genuinely unresolved. Areas outside this audit's 35-point
checklist, and any defect class this audit's specific investigations didn't happen
to probe, may still contain issues not represented here.
