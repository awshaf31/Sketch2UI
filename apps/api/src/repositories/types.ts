/**
 * Repository contracts — Phase 8 architecture amendment.
 *
 * See docs/execution/phase-8-architecture-amendment.md for why this layer exists: the
 * plan assumed the JSON store already provided a swappable functional abstraction, but
 * it exposes a synchronous mutable object graph (`db.state`) that 19 modules reach into
 * directly. These interfaces are that abstraction, defined for real.
 *
 * DESIGN RULES
 *   1. Every method is async. Prisma has no synchronous API, and pretending otherwise
 *      is what §4/§5 of the amendment rejects.
 *   2. Methods are DOMAIN-shaped, not generic CRUD. Each one below corresponds to an
 *      operation the application actually performs today (derived from the per-module
 *      access map in the amendment §2.1). Nothing here is speculative API surface.
 *   3. Reads return detached plain objects. Callers MUST NOT mutate a returned object
 *      and expect it to persist — that is precisely the synchronous-mutation habit
 *      (amendment §2.3) this layer removes. Write intent goes through an explicit call.
 *   4. `null` means "not found". Methods never throw for a missing row.
 */

import type {
  AuditEvent,
  AuditLog,
  CodeVersion,
  ContentOverride,
  CorrectionRecord,
  Detection,
  DetectionSource,
  GeometryOverride,
  Job,
  Page,
  PageBoundary,
  PageBoundaryRecord,
  PageBoundarySource,
  Project,
  ProjectAsset,
  ProjectExport,
  ProjectStatus,
  Session,
  StructureOverride,
  TrainingSample,
  User,
} from "@sketch2ui/shared-types";

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/**
 * A Project as the repository layer models it.
 *
 * DELIBERATE NARROWING: the four inspector override maps (`styleOverrides`,
 * `contentOverrides`, `geometryOverrides`, `structureOverrides`) are NOT part of this
 * type, even though the shared-types `Project` declares them optionally.
 *
 * They are a persistence detail of the JSON store — the Prisma schema normalizes them
 * into their own tables with foreign keys to Detection (schema.prisma, and amendment
 * §6). Keeping them on the project entity would force the two adapters to disagree
 * about what a Project is.
 *
 * Verified safe before making this change: `apps/web` never reads an override map off
 * a project object (it uses the dedicated /style-overrides, /content-overrides,
 * /geometry-overrides and /structure-overrides endpoints), and exactly one project in
 * the live store carries any override key at all. This is recorded as the single
 * deliberate response-shape narrowing in Phase 8 — see the Part 2 report.
 */
export type ProjectRecord = Omit<
  Project,
  "styleOverrides" | "contentOverrides" | "geometryOverrides" | "structureOverrides"
>;

export interface CreateProjectInput {
  name: string;
  description?: string;
  /** The account that will own the created project. */
  ownerId: string;
}

/** Only the fields PATCH /api/projects/:id actually accepts. */
export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

/**
 * What a cascade delete removed, so the caller can clean up the files those rows
 * pointed at. `projects.routes.ts` does this today by capturing the orphans BEFORE
 * filtering the arrays; returning them keeps that behaviour without the caller needing
 * to know how the cascade is implemented (JSON filters arrays; Postgres uses ON DELETE
 * CASCADE, so the adapter must read the rows before deleting them).
 */
export interface DeletedProjectArtifacts {
  assets: ProjectAsset[];
  exports: ProjectExport[];
}

export interface ProjectRepository {
  list(): Promise<ProjectRecord[]>;
  /** Scoped to one owner — the shape every route now needs, since a project list is
   * never global once accounts exist. */
  listByOwner(ownerId: string): Promise<ProjectRecord[]>;
  findById(id: string): Promise<ProjectRecord | null>;
  create(input: CreateProjectInput): Promise<ProjectRecord>;
  update(id: string, patch: UpdateProjectInput): Promise<ProjectRecord | null>;
  /** Cascades to every project-scoped collection. Returns null if the project is gone. */
  delete(id: string): Promise<DeletedProjectArtifacts | null>;
  /**
   * Point preview/export at a specific code version. Separate from `update` because it
   * is a distinct domain action with its own route (PUT .../activate) and its own
   * invariant (the version must belong to the project), not a general field edit.
   */
  setActiveCodeVersion(projectId: string, codeVersionId: string): Promise<void>;
  /** Used by the codegen route to move a project to "generated". */
  setStatus(projectId: string, status: ProjectStatus): Promise<void>;
}

// ---------------------------------------------------------------------------
// Pages — Phase D3 minimum-viable multi-page
// ---------------------------------------------------------------------------

export interface CreatePageInput {
  projectId: string;
  name: string;
}

export interface UpdatePageInput {
  name?: string;
}

export interface PageRepository {
  /** Ordered by `order` ascending — the sequence the Pages strip and export both use. */
  listByProject(projectId: string): Promise<Page[]>;
  findById(id: string): Promise<Page | null>;
  /** `order` is assigned by the implementation as `existing.length + 1`, same
   * pattern as CodeVersion's versionNumber — the caller never picks it. */
  create(input: CreatePageInput): Promise<Page>;
  update(id: string, patch: UpdatePageInput): Promise<Page | null>;
  /** Returns false if this was the project's only page (caller must refuse the
   * delete) or the page didn't exist; true if it was removed. */
  delete(id: string): Promise<boolean>;
  setActiveCodeVersion(pageId: string, codeVersionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface CreateAssetInput {
  projectId: string;
  pageId: string;
  storageKey: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
}

export interface AssetRepository {
  listByProject(projectId: string): Promise<ProjectAsset[]>;
  listByPage(pageId: string): Promise<ProjectAsset[]>;
  findById(id: string): Promise<ProjectAsset | null>;
  /** `exports.routes.ts` uses the most recent asset as the export's source sketch. */
  findLatestForProject(projectId: string): Promise<ProjectAsset | null>;
  findLatestForPage(pageId: string): Promise<ProjectAsset | null>;
  create(input: CreateAssetInput): Promise<ProjectAsset>;
}

// ---------------------------------------------------------------------------
// Detections
// ---------------------------------------------------------------------------

export interface CreateDetectionInput {
  projectId: string;
  pageId: string;
  sourceAssetId: string;
  className: string;
  bbox: Detection["bbox"];
  source: DetectionSource;
  confidence?: number;
  modelVersionId?: string;
  status?: Detection["status"];
}

/**
 * The PATCH surface. Deliberately NOT `Partial<Detection>`: the route only accepts
 * these fields, and the model→manual flip is derived by the repository rather than
 * being something a caller can set directly (see `update`).
 */
export interface UpdateDetectionInput {
  className?: string;
  bbox?: Detection["bbox"];
  status?: Detection["status"];
}

/**
 * What an update actually did.
 *
 * `previous` is returned rather than left to the caller to fetch first, for two
 * reasons: the correction-history records need the before-state (old class, old bbox),
 * and a caller doing read-then-write would race under Postgres. The implementation
 * reads and writes atomically and hands back both halves.
 *
 * The `*Changed` flags are computed by the repository against the stored row, so
 * callers cannot disagree with it about whether something changed — which is what
 * decides both the model→manual flip and whether a correction is recorded.
 */
export interface DetectionUpdateResult {
  detection: Detection;
  previous: Detection;
  classChanged: boolean;
  bboxChanged: boolean;
}

export interface DetectionRepository {
  listByProject(projectId: string): Promise<Detection[]>;
  listByPage(pageId: string): Promise<Detection[]>;
  listActiveByProject(projectId: string): Promise<Detection[]>;
  listActiveByPage(pageId: string): Promise<Detection[]>;
  listActiveByAsset(assetId: string): Promise<Detection[]>;
  /** Unscoped lookup — only for callers that genuinely have just an id (exports). */
  findById(id: string): Promise<Detection | null>;
  /** Project-scoped lookup: the common case, and what every route 404s on. */
  findInProject(projectId: string, id: string): Promise<Detection | null>;
  /** Page-scoped lookup — what every page-nested route 404s on since Phase D3. */
  findInPage(pageId: string, id: string): Promise<Detection | null>;
  create(input: CreateDetectionInput): Promise<Detection>;
  createMany(inputs: CreateDetectionInput[]): Promise<Detection[]>;
  /**
   * Apply a correction.
   *
   * BEHAVIOUR THAT MUST BE PRESERVED (plan §26, detections.routes.ts): when the target
   * is model-sourced and the class or bbox actually changed, the implementation flips
   * `source` to "manual", pins `confidence` to 1, and records `originalClassName` the
   * first time the class changes — guarded, so a second correction does not overwrite
   * what the model originally said.
   *
   * This is the guarantee that a later re-detect cannot silently destroy a human
   * correction (`clearModelDetections` only removes rows still marked `model`), so it
   * lives in the repository rather than in a route a future caller might bypass. It is
   * the single most behaviour-critical rule in the application.
   */
  update(projectId: string, id: string, patch: UpdateDetectionInput): Promise<DetectionUpdateResult | null>;
  /** Page-scoped equivalent of `update` — what every page-nested route calls since
   * Phase D3, so a detectionId from a sibling page can never be touched through the
   * wrong page's URL. */
  updateInPage(pageId: string, id: string, patch: UpdateDetectionInput): Promise<DetectionUpdateResult | null>;
  /** Returns the deleted row so the caller can record what was removed. */
  delete(projectId: string, id: string): Promise<Detection | null>;
  /** Page-scoped equivalent of `delete`. */
  deleteInPage(pageId: string, id: string): Promise<Detection | null>;
  /** §27.5 idempotency: re-running detection must not stack duplicates. */
  clearModelDetections(projectId: string, sourceAssetId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Page boundaries
// ---------------------------------------------------------------------------

export interface BoundaryRepository {
  findByAsset(assetId: string): Promise<PageBoundaryRecord | null>;
  /**
   * The sticky-correction rule, kept as one domain operation rather than a
   * read-then-write the caller could get wrong: an `auto` write against an asset that
   * already has a `manual` record is refused, and the pre-existing manual record is
   * returned instead.
   */
  saveRespectingManual(
    projectId: string,
    pageId: string,
    assetId: string,
    boundary: PageBoundary,
    source: PageBoundarySource
  ): Promise<{ record: PageBoundaryRecord; preservedManual: boolean }>;
}

// ---------------------------------------------------------------------------
// Code versions
// ---------------------------------------------------------------------------

export interface CreateCodeVersionInput {
  projectId: string;
  pageId: string;
  source: CodeVersion["source"];
  html: string;
  css: string;
  metadata?: CodeVersion["metadata"];
}

export interface CodeVersionRepository {
  /** Newest first, matching the current listVersions() ordering. */
  listByProject(projectId: string): Promise<CodeVersion[]>;
  /** Page-scoped equivalent — what the version-history route calls since Phase D3
   * (each page has its own independent version sequence). */
  listByPage(pageId: string): Promise<CodeVersion[]>;
  findById(projectId: string, versionId: string): Promise<CodeVersion | null>;
  findByPage(pageId: string, versionId: string): Promise<CodeVersion | null>;
  /**
   * Append an immutable version. The version number is assigned by the implementation
   * so it cannot race — under the JSON store two concurrent saves could both compute
   * `existing.length + 1`; the Prisma schema's @@unique([pageId, versionNumber])
   * turns that into a hard constraint.
   */
  create(input: CreateCodeVersionInput): Promise<CodeVersion>;
  /** The version preview/export use: the pinned one if set and still present, else latest. */
  resolveActive(projectId: string): Promise<CodeVersion | null>;
  /** Page-scoped equivalent of `resolveActive` — every page has its own active
   * version since Phase D3. */
  resolveActiveForPage(pageId: string): Promise<CodeVersion | null>;
}

// ---------------------------------------------------------------------------
// Inspector overrides — one repository per group, all keyed on DETECTION UUID.
//
// Keying is deliberate and must not change: UI-IR node ids are assigned from a
// per-generation counter and shift whenever detections change, so an override keyed on
// one would silently reattach to the wrong element. See project.ts and the Phase 1-3
// reports.
// ---------------------------------------------------------------------------

export interface OverrideRepository<T> {
  /** The whole project's map, shaped as the API already returns it. */
  mapForProject(projectId: string): Promise<Record<string, T>>;
  /** One page's slice of that map — what the page-nested override routes call
   * since Phase D3, so a sibling page's overrides never leak into this page's list. */
  mapForPage(pageId: string): Promise<Record<string, T>>;
  findByDetection(projectId: string, detectionId: string): Promise<T | null>;
  /** Upsert. An empty value is a delete — the Reset flow every override group shares.
   * `pageId` is required (not just `projectId`) because the override row itself now
   * carries `pageId` (Phase D3) and must be stamped on first insert. */
  put(projectId: string, pageId: string, detectionId: string, value: T): Promise<T | null>;
  remove(projectId: string, detectionId: string): Promise<void>;
}

export type StyleOverrideRepository = OverrideRepository<Record<string, string>>;
export type ContentOverrideRepository = OverrideRepository<ContentOverride>;
export type GeometryOverrideRepository = OverrideRepository<GeometryOverride>;
export type StructureOverrideRepository = OverrideRepository<StructureOverride>;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface CreateJobInput {
  projectId: string;
  /** Optional, mirroring sourceAssetId — a detect/codegen job is page-scoped, a
   * hypothetical whole-project export job would not be. */
  pageId?: string;
  type: Job["type"];
  sourceAssetId?: string;
}

export interface JobRepository {
  findById(id: string): Promise<Job | null>;
  /** SaaS phase S8 — Admin Projects' per-project job list (brief Phase 10: "inspect
   * associated jobs"). No ordering guarantee, matching every other list()'s
   * convention in this file. */
  listByProject(projectId: string): Promise<Job[]>;
  /** SaaS phase S9 — Admin Job Monitoring's global, cross-project list (brief Phase
   * 11). No ordering guarantee. */
  listAll(): Promise<Job[]>;
  create(input: CreateJobInput): Promise<Job>;
  update(id: string, patch: Partial<Omit<Job, "id" | "createdAt">>): Promise<Job | null>;
  /**
   * Fail everything a dead process left mid-flight. Called from server startup, which
   * is currently a synchronous `app.listen` callback — converting this to async means
   * that call site must handle the promise or orphan reaping silently stops
   * (amendment §2.3).
   */
  failOrphaned(): Promise<number>;
}

// ---------------------------------------------------------------------------
// Training samples
// ---------------------------------------------------------------------------

export interface TrainingRepository {
  findByAsset(assetId: string): Promise<TrainingSample | null>;
  /** Re-approving SUPERSEDES the previous snapshot rather than stacking duplicates. */
  upsertApproval(sample: TrainingSample): Promise<{ sample: TrainingSample; replacedPrevious: boolean }>;
  /** SaaS phase S9 — Admin Training Data (brief Phase 13). Every row here is already
   * approved (see training-sample.ts: existence IS the approval; there is no
   * pending/rejected state to filter by). No ordering guarantee. */
  listAll(): Promise<TrainingSample[]>;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export interface CreateExportInput {
  projectId: string;
  codeVersionId: string;
  versionNumber: number;
  storagePath: string;
  fileSize: number;
}

export interface ExportRepository {
  listByProject(projectId: string): Promise<ProjectExport[]>;
  findById(id: string): Promise<ProjectExport | null>;
  create(input: CreateExportInput): Promise<ProjectExport>;
  /** Next per-project export number; the implementation owns the counter. */
  nextVersionNumber(projectId: string): Promise<number>;
}

// ---------------------------------------------------------------------------
// Correction history
// ---------------------------------------------------------------------------

export interface CorrectionRepository {
  /** Chronological. `detectionId` scopes to one node's history for the Inspector. */
  list(projectId: string, detectionId?: string): Promise<CorrectionRecord[]>;
  /** Page-scoped equivalent — what the page-nested corrections route calls since
   * Phase D3, so a sibling page's corrections never leak into this page's history. */
  listByPage(pageId: string, detectionId?: string): Promise<CorrectionRecord[]>;
  append(record: Omit<CorrectionRecord, "id" | "timestamp" | "source">): Promise<CorrectionRecord>;
}

// ---------------------------------------------------------------------------
// Users & sessions — Phase D1 authentication
// ---------------------------------------------------------------------------

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  /** Case-insensitive: callers are expected to have already normalized `email`, but
   * the adapter's own uniqueness check must not depend on that. */
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  /** SaaS phase S6 — Admin Overview's one real, cheap, database-backed metric. */
  count(): Promise<number>;
  /** SaaS phase S7 — Admin Users list. No ordering guarantee, matching
   * ProjectRepository.list()'s own convention. */
  listAll(): Promise<User[]>;
  /** The one supported role mutation (apps/api/scripts/promote-admin.ts) — a
   * deliberate, controlled operation, never exposed on an admin route (Phase 9: "role
   * changes... if required" — not required yet). Exists as a repository method
   * (rather than the script/tests reaching into db.state directly) because
   * check:db-state's zero-direct-access invariant applies across all of
   * apps/api/src, including test files. */
  setRole(id: string, role: string): Promise<User | null>;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Audit logs — SaaS phase S10 (brief Phase 14)
// ---------------------------------------------------------------------------

export interface RecordAuditLogInput {
  event: AuditEvent;
  userId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Deliberately append-oriented: only `record` and `listRecent` exist. There is no
 * update or delete — a real audit trail is never edited after the fact, and the
 * absence of those methods makes that a compile-time guarantee for every caller,
 * not just a documented convention.
 */
export interface AuditLogRepository {
  record(input: RecordAuditLogInput): Promise<AuditLog>;
  /** Newest first. `limit` bounds an otherwise-unbounded, ever-growing table — every
   * other list() in this app is small-scale by nature; this is the one domain where
   * that assumption doesn't hold. */
  listRecent(limit: number): Promise<AuditLog[]>;
}

// ---------------------------------------------------------------------------
// The set handed to application modules
// ---------------------------------------------------------------------------

export interface Repositories {
  projects: ProjectRepository;
  pages: PageRepository;
  assets: AssetRepository;
  detections: DetectionRepository;
  boundaries: BoundaryRepository;
  codeVersions: CodeVersionRepository;
  styleOverrides: StyleOverrideRepository;
  contentOverrides: ContentOverrideRepository;
  geometryOverrides: GeometryOverrideRepository;
  structureOverrides: StructureOverrideRepository;
  jobs: JobRepository;
  training: TrainingRepository;
  exports: ExportRepository;
  corrections: CorrectionRepository;
  users: UserRepository;
  sessions: SessionRepository;
}
