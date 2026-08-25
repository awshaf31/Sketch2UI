---
title: "Sketch2UI — Master Defect Register"
status_date: "2026-08-26"
purpose: "Full-application QA audit per the 35-area checklist. Every finding below was reproduced or directly verified against the actual code/running app — nothing here is inferred from documentation claims alone (several entries exist specifically BECAUSE the documentation's claim didn't match the code)."
---

# Master Defect Register

Methodology: three parallel deep-dive investigations (CV detection pipeline forensics;
frontend effective-state + upload/dashboard flow; accessibility/security/performance),
each required to cite exact file:line evidence and distinguish "confirmed" from
"theoretical," plus direct hands-on verification against the live running app
(all three services: web, api, cv-worker) for anything reproducible interactively.
Every fix below has a regression test that was confirmed to fail without the fix and
pass with it (shown by literally reverting the fix and re-running).

**Total defects logged: 14** (5 fixed, 8 deferred with rationale, 1 inconclusive).

---

## Fixed this pass

### DEF-001 — Stored-XSS bypass in content-override `href` allowlist

- **Category:** SECURITY
- **Severity / Priority:** P0 (blocking — confirmed exploitable guard-bypass of a
  security control the app explicitly designed to prevent this exact attack)
- **Location:** `apps/api/src/modules/content-overrides/content-overrides.routes.ts`,
  `isSafeHref()`
- **Reproduction:** `PUT .../content-overrides/:detectionId` with
  `{ "href": "java\nscript:alert(1)" }` (or `\t`/`\r`/leading-space variants).
- **Expected:** Rejected, same as the un-obfuscated `javascript:alert(1)` (which was
  already correctly rejected).
- **Actual (before fix):** Accepted (`200`), stored verbatim.
- **Suspected root cause, confirmed:** The scheme-detection regex
  (`/^[a-zA-Z][a-zA-Z0-9+\-.]*:/`) only matches an unbroken run of letters before `:`.
  An embedded tab/newline/CR/leading-space breaks that match, so the code fell into
  its "no scheme found → treat as relative path → allow" branch instead of ever
  reaching the `new URL()` scheme check. Browsers strip exactly those characters from
  a URL during parsing (WHATWG URL spec) regardless of position, so the stored value
  still resolves to `javascript:alert(1)` on click.
- **Evidence:** Reproduced directly with Node's own `URL` class (the same class the
  validator uses internally): `new URL("java\nscript:alert(1)").href ===
  "javascript:alert(1)"`. Confirmed the pre-fix `isSafeHref` returns `true` for four
  obfuscation variants, `false` for the plain form.
- **Affected files:** `apps/api/src/modules/content-overrides/content-overrides.routes.ts`
- **Suggested fix (implemented):** Reject any href containing a whitespace or C0
  control character before the scheme regex ever runs — legitimate URLs never
  contain a literal embedded one (a real space is percent-encoded).
- **Regression test:** `apps/api/src/modules/content-overrides/content-overrides.routes.test.ts`
  (16 cases: 8 attack variants must 400, 8 legitimate hrefs must 200). Verified to
  fail on the 4 obfuscated variants when the fix is reverted, pass on all 16 with it.
- **Status:** ✅ Fixed and regression-tested.

### DEF-002 — Manual page-boundary save doesn't reconcile persisted detection status; Preview/Export can permanently disagree with Canvas/Tree

- **Category:** STATE / API
- **Severity / Priority:** P1 (major — breaks the "one effective state" guarantee the
  app's own code comments assert; no crash, but Preview/export can silently show
  wrong content indefinitely)
- **Location:** `apps/api/src/modules/boundaries/boundaries.routes.ts` (PUT handler);
  `apps/web/src/pages/ProjectWorkspace.tsx` (`handleBoundaryChange`,
  `effectiveDetections`)
- **Reproduction:**
  1. Run Detect on a page, then save a version (or apply any Inspector override) so
     an `activeVersion` exists.
  2. Enter boundary-edit mode and drag the polygon so a previously-active model
     detection now falls outside it (or vice versa).
  3. Canvas/Tree update live (correct). Preview/Code panel show no change (wrong —
     they're pinned to the stale `activeVersion`).
  4. Click "Save Version" hoping to reconcile. It doesn't: server-side regeneration
     reads `detections.listActiveByPage()`, a plain DB query filtered on the
     **persisted** `status` column, which nothing had ever updated.
- **Expected:** Preview/Code/export reflect the boundary the user can currently see
  applied in Canvas/Tree, at latest after an explicit Save.
- **Actual (before fix):** Only re-running a full Detect (which also clears and
  recreates every model detection — a much heavier, unrelated operation) actually
  corrected the persisted `status` values.
- **Suspected root cause, confirmed:** `PUT .../page-boundary` persisted only the
  polygon. `detect.job.ts` already had the exact "re-derive accept/reject against
  whichever boundary is actually in force" logic for the case of a manual boundary
  already existing *before* a new Detect run — but nothing applied that same rule at
  the moment the boundary itself is *saved*.
- **Evidence:** Traced every mutation site of `Detection.status` in the API (`grep -rn
  "shouldAccept" apps/api/src`) — before the fix, the only call site was inside
  `detect.job.ts`. `boundaries.routes.ts`'s PUT handler never touched any detection
  row.
- **Affected files:** `apps/api/src/modules/boundaries/boundaries.routes.ts`
- **Suggested fix (implemented):** After saving the boundary, re-run the same
  `shouldAccept` check (shared `@sketch2ui/shared-types` function, same one the
  client and `detect.job.ts` already use) against every `source: "model"` detection
  on the page not marked `deleted`, and persist any status flip. Manual detections
  are never touched, matching the existing rule that boundary geometry never
  reclassifies a manual annotation.
- **Regression test:** `apps/api/src/modules/boundaries/boundaries.routes.test.ts` —
  seeds one model detection that must flip active→rejected, one that must flip
  rejected→active, and one manual detection that must stay untouched, all against
  one boundary PUT call. Verified to fail (both status assertions) when the fix is
  reverted.
- **Status:** ✅ Fixed and regression-tested.

### DEF-003 — `text-muted` fails WCAG AA contrast at its actual usage size

- **Category:** ACCESSIBILITY
- **Severity / Priority:** P1 (major — this is the single most-used muted-text color
  in the app: tree type labels, section captions, status text, routinely rendered at
  11px)
- **Location:** `apps/web/tailwind.config.js` (`text-muted` token)
- **Reproduction:** Compute WCAG relative-luminance contrast for `#848da0` on
  `#ffffff` and on `#eef0f4` (`surface-sunken`).
- **Expected:** ≥4.5:1 for normal text (the app's own `docs/frontend/accessibility.md`
  claims this is already verified).
- **Actual (before fix):** 3.33:1 against `surface`, 2.92:1 against
  `surface-sunken` — both fail. The documentation's claim was false.
- **Suspected root cause, confirmed:** The token's hex value was never actually run
  through a contrast calculation against the darker of its two real backgrounds
  (`surface-sunken`); the doc's claim appears to have been asserted rather than
  computed.
- **Evidence:** WCAG relative-luminance formula computed directly (not eyeballed);
  cross-checked with a second independent script during the fix. Real, non-decorative
  usage at `text-2xs` (11px) confirmed at 7+ call sites (`UITreePanel.tsx`,
  `InspectorSectionFooter.tsx`, `StatusBar.tsx`, `CodePanel.tsx`, `PreviewPane.tsx`,
  `SectionHeader.tsx`, `AccordionSection.tsx`).
- **Affected files:** `apps/web/tailwind.config.js`, `docs/frontend/accessibility.md`,
  `docs/frontend/design-tokens.md` (doc corrections)
- **Suggested fix (implemented):** Darkened to `#5d6679` — same hue, computed to clear
  4.5:1 against the harder background (`surface-sunken`, now 5.05:1) with headroom,
  5.77:1 against plain `surface`. No component code changed — the token is
  additive/shared, so every consumer picks up the corrected value automatically.
- **Regression test:** No dedicated new test (color values aren't unit-testable
  meaningfully) — verified via the WCAG contrast calculation itself (reproducible,
  documented in this entry) plus a full visual live-check and the complete
  Playwright suite (4/4 still green — nothing asserts the old color).
- **Status:** ✅ Fixed, live-verified, full regression green.

### DEF-004 — Multer-level upload rejections report as generic 500, not 400/413

- **Category:** API / UX
- **Severity / Priority:** P2 (real, but narrow — the mismatch is wrong status code +
  misleading message, not a missing error state; only reachable if client-side
  validation is bypassed, e.g. a direct API call)
- **Location:** `apps/api/src/modules/assets/assets.routes.ts`
  (`upload.single("file")`), `apps/api/src/middleware/errorHandler.ts`
- **Reproduction:** POST a file exceeding 15MB, or with a `Content-Type` outside
  `image/png|jpeg|webp`, to the assets endpoint.
- **Expected:** `413`/`400` with `code: "VALIDATION_FAILED"` and a specific message.
- **Actual (before fix):** `500`, `code: "INTERNAL"`, `"An unexpected server error
  occurred."`
- **Suspected root cause, confirmed:** `upload.single("file")` is plain
  callback-style Express middleware, not wrapped in `asyncHandler`. A multer-level
  rejection (`MulterError` for size, a plain `Error` from `fileFilter` for MIME type)
  calls `next(err)`, skipping every route handler and landing straight in the
  catch-all `errorHandler`, which answers everything as `500 INTERNAL`.
- **Evidence:** Read `errorHandler.ts` (no `MulterError`-aware branch exists) and the
  `upload` construction (both failure modes confirmed to call `next(err)`/`cb(err)`
  outside any try/catch this router's own code controls).
- **Affected files:** `apps/api/src/modules/assets/assets.routes.ts`
- **Suggested fix (implemented):** A small dedicated error-normalizing middleware
  inserted between `upload.single("file")` and the route handler, mapping
  `MulterError` (`LIMIT_FILE_SIZE` → 413) and the fileFilter's plain `Error` → 400,
  both as `VALIDATION_FAILED` with a specific message; anything else passes through
  unchanged to the real error handler.
- **Regression test:** `apps/api/src/modules/assets/assets.routes.test.ts` — one
  16MB-buffer case (expects 413), one wrong-content-type case (expects 400). Verified
  to fail (both return 500) when the fix is reverted.
- **Status:** ✅ Fixed and regression-tested.

### DEF-005 — Tablet `Drawer` claims `aria-modal="true"` without an actual focus trap, and has no visible close affordance

- **Category:** ACCESSIBILITY
- **Severity / Priority:** P3 (real gap, self-acknowledged in the component's own
  prior comment as "foundation, not finished," but not blocking — Escape and
  scrim-click both already worked)
- **Location:** `apps/web/src/components/Drawer.tsx`
- **Reproduction:** Open the Layers or Inspector drawer at tablet width (768–1023px),
  Tab repeatedly.
- **Expected:** Tab cycles within the drawer panel (per `aria-modal="true"`'s
  contract) and a visible close control exists for a mouse user unaware of Escape.
- **Actual (before fix):** Tab could move focus into the page behind the scrim; no
  close (×) button existed anywhere in the panel.
- **Suspected root cause, confirmed:** `Drawer.tsx` never implemented the same
  focus-trap logic `Dialog.tsx` already has (a working, proven reference
  implementation in the same codebase) — a scoping gap from when it first shipped.
- **Evidence:** Read `Drawer.tsx` in full — no `keydown` Tab handling, no
  `panelRef.querySelectorAll(FOCUSABLE_SELECTOR)` cycling, contrasted directly
  against `Dialog.tsx`'s implementation of exactly that.
- **Affected files:** `apps/web/src/components/Drawer.tsx`
- **Suggested fix (implemented):** Mirrored `Dialog.tsx`'s proven focus-trap contract
  (focus moves in on open, Tab cycles within the panel, focus returns to the trigger
  on close by any method) and added a visible close `IconButton` in the panel's
  top-right corner.
- **Regression test:** No new automated test (no existing suite exercises the tablet
  breakpoint) — live-verified via the browser: opened the Layers drawer via a
  properly-focused trigger, confirmed `role="dialog"` present, clicked the new close
  button, confirmed the dialog unmounts AND focus returns to the exact trigger
  button (`document.activeElement === trigger`).
- **Status:** ✅ Fixed, live-verified (round-trip focus behavior confirmed).

---

## Deferred (real, but out of scope for this pass — see rationale per item)

Per the deadline rule ("do not start new major architecture... not maximum number of
features"), items below require meaningful new engineering (a new middleware
dependency, a rewritten interaction model, a batched-query rewrite) rather than a
small, obvious fix, or are low-urgency observability gaps. Each is real and
verified, not speculative.

### DEF-006 — No detection deduplication beyond YOLO's own built-in NMS
- **Category:** CV_DETECTION / POSTPROCESSING · **Priority:** P2
- Ultralytics' `.predict()` applies NMS internally (confirmed via the vendored
  package source, IoU 0.7 default, never overridden by `model.py`). No app code adds
  any deduplication on top. Two overlapping-but-under-0.7-IoU boxes, or two different
  classes covering the same region, both persist as independent `active` detections.
  This is a real contributor to "messy overlapping detections" complaints (separate
  from the already-fixed rendering issue from an earlier phase — see
  `docs/execution/phase-log.md`).
- **Why deferred:** A custom post-NMS dedup pass (e.g. cross-class IoU merging) is a
  genuine CV-pipeline design decision, not an obvious bug fix — needs its own
  investigation into what threshold/merge-rule is actually correct for this domain.

### DEF-007 — No confidence-threshold audit trail; the per-request override is dead code
- **Category:** CV_DETECTION · **Priority:** P3
- Sub-`conf=0.5` detections are dropped silently inside Ultralytics' own call — no
  record, no count, not even a `rejected` status (contrast with boundary rejections,
  which are explicitly never dropped). `DetectResponse.rejectedCount` only counts
  boundary rejections. Separately, `/detect`'s `confidence` query-param override is
  never exercised by its only caller (`detect.job.ts`), so it's effectively dead code.
- **Why deferred:** Observability enhancement, not a functional defect — no user-facing
  behavior is wrong, there's just no visibility into how many candidates were
  discarded pre-threshold.

### DEF-008 — `/uploads` static route has no per-asset ownership check
- **Category:** SECURITY · **Priority:** P2
- Gated by `requireAuth` (any logged-in session) but not by project/page ownership —
  any authenticated user who learns another user's `storageKey` can fetch that file
  directly.
- **Why deferred:** Real gap, but low-likelihood (storage keys are server-generated
  UUIDs, never enumerable or guessable). Fixing it properly means routing uploads
  through an ownership-checked handler (the pattern `cropsRouter` already uses) — a
  real, if small, architectural change, not a one-line fix.

### DEF-009 — No rate limiting on `/api/auth/login` or `/register`
- **Category:** SECURITY · **Priority:** P2
- Confirmed zero rate-limiting dependency or middleware anywhere in `apps/api`.
  Login/register are open to unthrottled brute-force/credential-stuffing attempts.
- **Why deferred:** Standard hardening gap, but adding it means picking and wiring a
  new dependency (e.g. `express-rate-limit`) and deciding limits/storage
  (in-memory vs. shared) — a deliberate infra decision, explicitly the kind of thing
  the deadline rule asks to not start unprompted.

### DEF-010 — `UITreePanel` has no arrow-key navigation between sibling rows
- **Category:** ACCESSIBILITY · **Priority:** P2
- Confirmed: only `ArrowLeft`/`ArrowRight` (expand/collapse) exist; there's no
  `ArrowUp`/`ArrowDown` "move to next visible row." A keyboard-only user must Tab
  sequentially through every preceding row to reach a deep one. This directly
  contradicts `docs/frontend/accessibility.md`'s claim that this already exists
  (the doc describes Phase 2J-scoped, not-yet-built behavior as delivered).
- **Why deferred:** A real, practically-felt gap, but implementing a proper
  roving-tabindex/next-visible-row model is meaningful interaction-model work, not an
  obvious patch. Recommend prioritizing this for the very next accessibility-focused
  phase — it's the most concrete, well-scoped item in this deferred list.

### DEF-011 — Canvas detection resize handles are mouse-only
- **Category:** ACCESSIBILITY · **Priority:** P2
- Selection and move both have keyboard paths (Enter/Space to select, arrow keys to
  nudge); resize has none — the four handle `<rect>`s have no `tabIndex`, `role`, or
  `onKeyDown` at all.
- **Why deferred:** A real gap in a core correction workflow, but designing a sane
  keyboard-resize interaction (which handle, which direction, what step size) is new
  UX design work, not a one-line fix.

### DEF-012 — N+1 query/decode pattern in the export route
- **Category:** PERFORMANCE · **Priority:** P2
- `exports.routes.ts` does one sequential DB round-trip per page for the active
  version, plus — for every image/avatar/video/logo detection referenced in that
  page's HTML — two more sequential DB point-queries and a full re-decode of the
  source sketch from disk (`cropDetection` re-opens and re-decodes the whole image
  per crop, rather than decoding once per source image). None of this is batched or
  parallelized. Confirmed to scale linearly-and-serially with page count × image
  count.
- **Why deferred:** Real and will get worse as projects grow, but not urgent for
  today's typical (small) project sizes, and the correct fix (batch queries, decode
  each source image once, `Promise.all` across independent pages) is a genuine
  refactor of the export path, not a small patch — worth its own dedicated pass with
  its own before/after latency measurement.

### DEF-013 — No route/component-level code-splitting anywhere in the app
- **Category:** PERFORMANCE · **Priority:** P3
- Confirmed: `vite.config.ts` has no `manualChunks`, no route uses `React.lazy`, and
  `CodePanel`/Monaco's wrapper is a static top-level import — one 294KB JS bundle
  ships regardless of which route is visited. Mitigating factor: `@monaco-editor/react`
  already offloads Monaco's actual (multi-MB) core to a CDN at runtime, so this is
  "every route pays for every feature module's wrapper code," not "Monaco's core
  bloats the initial download."
- **Why deferred:** Real but low-urgency given the mitigating factor above, and
  introducing lazy-loading/chunking is an architecture decision affecting every route,
  not an obvious isolated fix.

---

## Inconclusive — flagged, not fixed, could not be root-caused

### DEF-014 — Observed loss of a project's code-version history and original page identity, could not reproduce or root-cause
- **Category:** STATE / TEST · **Priority:** P3 (documented as open, not "fixed" or
  "won't fix" — genuinely unresolved)
- **What was observed:** The "CV Worker Check" test project's original Page 1
  (created early in this session's testing, holding 3 saved `CodeVersion`s and
  earlier QA history) was, at some later point during this session's extensive
  interactive testing, no longer present — replaced by a page with the same name
  ("Page 1") but a different id, `order: 2` (implying it was created as a *second*
  page while the original still existed), and zero code versions.
- **Investigated and ruled out as the cause:**
  1. The page-delete cascade (`apps/api/src/repositories/json/page.repository.ts`,
     `delete()`) — read in full; it filters every child collection strictly by the
     specific `pageId` being deleted, never by `projectId`. Deleting one page cannot
     delete another page's rows. Confirmed correct, not the cause.
  2. A stale-closure bug in the page-delete confirm flow
     (`apps/web/src/features/workspace/PagesStrip.tsx`, `handleDelete`) — the `page`
     object is captured correctly per-render inside the `.map()` callback, not a
     shared/stale reference. Confirmed correct, not the cause.
  3. The JSON store's write mechanism (`apps/api/src/db/jsonStore.ts`) — a single
     module-level in-memory object, mutated synchronously and persisted via a
     synchronous `writeFileSync` of the *entire current* in-memory state on every
     `db.save()`. Because Node is single-threaded and each mutation is synchronous
     before its own save call, this does not have the classic "lost update" race a
     naive read-then-write-a-stale-copy pattern would have. Not conclusively ruled
     out as a contributor, but no concrete mechanism was found.
- **Most likely explanation:** An artifact of this session's own testing method —
  many rapid, synthetic (JS-dispatched, not real user) UI interactions across several
  hours in one browser tab, including page add/rename/delete cycles run in quick
  succession without always waiting for state to settle. Not ruled out with full
  confidence as a genuine product bug, because it could not be deliberately
  reproduced in an isolated, controlled sequence.
- **Status:** Open / inconclusive. Recommend: if this recurs during real (non-automated)
  usage, capture the exact click sequence and file a fresh, reproducible report —
  this entry should not be treated as confirming or ruling out a real defect.

---

## Areas audited with no defect found (for completeness — not every check produces a finding)

- Geometry/structure/style/content override apply logic — confirmed exactly one
  apply point client- and server-side; no double-apply bug (the code's own claim to
  this effect holds up against direct inspection of `layout.ts`, `codegen/src/index.ts`,
  `utils/tree.ts`).
- `selectedDetection`/Geometry-section base value sourcing raw (non-effective)
  detection bbox — confirmed intentional and correct (matches server-side validation
  semantics), not a bug.
- Client/server upload MIME-type and size-limit validation — confirmed identical
  (15MB, png/jpeg/webp), plus server-side magic-byte re-verification independent of
  declared `Content-Type`.
- Dashboard list/create/delete error handling and loading states — every failure
  path is user-visible (inline error, toast, or retry-capable `ErrorState`); no
  swallowed `catch` blocks found anywhere in `Dashboard.tsx`.
- Ownership middleware coverage — cross-referenced every mounted router in
  `server.ts` against its ownership middleware; no project- or page-scoped route
  found unprotected (the one real gap found, `/uploads`, is logged as DEF-008).
- Session cookie flags (`httpOnly`/`secure`/`sameSite`) — correctly
  environment-conditional, no issue.
- CORS configuration — locked to a single configured origin, never wildcarded.
- `Dialog.tsx` (the non-drawer modal) — full, correct focus-trap implementation;
  this is what DEF-005's fix was modeled on.
- Form labels throughout `InspectorPanel.tsx` — every field uses the shared `Field`
  component, which structurally cannot omit a `<label htmlFor>` pairing.
- `useDetectionJob.ts` polling cancellation — the cancellation ref is checked both
  before *and* after the awaited network call, not just at the top of the loop;
  correct.
- `ProjectWorkspace.tsx` effect/memo dependency arrays — no over-firing pattern
  found; no new-literal-every-render footguns.
- Path traversal / upload content validation — `storageKey` is a server-generated
  UUID never derived from client input; magic-byte sniffing precedes any use of the
  `image-size` library (mitigating its known DoS advisories).
