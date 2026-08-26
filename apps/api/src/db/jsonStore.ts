import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import type {
  AuditLog,
  CodeVersion,
  CorrectionRecord,
  Detection,
  Job,
  Page,
  Project,
  ProjectAsset,
  PageBoundaryRecord,
  ProjectExport,
  Session,
  TrainingSample,
  User,
} from "@sketch2ui/shared-types";
import { env } from "../config/env.js";

// Temporary persistence layer. Plan section 8 specifies PostgreSQL via Prisma; this
// file-backed store lets the API run without a database during the skeleton phase
// (practical build order, section 51, steps 1-6). Swap for Prisma/Postgres in Phase 2+
// without touching module/route code, since routes only depend on the exported functions below.

interface StoreShape {
  projects: Project[];
  /** Phase D3 minimum-viable multi-page. */
  pages: Page[];
  assets: ProjectAsset[];
  detections: Detection[];
  codeVersions: CodeVersion[];
  jobs: Job[];
  trainingSamples: TrainingSample[];
  exports: ProjectExport[];
  pageBoundaries: PageBoundaryRecord[];
  /** Correction history / audit trail — plan §4 (execution plan Phase 4). */
  correctionRecords: CorrectionRecord[];
  /** Phase D1 authentication. */
  users: User[];
  sessions: Session[];
  /** SaaS phase S10 — append-oriented; see AuditLogRepository. */
  auditLogs: AuditLog[];
}

function emptyStore(): StoreShape {
  return {
    projects: [],
    pages: [],
    assets: [],
    detections: [],
    codeVersions: [],
    jobs: [],
    trainingSamples: [],
    exports: [],
    pageBoundaries: [],
    correctionRecords: [],
    users: [],
    sessions: [],
    auditLogs: [],
  };
}

/**
 * Backward-compat backfill — Phase D3. A Page is structurally required for the app
 * to function at all post-D3 (unlike Phase D1's ownerId placeholder, there is no
 * valid "project with no page" state), so this runs automatically on every load
 * rather than as an explicit script. Idempotent: a no-op once every project has
 * at least one page. Every existing project's existing data becomes "Page 1",
 * exactly matching the deadline plan's "every current single-page project must
 * automatically become Project -> Page 1" requirement.
 */
function backfillPages(store: StoreShape): boolean {
  const projectIdsWithPages = new Set(store.pages.map((p) => p.projectId));
  const projectsNeedingBackfill = store.projects.filter((p) => !projectIdsWithPages.has(p.id));
  if (projectsNeedingBackfill.length === 0) return false;

  for (const project of projectsNeedingBackfill) {
    const now = new Date().toISOString();
    const page: Page = {
      id: uuid(),
      projectId: project.id,
      name: "Page 1",
      order: 1,
      ...(project.activeCodeVersionId ? { activeCodeVersionId: project.activeCodeVersionId } : {}),
      createdAt: project.createdAt,
      updatedAt: now,
    };
    store.pages.push(page);

    for (const asset of store.assets) {
      if (asset.projectId === project.id) asset.pageId = page.id;
    }
    for (const detection of store.detections) {
      if (detection.projectId === project.id) detection.pageId = page.id;
    }
    for (const codeVersion of store.codeVersions) {
      if (codeVersion.projectId === project.id) codeVersion.pageId = page.id;
    }
    for (const job of store.jobs) {
      if (job.projectId === project.id) job.pageId = page.id;
    }
    for (const boundary of store.pageBoundaries) {
      if (boundary.projectId === project.id) boundary.pageId = page.id;
    }
    for (const correction of store.correctionRecords) {
      if (correction.projectId === project.id) correction.pageId = page.id;
    }
  }
  return true;
}

function writeToDisk(toWrite: StoreShape): void {
  fs.mkdirSync(path.dirname(env.storeFile), { recursive: true });
  fs.writeFileSync(env.storeFile, JSON.stringify(toWrite, null, 2));
}

function load(): StoreShape {
  const loaded = (() => {
    try {
      const raw = fs.readFileSync(env.storeFile, "utf-8");
      return { ...emptyStore(), ...JSON.parse(raw) };
    } catch {
      return emptyStore();
    }
  })();
  // Persisted immediately so a synthesized Page's id is stable across restarts —
  // otherwise a process that never writes for another reason would re-run this
  // backfill on every boot and hand out a different page id each time.
  if (backfillPages(loaded)) writeToDisk(loaded);
  return loaded;
}

let store = load();

function persist(): void {
  writeToDisk(store);
}

export const db = {
  get state(): StoreShape {
    return store;
  },
  save(): void {
    persist();
  },
  reset(): void {
    store = emptyStore();
    persist();
  },
};
