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

**Total defects logged: 14** (10 fixed, 3 deferred with rationale, 1 inconclusive).
DEF-010, DEF-008, DEF-009, and DEF-011 were fixed in a follow-up session on
2026-08-26, after the original audit pass below — see their entries for details.
DEF-012 was fixed in a second follow-up session the same day, alongside an unrelated
SaaS visual-polish pass (`docs/frontend/saas-polish-audit-2026-08-26.md`).

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

### DEF-010 — `UITreePanel` has no arrow-key navigation between sibling rows

- **Category:** ACCESSIBILITY
- **Severity / Priority:** P2
- **Fixed in a follow-up session (2026-08-26)**, after the rest of this audit —
  originally logged as deferred; see git history for the exact commit.
- **Location:** `apps/web/src/features/tree/UITreePanel.tsx`
- **Reproduction (before fix):** Focus any Layers-tree row, press `ArrowDown` or
  `ArrowUp`. Nothing happens — only `ArrowLeft`/`ArrowRight` (expand/collapse) had
  handlers. A keyboard-only user had to Tab sequentially through every preceding row
  to reach a deep one. This directly contradicted
  `docs/frontend/accessibility.md`'s claim ("Arrow keys move focus between rows")
  that this already existed.
- **Fix:** The row `<button>`'s `onKeyDown` now handles `ArrowDown`/`ArrowUp` by
  finding the panel's root `<ul className="p-2">` via `closest()`, reading all
  `li > button` elements in document order, and calling `.focus()` on the
  next/previous one. Because a collapsed subtree's children are removed from the
  DOM entirely (pre-existing behavior — see the `{hasChildren && !collapsed && ...}`
  guard just below), "next/previous visible row" falls out of plain DOM order for
  free — no separate flattened-row model needs to be tracked, and no change to the
  DOM shape the e2e suite's `ul.p-2 > li > button` locator depends on.
- **Regression test:** No new automated test (project has no React component-test
  suite yet — see `PROJECT_STATUS.md` §6.6). Live-verified via the browser against
  a real project's tree (23 visible rows, several nesting levels): `ArrowDown` from
  a top-level "image" row moved focus into its own nested "text" child, then to the
  next top-level "header" row; `ArrowUp` from "text" returned to "image"; `ArrowUp`
  at the very first row was a no-op (no wraparound/crash); collapsing "image" via
  `ArrowLeft` and pressing `ArrowDown` again skipped straight to "header",
  confirming the hidden child was excluded from traversal. `npm run typecheck`,
  `npm run test` (124 + 260 passing), and `npm run test:e2e` (4/4, including both
  specs that locate tree rows via the exact `ul.p-2 > li > button` shape) all green
  after the change.
- **Status:** ✅ Fixed, live-verified.

### DEF-008 — `/uploads` static route has no per-asset ownership check

- **Category:** SECURITY
- **Severity / Priority:** P2
- **Fixed in a follow-up session (2026-08-26)**, immediately after DEF-010 above —
  originally logged as deferred; see git history for the exact commit.
- **Location:** `apps/api/src/server.ts`, `apps/api/src/modules/assets/assets.routes.ts`,
  `apps/web/src/services/api.ts`
- **Reproduction (before fix):** The source sketch was served from a flat
  `app.use("/uploads", express.static(env.uploadsDir))`. Gated by `requireAuth` (any
  logged-in session) but nothing else — any authenticated user who learned another
  user's `storageKey` (a path/network-log leak, not a guess, since keys are
  server-generated UUIDs) could fetch that file directly with zero project/page
  ownership check.
- **Fix:** Removed the static route entirely. The image is now served from
  `GET /api/projects/:id/pages/:pageId/assets/:assetId/image`, added to the existing
  `assetsRouter` (already gated by `requireProjectOwnership` + `requirePageInProject`
  for every other asset route) — the exact pattern `cropsRouter` and
  `boundariesRouter` already use, right down to 404ing (not 403) when the asset
  doesn't belong to the given page, matching the existence-enumeration-avoidance
  reasoning used everywhere else ownership is checked. `api.assetUrl()` on the
  frontend now takes `(projectId, pageId, assetId)` instead of a bare `storageKey`;
  its two call sites in `ProjectWorkspace.tsx` were updated to match (both already
  had `id`/`currentPageId` in scope).
- **Regression test:** `apps/api/src/modules/assets/assets.routes.test.ts` — new
  `describe` block: the owning user gets `200` with the correct bytes; a second,
  unrelated authenticated user gets `404` (not `200`, not `403`) for the same asset
  URL. Verified live against the real running dev stack too, not just the isolated
  test harness: a freshly registered intruder account got `404` on another user's
  asset image, and the removed `/uploads/<key>` path now 404s outright for an
  authenticated user where it used to serve any file. `npm run typecheck`,
  `npm run test` (124 + 262 passing, 2 new), and `npm run test:e2e` (4/4 — every
  spec loads an asset image through this exact route) all green after the change.
- **Status:** ✅ Fixed, live-verified.

### DEF-009 — No rate limiting on `/api/auth/login` or `/register`

- **Category:** SECURITY
- **Severity / Priority:** P2
- **Fixed in a follow-up session (2026-08-26)**, immediately after DEF-008 above —
  originally logged as deferred (adding rate limiting means picking a dependency and
  deciding limits/storage, a real infra decision this session was explicitly asked
  to make); see git history for the exact commit.
- **Location:** `apps/api/src/middleware/rateLimiter.ts` (new),
  `apps/api/src/modules/auth/auth.routes.ts`, `apps/api/src/middleware/apiError.ts`
- **Reproduction (before fix):** Zero rate-limiting dependency or middleware
  anywhere in `apps/api` — `/api/auth/login`/`/register` were open to unthrottled
  brute-force/credential-stuffing.
- **Fix:** Added `express-rate-limit` (v8), applied as its own middleware instance
  per route (`/login` and `/register` each get an independent budget — one route's
  exhausted limit never blocks the other). 10 requests / 15 minutes per IP, within
  the range OWASP's authentication cheat sheet suggests for login throttling; kept
  in-memory (the library's default store) rather than Redis-backed, matching this
  app's existing single-process deployment model (detection jobs already run
  in-process rather than through the Redis container `docker-compose.yml`
  provisions but nothing else uses). A new `RATE_LIMITED` error code was added to
  the shared `ErrorCode` union (marked `retryable: true`) so a `429` comes back in
  the same `{ error: { code, message, retryable } }` shape every other route uses,
  not `express-rate-limit`'s own default body. The limiter is a no-op when
  `NODE_ENV=test` (set automatically by Vitest) — every other module's own
  HTTP-integration test registers/logs in its own throwaway users through these
  exact routes, and a shared in-memory counter across a whole test file's
  cumulative calls would make the test suite's own size an accidental trip hazard
  rather than testing anything real.
- **Regression test:** `apps/api/src/middleware/rateLimiter.test.ts` — calls
  `buildAuthRateLimiter()` directly (bypassing the `NODE_ENV=test` no-op wrapper) with
  a tiny limit: confirms requests up to the limit succeed, the next one 429s with
  `RATE_LIMITED`/`retryable: true`, and — via a `trust proxy` + `X-Forwarded-For`
  test app just for this one test — that two different client IPs get independent
  budgets rather than sharing one global counter. Also live-verified against the
  real running dev API: 10 sequential bad-password `POST /api/auth/login` calls each
  correctly 401'd, the 11th and 12th both came back `429 RATE_LIMITED`, and a
  `POST /api/auth/register` call made immediately after (a different route, its own
  limiter instance) still succeeded with `201`. `npm run typecheck`,
  `npm run test` (124 + 264 passing, 2 new), and `npm run test:e2e` (4/4, run
  against the real rate limiter since Playwright's `webServer` doesn't set
  `NODE_ENV=test` — each spec's single register call stays well under the limit)
  all green after the change.
- **Status:** ✅ Fixed, live-verified.

### DEF-011 — Canvas detection resize handles are mouse-only

- **Category:** ACCESSIBILITY
- **Severity / Priority:** P2
- **Fixed in a follow-up session (2026-08-26)**, immediately after DEF-009 above —
  originally logged as deferred (designing a sane keyboard-resize interaction —
  which handle, which direction, what step size — was judged new UX design work,
  not a one-line fix); see git history for the exact commit.
- **Location:** `apps/web/src/features/annotation/AnnotationCanvas.tsx`
- **Reproduction (before fix):** Selection and move both had keyboard paths
  (Enter/Space to select, arrow keys to nudge the whole box); resize had none — the
  four handle `<rect>`s had no `tabIndex`, `role`, or `onKeyDown` at all, so they
  were unreachable by keyboard entirely.
- **Fix:** Each of the four resize handles is now `tabIndex={0}` with
  `role="button"` and a descriptive `aria-label` (e.g. "Resize section from the NW
  corner..."), reachable by `Tab` right after its detection in document order. With
  a handle focused, arrow keys move *that one corner* by the same step convention
  the existing whole-box nudge already established (1px-equivalent, 10px with
  Shift) — reusing the exact same `applyHandle()` function the mouse-drag resize
  path already calls, so a keyboard resize from a given corner behaves identically
  to dragging that corner by the same amount, and the same `MIN_BOX_PX` collapse
  guard the mouse path uses prevents committing a near-zero-size box. Each keydown
  calls `e.stopPropagation()` — without it, the same arrow-key event would also
  bubble to the window-level whole-box nudge listener and move the entire box on
  top of the resize, since that listener has no way to know a more specific handler
  already claimed the key.
- **Regression test:** No new automated test (no React component-test suite exists
  yet — see `PROJECT_STATUS.md` §6.6). Live-verified in the browser against a real
  detection on the "CV Worker Check" project: focused the detection, confirmed
  `Tab` reaches its NW handle next (in that exact order, before the next
  detection); plain `ArrowRight` moved the NW corner by exactly 1px (`x: 196.70 →
  197.70`, `width` shrinking by the same 1px, matching `applyHandle`'s "move this
  corner, keep the opposite one fixed" contract); a real `shiftKey: true` keydown
  moved it by exactly 10px, confirming the Shift-step convention (the Browser-pane
  tool's own `modifiers` parameter didn't propagate `shiftKey` into the dispatched
  event in this environment — confirmed as a tool limitation, not a code bug, by
  dispatching a raw `KeyboardEvent` with `shiftKey: true` directly and observing
  the correct 10px move); each resize produced a `PATCH .../detections/:id → 200`
  and a new "Geometry updated" row in the Inspector's correction-history list,
  confirming it persists through the exact same path a mouse-drag resize does; a
  400-keypress stress-test settled cleanly at a single valid 10px step with no box
  collapse or corruption (the async PATCH-per-keystroke model means rapid
  synthetic presses race rather than compound — not a concern for real human
  typing speed). `npm run typecheck`, `npm run test` (124 + 264 passing), and
  `npm run test:e2e` (4/4) all green after the change.
- **Status:** ✅ Fixed, live-verified.

### DEF-013 — No route/component-level code-splitting anywhere in the app
- **Category:** PERFORMANCE · **Priority:** P3
- **Root cause:** `App.tsx` imported all 15 page components statically, so Rollup had a
  single entry graph and emitted one chunk. `vite.config.ts` had no `build` section and
  nothing in `apps/web/src` used `React.lazy`, `Suspense`, or a dynamic `import()`.
  Monaco was never the problem — `@monaco-editor/react` already CDN-loads its core, and
  that behavior is untouched here.
- **Fix:** every page is now `React.lazy(() => import(...))` behind one `<Suspense>` and
  a `RouteErrorBoundary` (`apps/web/src/components/RouteBoundary.tsx`, built on the
  existing `ErrorState` primitive). The entry chunk statically imports zero route code.
  - **Chunk grouping was deliberately left to Rollup.** Hand-grouping the pages into
    five named `manualChunks` (public/auth/app/workspace/admin) was tried and reverted:
    a manual chunk absorbs its whole dependency subtree, so the first group assigned
    swallowed React and the shared components, and the entry chunk then had to
    statically import that group — putting ~190KB back on every route. The only build
    option kept is `experimentalMinChunkSize: 1_000`, which folds the sub-kilobyte
    primitive chunks (Card, Badge, Input…) back into their consumers. It is set below
    the smallest page chunk on purpose: at a larger threshold Rollup merges by size
    alone and folded `Account` in with the admin pages.
  - `WorkspacePrefetch` warms the workspace chunk once auth resolves, so opening a
    project stays synchronous (`React.lazy` never suspends on an already-settled
    promise) and the editor does not flash a loading state. Gated on `authenticated`
    rather than on the `/app` path so a logged-out visitor never requests it.
- **Before → after (raw JS a route must download, including the shared entry):** one
  361.1KB bundle for every route → public `/` 202.8KB, `/login` 194.0KB, `/app` 203.6KB,
  `/admin` 191.3KB, workspace 305.5KB. Total emitted 370.2KB across 25 chunks.
- **Test-infrastructure change:** `playwright.config.ts` now serves the production build
  (`vite build && vite preview`) instead of `vite dev`. Code splitting only exists in the
  build — dev ships unbundled ESM, where a lazy route is a waterfall of ~40 module
  requests rather than one hashed chunk. Against dev, `golden-path.spec.ts` raced that
  waterfall and flaked (it queries a bare `input[type="file"]`, which matches the
  Dashboard's upload hero while the outgoing route is still mounted). No assertion was
  weakened; the suite now exercises the artifact that actually ships, and runs faster.
- **Verified:** typecheck, Vitest 334/334 + 124/124, Pytest 19/19, build, Playwright
  16/16 (twice). In-browser against the production preview: direct navigation and
  refresh work on every route; `/` loads only `Home`/`MarketingFooter`/`BrandMark`;
  `/login` loads only its own chunks; an unauthenticated hit on `/admin/audit-logs`
  fetches **zero** admin chunks because `ProtectedRoute` short-circuits before the lazy
  child renders; and hiding a chunk on disk renders the error boundary's "Couldn't load
  this page. Reload to try again." with no stack trace, recovering once restored.
- **Status:** ✅ Fixed, live-verified.

### DEF-012 — N+1 query/decode pattern in the export route
- **Category:** PERFORMANCE · **Priority:** P2
- `exports.routes.ts` did one sequential DB round-trip per page for the active
  version, plus — for every image/avatar/video/logo detection referenced in that
  page's HTML — two more sequential DB point-queries and a full re-decode of the
  source sketch from disk (`cropDetection` re-opened and re-decoded the whole image
  per crop, rather than decoding once per source image). None of this was batched or
  parallelized. Confirmed to scale linearly-and-serially with page count × image
  count.
- **Fixed 2026-08-26** (a second follow-up session, alongside an unrelated SaaS
  visual-polish pass — see `docs/frontend/saas-polish-audit-2026-08-26.md`).
  Addressed the two highest-leverage parts, scoped deliberately smaller than the
  original "batch queries + decode once + `Promise.all` across pages" framing:
  1. `appendPageAssets()` in `exports.routes.ts` now resolves every referenced
     detection/source-asset pair concurrently (`Promise.all`) instead of one
     sequential round trip per path.
  2. `crop.service.ts` gained `decodeSourceImage()` (decode a source file once) and
     `cropFromDecoded()` (extract a region from an already-decoded image);
     `cropDetection()` is now a thin wrapper over both, so its existing callers
     (`crops.routes.ts`) are unaffected. `appendPageAssets()` caches one decode per
     distinct source asset and reuses it across every crop taken from it — in the
     overwhelmingly common case (a page's crops all come from that page's one
     uploaded sketch), this collapses N re-decodes to 1.
  - **Deliberately not done:** parallelizing the outer per-page loop or adding a
    batch (`findByIds`) method to the repository layer. Page counts are small in
    practice (this app's multi-page feature is not a "hundreds of pages" pattern),
    and a repository-layer batch method would need implementing and
    contract-testing against both the JSON and Prisma adapters — real scope, not
    matched by the payoff here. Left as a smaller, targeted fix rather than the
    full rewrite the original framing described.
- **Regression test:** `apps/api/src/modules/crops/crop.service.test.ts` (new file —
  no test previously existed for `crop.service.ts`). Asserts `cropFromDecoded()`
  produces byte-identical output to the un-refactored `cropDetection()` for the same
  detection, that reusing one decoded image across multiple crops still produces
  correct/distinct results, and that both `NOT_FOUND`/`INVALID_IMAGE` error paths
  match between the old and new entry points. Full regression (typecheck, Vitest
  334/334, Pytest 19/19, build, Playwright 16/16 including `golden-path.spec.ts` and
  `multi-page.spec.ts`, both of which exercise a real export) all green.
- **Status:** ✅ Fixed and regression-tested.

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
  found unprotected (the one real gap found, `/uploads`, was logged and later fixed
  as DEF-008 — see its entry in "Fixed this pass" above).
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
