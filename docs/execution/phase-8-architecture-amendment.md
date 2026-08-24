---
title: "Phase 8 — Architecture Amendment"
status_date: "2026-08-24"
amends: "Sketch2UI_Claude_Code_Phase_by_Phase_Execution_Plan.md §11 (Phase 8), Appendix E"
status: "ACTIVE — supersedes the plan's §8.1 'critical rule' for this phase only"
---

# Phase 8 — Architecture Amendment

> **Phase 8 changes from "swap persistence implementation without route changes" to
> "introduce a real repository/service boundary, then convert persistence callers
> module-by-module while preserving route contracts and user-visible behavior."**

This document exists because the plan's stated approach for Phase 8 cannot be
executed against the actual source tree. It is not a scope expansion or a
preference — it is a correction of a factual premise, recorded rather than
worked around, per operating Rule 7 and Rule 12.

---

## 1. The original assumption, and why it is invalid

The execution plan states, as the *critical rule* for Phase 8:

> **§8.1 Critical rule** — "Do not rewrite route behavior. The current JSON store
> deliberately exposes module-level functions so it can be swapped. Use that
> abstraction."

`apps/api/src/db/jsonStore.ts` makes the same claim in its own header:

> *"Swap for Prisma/Postgres in Phase 2+ without touching module/route code, since
> routes only depend on the exported functions below."*

**Neither statement is true of the code as written.** The store does not expose a
functional abstraction. It exposes three things:

```ts
export const db = {
  get state(): StoreShape { return store; },   // the entire mutable object graph
  save(): void { persist(); },                 // rewrite the whole file
  reset(): void { ... },
};
```

`db.state` hands callers **live references into in-memory arrays**. Routes do not
call functions that encapsulate persistence; they reach into the graph, mutate
objects by reference, and then ask the store to flush the whole file.

## 2. Evidence from the actual source

Measured on 2026-08-24 across `apps/api/src`:

| Measurement | Value |
|---|---:|
| Lines containing `db.state` | **92** |
| Total `db.state` occurrences | **100** |
| Files touching `db.state` | **19** |
| `db.save()` call sites | **32** |
| `async` route handlers in the entire API | **2** |

(The 92 vs 100 difference is real: seven lines in `projects.routes.ts` and one in
`detections.service.ts` contain two occurrences each, e.g.
`db.state.assets = db.state.assets.filter(...)`. Earlier notes quoted 92, which
was a line count. Occurrences are the precise figure.)

### 2.1 Per-module access map

| Module / file | `db.state` | `db.save()` | Read/write pattern | Target repository |
|---|---:|---:|---|---|
| `modules/projects/projects.routes.ts` | 15 | 3 | CRUD + **cascade delete across 7 collections**; PATCH mutates found object by reference | `ProjectRepository` |
| `modules/codegen/code-versions.routes.ts` | 10 | 2 | list/find versions; append immutable version; **mutates `project.activeCodeVersionId` by reference** | `CodeVersionRepository`, `ProjectRepository` |
| `modules/exports/exports.routes.ts` | 10 | 1 | project+version+asset lookups; append export; list/find | `ExportRepository`, `CodeVersionRepository`, `AssetRepository`, `DetectionRepository` |
| `modules/training/training.routes.ts` | 7 | 1 | project+asset lookup; filter active detections; **find-then-splice supersede** | `TrainingRepository`, `DetectionRepository` |
| `modules/codegen/codegen.routes.ts` | 6 | 1 | project+asset+detections read; append version; mutate project status/active id | `CodeVersionRepository`, `ProjectRepository`, `DetectionRepository` |
| `modules/detections/detections.routes.ts` | 5 | 3 | list/find/create/**mutate-in-place**/splice-delete | `DetectionRepository` |
| `modules/detections/detections.service.ts` | 5 | 1 | create (push), list-by-project, **bulk filter-delete of model detections** | `DetectionRepository` |
| `modules/structure-overrides/structure-overrides.routes.ts` | 5 | 3 | project+detection lookup; **mutate nested map on project** | `StructureOverrideRepository` |
| `modules/content-overrides/content-overrides.routes.ts` | 4 | 3 | as above | `ContentOverrideRepository` |
| `modules/geometry-overrides/geometry-overrides.routes.ts` | 4 | 3 | as above | `GeometryOverrideRepository` |
| `modules/style-overrides/style-overrides.routes.ts` | 4 | 2 | as above | `StyleOverrideRepository` |
| `modules/assets/assets.routes.ts` | 3 | 1 | project guard; append asset; list by project | `AssetRepository` |
| `modules/jobs/jobs.service.ts` | 3 | 3 | create/find/**Object.assign mutate**; `failOrphanedJobs` bulk update | `JobRepository` |
| `modules/boundaries/boundaries.service.ts` | 2 | 2 | find-by-asset; **Object.assign upsert**; sticky-manual rule | `BoundaryRepository` |
| `modules/boundaries/boundaries.routes.ts` | 2 | 0 | project + asset guard | `ProjectRepository`, `AssetRepository` |
| `modules/crops/crops.routes.ts` | 2 | 0 | detection + asset lookup (read-only) | `DetectionRepository`, `AssetRepository` |
| `modules/detections/detect.routes.ts` | 2 | 0 | project + asset guard (read-only) | `ProjectRepository`, `AssetRepository` |
| `modules/corrections/corrections.service.ts` | 2 | 3 | append record; filter+sort by project/detection | `CorrectionRepository` |
| `modules/corrections/corrections.routes.ts` | 1 | 0 | project guard (read-only) | `ProjectRepository` |
| **Total** | **100** | **32** | | |

### 2.2 The dominant pattern is a project existence guard

**13 of the 19 modules** contain `db.state.projects.find((p) => p.id === req.params.id)`
purely to return a 404. This is the single most common persistence interaction in
the codebase, and it is why `ProjectRepository` is migrated first: it is the
highest-leverage contract in the system.

### 2.3 Routes that depend on synchronous mutation semantics

These are the ones that break silently rather than loudly, so they are enumerated
explicitly (plan Part 20, stop condition 3 — **found, and reported here**):

| Location | Mutation | Why it breaks under Prisma |
|---|---|---|
| `projects.routes.ts` PATCH | `project.name = name; … db.save(); res.json(project)` | The response body *is* the stored object. A Prisma `findUnique` returns a detached row; mutating it persists nothing. |
| `code-versions.routes.ts` POST + activate | `project.activeCodeVersionId = version.id` | Same — relies on the found project being the live array element. |
| `boundaries.service.ts` `saveBoundary` | `Object.assign(existing, {...})` then returns `existing` | In-place upsert; the returned record is the stored one. |
| `jobs.service.ts` `updateJob` | `Object.assign(job, patch)` | Every job progress update goes through this. |
| `detections.routes.ts` PATCH | `detection.className = …`, `detection.source = "manual"` | The model→manual flip — the single most behaviour-critical mutation in the app. |
| all four override routes | `project.styleOverrides[detection.id] = cleaned` | Mutates a nested map hanging off the shared project object. |

Additionally, `server.ts` calls `failOrphanedJobs()` **synchronously inside the
`app.listen()` callback**. When `JobRepository` becomes async that call site must
handle a promise, or orphaned jobs will silently stop being reaped.

## 3. Why Prisma requires async data access

Prisma Client is asynchronous by construction: every query returns a `Promise`,
because it performs I/O over a socket to the database server via a query engine.
There is no synchronous query API, and there is no supported way to obtain one.

Consequently:

```ts
db.state.projects.find((p) => p.id === id)   // synchronous, returns Project | undefined
await projectRepo.findById(id)               // asynchronous, returns Promise<Project | null>
```

cannot be substituted for one another. Any call site reading persistence must
become `async`/`await`, and asynchrony propagates upward through every caller.
**This is the change the plan's §8.1 forbids, and it is unavoidable.**

## 4. Rejected: write-behind cache

*Load every row into memory at boot, keep serving `db.state` synchronously, flush
changes to Postgres in the background.*

**Rejected.** It preserves route code at the cost of everything Phase 8 exists to
gain:

- **No transactional consistency.** §8.3 asks for transactions around
  save-detection-set, save/activate code version, delete project, and training
  snapshot. A cache that flushes asynchronously cannot provide atomicity — the
  in-memory write has already been observed by the next request before the
  database write happens or fails.
- **No concurrent-write safety.** §8.2's whole complaint about the JSON store is
  "no real transactional guarantees, no concurrent-write safety". A memory cache
  in one Node process reproduces that limitation exactly, now with the added risk
  that memory and database can silently disagree after a failed flush.
- **Foreign keys become advisory.** The 23 FKs in the schema would only be
  discovered to be violated *after* the request that violated them succeeded.
- **It is strictly worse than the status quo.** Same guarantees as the JSON store,
  plus a network hop, plus a second copy of the truth that can drift.

The plan itself rules this out in spirit: *"Do not run both as production sources
of truth indefinitely"* (Appendix E stage 4).

## 5. Rejected: synchronous database wrapper

*Wrap Prisma in something that blocks until the promise resolves — `Atomics.wait`
on a worker thread, deasync-style native re-entry, or a sync child process.*

**Rejected.** Every variant either:

- blocks Node's single event loop, serialising all concurrent requests behind each
  query and destroying throughput under any real load; or
- re-enters the event loop from native code (the `deasync` approach), which is
  documented as unsafe and produces non-deterministic reentrancy bugs; or
- adds a worker-thread + `SharedArrayBuffer` handshake whose complexity and
  failure modes exceed the async conversion it is trying to avoid.

The async conversion is mechanical, type-checked, and reviewable. A synchronous
wrapper is none of those things.

## 6. The new architecture

```text
CURRENT                          TARGET
routes/services                  routes / services
      │                                │
      ▼                                ▼
   db.state                    repository CONTRACT   (async interfaces)
      │                                │
      ▼                          ┌─────┴─────┐
   JSON file                     ▼           ▼
                          JSON adapter   Prisma adapter
                          (migration/         │
                           parity only)       ▼
                                          PostgreSQL
```

Rules enforced by this boundary:

1. Application modules depend on **interfaces**, never on `PrismaClient` or
   `jsonStore`.
2. Every repository method is `async`.
3. Prisma imports live **only** inside `repositories/prisma/`.
4. Transactions live at the repository/service boundary, only where multiple
   writes must be atomic.
5. Foreign keys enforce integrity in the database rather than being re-checked in
   application code.

Interfaces are domain-shaped, not generic CRUD: they expose the operations the
application actually performs (e.g. `DetectionRepository.clearModelDetections`,
`BoundaryRepository.saveRespectingManual`), derived from the access map in §2.1.

## 7. Migration strategy

Module-by-module, never all at once:

1. Define the repository contracts.
2. Implement a **JSON adapter** over the existing `db.state` — no redesign of JSON
   persistence, purely an adapter.
3. Implement a **Prisma adapter** against the same contracts.
4. Prove the two are equivalent with **contract tests that run against both**.
5. Convert one module at a time to the contracts, verifying route behaviour is
   unchanged after each.
6. Once every module is converted, flip the driver to Prisma.
7. Delete `db.state` access from application code and add a CI guard.

Order (highest leverage and lowest risk first): **Projects → Assets → Detections →
Boundaries → Code versions → Overrides → Training/Exports → Jobs.** Jobs last
because `failOrphanedJobs` is invoked from server startup and needs its own
handling.

## 8. Temporary compatibility strategy

During migration, converted and unconverted modules coexist. This is safe
**only because both read the same underlying store**: the JSON adapter wraps the
very same `db.state` the unconverted modules use, so there is exactly one source
of truth throughout.

The `PERSISTENCE_DRIVER` switch (`json` | `postgres`) exists solely to support
migration and parity testing. It is not a supported production configuration:
the target runtime is `postgres`, and shipping on `json` would mean shipping the
problem Phase 8 set out to fix.

## 9. Rollback strategy

- **Per module:** each conversion is an isolated commit touching one module plus
  its tests. Reverting one commit restores that module's previous behaviour; the
  repository layer is additive and inert until a module opts in.
- **Runtime:** `PERSISTENCE_DRIVER=json` restores JSON-backed behaviour for every
  converted module without a code change, because both adapters satisfy the same
  contract.
- **Data:** the JSON store is never mutated or deleted by the migration. The
  importer only reads it. If Postgres is wrong, the JSON file is still the intact
  original — this is why the importer is one-way and the store stays untouched.
- **Schema:** migrations are versioned SQL under `prisma/migrations/`; a bad
  schema change is reverted by a new forward migration, never by editing history.

## 10. Verification strategy

| Level | Mechanism |
|---|---|
| Contract | One test suite executed against **both** adapters — same assertions, same fixtures. A behavioural difference fails the build. |
| Referential | Importer `--dry-run` validates the real store against the schema's constraints, and is itself proven by injected-corruption fixtures. |
| Regression | The full existing suite (`npm run test`, `npm run test:py`) must stay green throughout. |
| Route contract | HTTP method, URL, request shape, response shape and status codes unchanged — verified by live smoke tests against a running API. |
| Static | CI guard asserting no new `db.state` / `db.save()` usage in application modules once conversion completes. |

Explicit non-goal: byte-identical internals. IDs, timestamps and ordering may
differ between adapters; **semantics** must not.
