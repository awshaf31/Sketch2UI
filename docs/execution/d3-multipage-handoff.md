---
title: "Phase D3 (multi-page) — in-progress handoff"
status_date: "2026-08-25"
status: "BACKEND COMPLETE AND VERIFIED. FRONTEND NOT STARTED. Not yet committed to git."
---

# Phase D3 — Minimum Viable Multi-Page: handoff

This is a **mid-phase handoff**, written because the session doing this work ran out
of budget (context/usage limits) before finishing. It exists so a **different Claude
Code session — possibly a different account entirely** — can resume without
re-deriving anything, since this file lives in the repo and isn't tied to any
particular account's local memory.

**Read `Sketch2UI_Deadline_4_Features_Claude_Code_Execution_Plan.md` (repo root) §6
first** for the overall D3 goal and constraints. This file only tracks what's actually
been built so far against that plan — it is not a replacement for it.

The full detailed design plan (schema, repository, route, and frontend decisions with
rationale) was written to `/Users/ahsafahmath/.claude/plans/radiant-crafting-starfish.md`
during planning — that path is a local Claude Code plan-mode artifact, **not
guaranteed to exist in a new account/machine**. Everything load-bearing from it is
repeated below; if that file happens to still be readable, it has more prose/rationale,
but nothing new that changes what to build.

## Status: as of this commit, is this checked in?

**Check `git status` before doing anything else.** At the time this file was written,
none of the D3 work (or, if you're reading this later, possibly none of D1/D2 either —
check `docs/execution/phase-log.md` for what has an entry) was committed. If `git log`
shows a recent commit mentioning "Phase D3" or "multi-page", the work described below
is already merged and this file is stale documentation — delete it and move on to D4.
If `git status` shows a large uncommitted diff matching the file list below, the work
described here is real but sitting in the working tree, uncommitted.

## What's DONE (backend — fully implemented and verified working)

- **Prisma schema**: new `Page` model (`apps/api/prisma/schema.prisma`). `pageId`
  added to `ProjectAsset`, `Detection`, `CodeVersion` (unique constraint moved from
  `[projectId, versionNumber]` to `[pageId, versionNumber]`), `PageBoundaryRecord`,
  `CorrectionRecord`, and the four override models (`StyleOverride`,
  `ContentOverride`, `GeometryOverride`, `StructureOverride`). Migration at
  `apps/api/prisma/migrations/20260826000000_add_pages/migration.sql`, generated via
  `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel <new> --script`
  (no live database needed — same technique the existing `add_auth` migration used).
  Prisma client already regenerated (`npm run db:generate -w apps/api`).
- **`packages/shared-types`**: new `src/page.ts` (`Page` type). `pageId: string`
  added to `ProjectAsset`, `Detection`, `CodeVersion`, `PageBoundaryRecord`,
  `CorrectionRecord` in their respective files; `Job` got an *optional* `pageId?`.
- **Repository layer** (`apps/api/src/repositories/`): new `PageRepository`
  (`json/page.repository.ts` + `prisma/page.repository.ts`) with `listByProject`,
  `findById`, `create` (assigns `order` as `existing.length + 1`), `update` (rename),
  `delete` (**returns `false`, refuses, if it's the project's last page** — this is
  the structural "a project can never have zero pages" guard), `setActiveCodeVersion`.
  Wired into `repositories/index.ts` and `repositories/types.ts`.
  Existing repos (`AssetRepository`, `DetectionRepository`, `CodeVersionRepository`,
  the four `OverrideRepository<T>` instances) got **additive** `*ByPage` sibling
  methods (`listByPage`, `listActiveByPage`, `findInPage`, `updateInPage`,
  `deleteInPage`, `resolveActiveForPage`, `findByPage`, `mapForPage`) — the old
  `*ByProject` methods were kept, not renamed, so nothing else broke.
  `BoundaryRepository.saveRespectingManual` and `OverrideRepository.put` got a real
  signature change (new `pageId` parameter inserted) since those genuinely needed one
  — low call-site count, already fixed everywhere.
- **`apps/api/src/db/jsonStore.ts`**: `backfillPages()` runs automatically on every
  `load()`, idempotently. For any project with zero pages, synthesizes "Page 1" and
  stamps `pageId` onto that project's existing assets/detections/codeVersions/jobs/
  pageBoundaries/correctionRecords. Persists to disk immediately (not just in memory)
  so the synthesized page's id is stable across restarts, not regenerated randomly
  every boot.
- **`packages/codegen`**: additive `idPrefix` option on `buildUITree` (`layout.ts`)
  and `generateCode` (`index.ts`). Default `""` — every existing caller that omits it
  (e.g. `scripts/src/evaluate.ts`) is unaffected. Purpose: namespace generated UI-IR
  node ids per page so a multi-page export's one shared `styles.css` can't have one
  page's `#node-id` layout/override rule apply inside a different page's document.
- **New `apps/api/src/modules/pages/pages.routes.ts`**: `GET/POST /api/projects/:id/pages`,
  `PATCH/DELETE /api/projects/:id/pages/:pageId`. Gated by `requireProjectOwnership`
  only (it defines what pages exist, so isn't itself nested under one).
- **New `apps/api/src/middleware/requirePageInProject.ts`**: mirrors
  `requireProjectOwnership.ts` exactly — fetches the page, 404s (not 403 — same
  existence-enumeration-avoidance reasoning as the project-ownership check) unless
  `page.projectId === req.params.id`. Mounted as the **second** middleware (after
  `requireProjectOwnership`) on every page-nested router.
- **All 13 previously project-nested routers restructured** from
  `/api/projects/:id/<resource>` to `/api/projects/:id/pages/:pageId/<resource>`:
  `assets`, `detections`, `detect`, `boundaries`, `training` (approve-training),
  `crops`, `codegen` (+ `latestCode`), `code-versions`, the four override routers,
  `corrections`. Each got the `requirePageInProject` line added and its handlers
  switched to the new `*ByPage`/`findInPage`/etc. repository methods. `exports` stays
  at `/api/projects/:id/exports` (project-level — a single export bundles every
  page). `jobs` stays top-level `/api/jobs/:jobId` (Phase D1's existing
  fetch-then-check inline pattern already handles it; a `pageId` was added to
  `Job`/`CreateJobInput` optionally, threaded through `detect.routes.ts` and
  `jobs.service.ts`'s `createJob`).
- **`apps/api/src/modules/exports/exports.routes.ts` — fully rewritten** for
  multi-page bundling: loops every page (ordered), page with `order === 1` exports as
  `index.html`, every other page as `page-{order}.html`; one shared `styles.css` built
  by **plain concatenation** of every page's own generated CSS (no dedup pass needed —
  duplicate `.ui-button`-style component blocks across pages are harmless since
  they're byte-identical, and the only real collision risk — id-selector rules — is
  already solved by codegen's `idPrefix`); each page's own crops and source-sketch are
  bundled (`source-sketch-index.*`, `source-sketch-page-2.*`, etc.). The
  `ProjectExport` record's single `codeVersionId` FK points at the **home page's**
  (order 1) version — a bookkeeping reference only, never read back to reconstruct
  the zip (the zip is served straight from disk by stored path).
- **`apps/api/src/modules/projects/projects.routes.ts`**: `POST /` now also creates
  "Page 1" for the brand-new project — the "every project has ≥1 page" invariant
  needs this explicitly; the JSON-store backfill only covers *pre-existing* projects,
  not ones created after D3 shipped. `JsonProjectRepository.delete()` now also filters
  `db.state.pages`.
- **`apps/api/src/db/migrate-json-to-postgres.ts`**: the one-way JSON→Postgres
  importer now synthesizes one Page per imported project (deterministic
  `randomUUID()` per project id, kept in a `Map` for the duration of the transaction)
  and stamps `pageId` on every child row it inserts.
- **New `apps/api/scripts/backfill-pages.ts`** (+ npm script `db:backfill-pages`):
  Postgres-side explicit backfill for the (rare, since `pageId` is NOT NULL on every
  page-owned table) case of a project with zero pages and zero child rows. Mirrors
  `backfill-legacy-owner.ts`'s "explicit, run-by-hand, not automatic" precedent from
  Phase D1.
- **Tests**: `apps/api/src/repositories/__tests__/page.contract.ts` +
  `.json.test.ts` + `.prisma.test.ts` (new `PageRepository` contract, including the
  last-page-delete guard). New `apps/api/src/modules/pages/pages.routes.test.ts`
  (HTTP-integration, via `supertest`) covering: a new project auto-gets "Page 1",
  create/rename/delete, the last-page-delete-refused guard, a page from a *different*
  project 404ing through `requirePageInProject` (cross-project isolation), and
  detection isolation between two pages of the *same* project. Every pre-existing
  repository contract test file (asset/detection/boundary/code-version/the four
  overrides/correction/job/training/export) was updated to create a page alongside
  its project in `beforeEach`, since `CreateAssetInput`/`CreateDetectionInput`/
  `CreateCodeVersionInput` now require `pageId`.

**Verification actually run and passing, at handoff time:**
```
npx tsc -p apps/api/tsconfig.json --noEmit     # clean
npm run test -w apps/api                        # 241 passed, 16 skipped (Prisma arms
                                                 # skip cleanly — no test DB reachable
                                                 # in that environment; normal)
npm run build -w packages/codegen               # clean
npx tsc -b apps/web --noEmit                    # clean, but see caveat below
```

## What's NOT done — this is the actual next step

**The frontend has not been touched at all.** `apps/web` typechecks clean only
because it still calls the *old* pre-D3 API URLs (`/api/projects/:id/detections`
etc.), which **no longer exist on the backend** — every one of those routes now
requires a `:pageId` segment. **The app is functionally broken right now** until the
frontend catches up. This is not optional polish; it's required for the app (and the
existing `e2e/golden-path.spec.ts`) to work at all.

Concretely, still to do:

1. **`apps/web/src/services/api.ts`** — add `listPages(projectId)`,
   `createPage(projectId, name?)`, `renamePage(projectId, pageId, name)`,
   `deletePage(projectId, pageId)`. Give every existing page-owned-resource method a
   `pageId` parameter and change its URL template to insert `/pages/${pageId}` at the
   right spot: `listAssets`, `uploadAsset`, `listDetections`, `createDetection`,
   `updateDetection`, `deleteDetection`, `getPageBoundary`, `savePageBoundary`,
   `approveTraining`, `getTrainingApproval`, `startDetection`, `generateCode`,
   `getLatestCode`, `listCodeVersions`, `getCodeVersion`, `saveEditedCode`,
   `activateCodeVersion`, the four override list/put/clear methods, `listCorrections`.
   Mechanical — mirror the backend route change file-for-file.
2. **`apps/web/src/stores/projectStore.ts`** — add `currentPageId: string | null` +
   a `setCurrentPageId` action that also clears `selectedId` (a selection from the
   previous page is meaningless after switching).
3. **New `apps/web/src/features/workspace/PagesStrip.tsx`** — one pill per page
   (`Button variant={selected ? "primary" : "ghost"} size="sm"`), a pencil
   `IconButton` that swaps the label for an inline `Input` to rename (Enter/blur
   commits via `api.renamePage`, Escape cancels), a trash `IconButton` using
   `useDialog().confirm({ title: "Delete page?", destructive: true })` then
   `api.deletePage` (hidden/disabled when it's the project's only page), and a
   trailing "+ Add page" button calling `api.createPage` then switching to it. Build
   from the existing `Button`/`IconButton`/`Input` primitives — do **not** reuse
   `Tabs.tsx` (it has no add/rename/delete affordance, would need bespoke children
   anyway).
4. **`apps/web/src/pages/ProjectWorkspace.tsx`** — on mount, additionally call
   `api.listPages(id)` and default `currentPageId` to the first page returned. Every
   existing data-loading `useEffect` and event handler needs `currentPageId` threaded
   through as a dependency/parameter (mechanical, same shape as the `api.ts` change).
   Render `<PagesStrip>` as a new row between the existing `<WorkspaceToolbar>` and
   `<StatusBar>`. **No changes needed** to `WorkspaceBody`, `CanvasPanel`,
   `UITreePanel`, `InspectorPanel`, `CodePanel`, or `PreviewPane` — they all consume
   state that's already page-shaped.

Then, in order:

5. **E2E**: update `e2e/golden-path.spec.ts` and `e2e/inspector-overrides.spec.ts` —
   should need near-zero changes (a fresh project still starts with exactly one page),
   but double-check the new `PagesStrip` row doesn't collide with the existing bare
   `input[type="file"]` selector both specs rely on. Add **one new spec**: add a
   second page → upload → detect → generate on it → export → assert the zip contains
   both `index.html` and `page-2.html`.
6. **Full regression**, none of which has been run yet with the frontend changes
   present: `npm run typecheck`, `npm run test`, `npm run test:py`, `npm run build`,
   `npm run test:e2e` (all from repo root).
7. **Manual browser smoke test**: open an existing (pre-D3) project, confirm it shows
   exactly one page ("Page 1") with all its prior work intact; add a second page,
   upload a different sketch, detect, generate, and confirm switching back to Page 1
   shows Page 1's own state, not Page 2's; export and confirm the ZIP has
   `index.html`, `page-2.html`, one `styles.css`, and crops from both pages; set a
   `link`-class detection's `href` to `./page-2.html` via the existing Content
   Inspector and confirm the exported `index.html` contains that exact relative link
   unchanged (this proves the plan's "cross-page links need no new mechanism" claim —
   `isSafeHref()` in `content-overrides.routes.ts` already accepts relative paths —
   worth actually verifying once there's a UI to test it with).

## How to resume

1. Run `git status` and `git log --oneline -5` to confirm the state described above
   is still accurate (or find out it's stale — see the top of this file).
2. Skip straight to frontend step 1 (`api.ts`) above. The backend does not need
   re-verification; it already passed the checks listed. Spend the budget on the
   frontend and the final verification pass instead.
3. Once frontend + e2e + full regression are green, this file's job is done — fold
   its content into `docs/execution/phase-log.md` as a normal "Phase D3" entry
   (matching the existing D1/D2 entries' format) and delete this handoff file, the
   same way the project already treats phase-log.md as the permanent record and
   scratch/handoff notes as temporary.
