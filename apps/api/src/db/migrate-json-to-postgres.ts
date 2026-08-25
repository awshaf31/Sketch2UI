/**
 * One-way data migration: JSON store -> PostgreSQL (execution plan Phase 8, Appendix E
 * stages 5-6).
 *
 * Two modes:
 *
 *   --dry-run   Parse apps/api/data/store.json, map every record onto its Prisma shape,
 *               and report what WOULD be written — including referential problems that
 *               Postgres will reject. Touches no database at all, so it is safe to run
 *               anywhere and is the only verification possible without a live server.
 *
 *   (default)   Actually write, inside a single transaction, in foreign-key-safe order.
 *               Aborts wholesale if anything fails — a half-migrated database is worse
 *               than an unmigrated one.
 *
 * WHY A DRY RUN MATTERS HERE: the JSON store has no foreign keys, so nothing has ever
 * stopped it accumulating dangling references (a detection whose asset was deleted, an
 * export naming a code version that no longer exists). Every one of those becomes an FK
 * violation on insert. Finding them before touching Postgres is the entire point of
 * Appendix E's "validate -> transform -> transaction" ordering.
 *
 * Usage:
 *   npm run db:migrate-json -w apps/api -- --dry-run
 *   npm run db:migrate-json -w apps/api
 */

import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
// Type-only: fully erased at compile time, so --dry-run still never loads the client.
import type { Prisma } from "@prisma/client";
import { hashPassword } from "../modules/auth/password.js";
import { LEGACY_OWNER_EMAIL, LEGACY_OWNER_ID } from "../modules/auth/legacy-owner.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load the repo-root .env.
 *
 * The Prisma CLI auto-loads .env; Prisma CLIENT does not — it reads `process.env`
 * directly. So `prisma migrate deploy` worked while this script failed with
 * "Environment variable not found: DATABASE_URL", despite both nominally using the
 * same configuration. Loading it here removes that asymmetry.
 *
 * Existing environment wins, so `DATABASE_URL=... npm run db:migrate-json` still
 * overrides the file.
 */
function loadRootEnv(): void {
  const envPath = path.resolve(__dirname, "../../../../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}
loadRootEnv();

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");

/**
 * `--store <path>` overrides the source file. Two real uses: validating a backup before
 * restoring it, and exercising the validator against a deliberately-broken fixture —
 * a pre-flight check that can only ever report success is not a check.
 */
const storeArgIndex = argv.indexOf("--store");
const STORE_FILE =
  storeArgIndex >= 0 && argv[storeArgIndex + 1]
    ? path.resolve(argv[storeArgIndex + 1])
    : path.resolve(__dirname, "../../data/store.json");

// The store's shape is intentionally read as loosely-typed JSON rather than imported
// from shared-types: this script must be able to read an OLD store written before a
// field existed, which the current strict types would reject.
type Row = Record<string, any>;

interface Store {
  projects: Row[];
  assets: Row[];
  detections: Row[];
  codeVersions: Row[];
  jobs: Row[];
  trainingSamples: Row[];
  exports: Row[];
  pageBoundaries: Row[];
  correctionRecords: Row[];
}

function loadStore(): Store {
  if (!fs.existsSync(STORE_FILE)) {
    console.error(`No store at ${STORE_FILE}. Nothing to migrate.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
  return {
    projects: raw.projects ?? [],
    assets: raw.assets ?? [],
    detections: raw.detections ?? [],
    codeVersions: raw.codeVersions ?? [],
    jobs: raw.jobs ?? [],
    trainingSamples: raw.trainingSamples ?? [],
    exports: raw.exports ?? [],
    pageBoundaries: raw.pageBoundaries ?? [],
    correctionRecords: raw.correctionRecords ?? [],
  };
}

/**
 * Backfill `source` for code versions written before the field existed.
 *
 * "generated" is not a guess. `source` was introduced together with hand-editing
 * (code-versions.routes.ts: a hand-edit appends a NEW version with source "edited").
 * Before that feature shipped, generation was the only code path that could create a
 * version at all — so every row predating the field is necessarily generated.
 *
 * Found in the real store: 4 of 7 code versions are in this state.
 */
function legacyCodeVersionSource(value: unknown): "generated" | "edited" {
  return value === "edited" ? "edited" : "generated";
}

/** "user-edited" is legal in TS but not as a Postgres enum member. */
function toContentState(value: unknown): "known" | "unknown" | "user_edited" {
  if (value === "known" || value === "unknown") return value;
  return "user_edited";
}

function toDate(value: unknown): Date {
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

interface Problem {
  kind: "dangling" | "malformed";
  table: string;
  id: string;
  detail: string;
}

/**
 * Referential + shape validation. Everything reported here would be a hard failure on
 * insert, so the dry run is a genuine pre-flight rather than a summary.
 */
function validate(store: Store): Problem[] {
  const problems: Problem[] = [];
  const projectIds = new Set(store.projects.map((p) => p.id));
  const assetIds = new Set(store.assets.map((a) => a.id));
  const detectionIds = new Set(store.detections.map((d) => d.id));
  const codeVersionIds = new Set(store.codeVersions.map((c) => c.id));

  const need = (
    ok: boolean,
    table: string,
    id: string,
    detail: string,
    kind: Problem["kind"] = "dangling"
  ) => {
    if (!ok) problems.push({ kind, table, id, detail });
  };

  for (const a of store.assets) {
    need(projectIds.has(a.projectId), "project_assets", a.id, `projectId ${a.projectId} not found`);
  }
  for (const d of store.detections) {
    need(projectIds.has(d.projectId), "detections", d.id, `projectId ${d.projectId} not found`);
    need(assetIds.has(d.sourceAssetId), "detections", d.id, `sourceAssetId ${d.sourceAssetId} not found`);
    const b = d.bbox ?? {};
    need(
      ["x", "y", "width", "height"].every((k) => Number.isFinite(b[k])),
      "detections",
      d.id,
      `bbox is not four finite numbers: ${JSON.stringify(b)}`,
      "malformed"
    );
  }
  for (const c of store.codeVersions) {
    need(projectIds.has(c.projectId), "code_versions", c.id, `projectId ${c.projectId} not found`);
  }
  for (const j of store.jobs) {
    need(projectIds.has(j.projectId), "jobs", j.id, `projectId ${j.projectId} not found`);
    if (j.sourceAssetId != null) {
      need(assetIds.has(j.sourceAssetId), "jobs", j.id, `sourceAssetId ${j.sourceAssetId} not found`);
    }
  }
  for (const t of store.trainingSamples) {
    need(projectIds.has(t.projectId), "training_samples", t.id, `projectId ${t.projectId} not found`);
    need(assetIds.has(t.imageAssetId), "training_samples", t.id, `imageAssetId ${t.imageAssetId} not found`);
  }
  for (const e of store.exports) {
    need(projectIds.has(e.projectId), "project_exports", e.id, `projectId ${e.projectId} not found`);
    need(codeVersionIds.has(e.codeVersionId), "project_exports", e.id, `codeVersionId ${e.codeVersionId} not found`);
  }
  for (const b of store.pageBoundaries) {
    need(projectIds.has(b.projectId), "page_boundaries", b.id, `projectId ${b.projectId} not found`);
    need(assetIds.has(b.assetId), "page_boundaries", b.id, `assetId ${b.assetId} not found`);
  }
  for (const r of store.correctionRecords) {
    need(projectIds.has(r.projectId), "correction_records", r.id, `projectId ${r.projectId} not found`);
    need(detectionIds.has(r.detectionId), "correction_records", r.id, `detectionId ${r.detectionId} not found`);
  }

  // Override maps live on the project but are keyed by detection id — the exact
  // relationship the schema turns into a foreign key, and therefore the exact place a
  // stale key becomes an insert failure.
  for (const p of store.projects) {
    for (const [group, map] of [
      ["style_overrides", p.styleOverrides],
      ["content_overrides", p.contentOverrides],
      ["geometry_overrides", p.geometryOverrides],
      ["structure_overrides", p.structureOverrides],
    ] as const) {
      for (const detectionId of Object.keys(map ?? {})) {
        need(detectionIds.has(detectionId), group, `${p.id}:${detectionId}`, `detectionId ${detectionId} not found`);
      }
    }
    for (const [detectionId, ov] of Object.entries((p.structureOverrides ?? {}) as Record<string, Row>)) {
      if (typeof ov?.parentDetectionId === "string") {
        need(
          detectionIds.has(ov.parentDetectionId),
          "structure_overrides",
          `${p.id}:${detectionId}`,
          `parentDetectionId ${ov.parentDetectionId} not found`
        );
      }
    }
  }

  // Required-field presence.
  //
  // The JSON store is schemaless, so rows written before a field existed simply lack
  // it — and Postgres will reject them as NOT NULL violations. Found in the real store:
  // 4 of 7 code versions predate `source`, which was added with the hand-edit feature.
  // Referential checks alone never see this class of problem, which is why it is
  // checked separately rather than folded into the FK pass.
  const REQUIRED: Array<[string, Row[], string[]]> = [
    ["project_assets", store.assets, ["projectId", "storageKey", "mimeType", "width", "height", "fileSize"]],
    ["detections", store.detections, ["projectId", "sourceAssetId", "className", "confidence", "status", "source"]],
    ["code_versions", store.codeVersions, ["projectId", "versionNumber", "html", "css"]],
    ["jobs", store.jobs, ["projectId", "type", "status", "stage"]],
    ["training_samples", store.trainingSamples, ["projectId", "imageAssetId", "storageKey", "approved", "approvedAt", "datasetSplit", "imageWidth", "imageHeight"]],
    ["project_exports", store.exports, ["projectId", "codeVersionId", "versionNumber", "storagePath", "fileSize"]],
    ["page_boundaries", store.pageBoundaries, ["projectId", "assetId", "polygon", "confidence", "method", "areaFraction", "applied", "source"]],
  ];
  for (const [table, rows, fields] of REQUIRED) {
    for (const row of rows) {
      const missing = fields.filter((f) => row[f] === undefined || row[f] === null);
      if (missing.length > 0) {
        problems.push({
          kind: "malformed",
          table,
          id: String(row.id ?? "(no id)"),
          detail: `missing required field(s): ${missing.join(", ")}`,
        });
      }
    }
  }

  // `code_versions.source` is handled as a BACKFILL rather than an error — see
  // legacyCodeVersionSource(). Reported for visibility, not as a blocker.
  const legacySourceCount = store.codeVersions.filter((c) => c.source === undefined).length;
  if (legacySourceCount > 0) {
    console.log(
      `\nNote: ${legacySourceCount} code version(s) predate the \`source\` field and will be ` +
        'backfilled as "generated" — see legacyCodeVersionSource() for why that is correct.\n'
    );
  }

  // Uniqueness the JSON store never enforced but the schema now does.
  const seenVersion = new Set<string>();
  for (const c of store.codeVersions) {
    const key = `${c.projectId}#${c.versionNumber}`;
    need(!seenVersion.has(key), "code_versions", c.id, `duplicate (projectId, versionNumber) ${key}`, "malformed");
    seenVersion.add(key);
  }
  const seenExport = new Set<string>();
  for (const e of store.exports) {
    const key = `${e.projectId}#${e.versionNumber}`;
    need(!seenExport.has(key), "project_exports", e.id, `duplicate (projectId, versionNumber) ${key}`, "malformed");
    seenExport.add(key);
  }
  const seenSample = new Set<string>();
  for (const t of store.trainingSamples) {
    need(!seenSample.has(t.imageAssetId), "training_samples", t.id, `duplicate imageAssetId ${t.imageAssetId}`, "malformed");
    seenSample.add(t.imageAssetId);
  }
  const seenBoundary = new Set<string>();
  for (const b of store.pageBoundaries) {
    need(!seenBoundary.has(b.assetId), "page_boundaries", b.id, `duplicate assetId ${b.assetId}`, "malformed");
    seenBoundary.add(b.assetId);
  }

  return problems;
}

/** Row counts the migration will insert, in FK-safe order. */
function plan(store: Store): Array<[string, number]> {
  const countOverrides = (field: string) =>
    store.projects.reduce((n, p) => n + Object.keys(p[field] ?? {}).length, 0);

  return [
    ["projects", store.projects.length],
    ["pages", store.projects.length], // Phase D3: one synthesized "Page 1" per project.
    ["project_assets", store.assets.length],
    ["detections", store.detections.length],
    ["code_versions", store.codeVersions.length],
    ["jobs", store.jobs.length],
    ["training_samples", store.trainingSamples.length],
    ["project_exports", store.exports.length],
    ["page_boundaries", store.pageBoundaries.length],
    ["correction_records", store.correctionRecords.length],
    ["style_overrides", countOverrides("styleOverrides")],
    ["content_overrides", countOverrides("contentOverrides")],
    ["geometry_overrides", countOverrides("geometryOverrides")],
    ["structure_overrides", countOverrides("structureOverrides")],
  ];
}

async function migrate(store: Store): Promise<void> {
  // Imported lazily so --dry-run never needs a generated client or a reachable database.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const overrideRows = <T>(field: string, map: (detectionId: string, value: Row, projectId: string) => T): T[] =>
    store.projects.flatMap((p) =>
      Object.entries((p[field] ?? {}) as Record<string, Row>).map(([detectionId, value]) =>
        map(detectionId, value, p.id)
      )
    );

  try {
    // One transaction: Appendix E stage 5. A partial migration is worse than none,
    // because the "is this database populated?" question stops having a clear answer.
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Projects from the JSON store predate ownership (Phase D1) and carry no
      // ownerId, so every one of them is assigned to a well-known legacy account
      // rather than left ownerless — see modules/auth/legacy-owner.ts.
      await tx.user.upsert({
        where: { id: LEGACY_OWNER_ID },
        update: {},
        create: {
          id: LEGACY_OWNER_ID,
          email: LEGACY_OWNER_EMAIL,
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        },
      });

      await tx.project.createMany({
        data: store.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          status: p.status ?? "draft",
          ownerId: p.ownerId ?? LEGACY_OWNER_ID,
          activeCodeVersionId: p.activeCodeVersionId ?? null,
          createdAt: toDate(p.createdAt),
          updatedAt: toDate(p.updatedAt),
        })),
      });

      // Phase D3: the JSON store predates pages entirely — every project's existing
      // data becomes "Page 1", exactly matching the JSON store's own automatic
      // backfill (db/jsonStore.ts's backfillPages). One deterministic id per project
      // so every child row's pageId below can look it up.
      const pageIdByProject = new Map<string, string>(store.projects.map((p) => [p.id, randomUUID()]));
      await tx.page.createMany({
        data: store.projects.map((p) => ({
          id: pageIdByProject.get(p.id)!,
          projectId: p.id,
          name: "Page 1",
          order: 1,
          activeCodeVersionId: p.activeCodeVersionId ?? null,
          createdAt: toDate(p.createdAt),
          updatedAt: toDate(p.updatedAt),
        })),
      });

      await tx.projectAsset.createMany({
        data: store.assets.map((a) => ({
          id: a.id,
          projectId: a.projectId,
          pageId: pageIdByProject.get(a.projectId)!,
          storageKey: a.storageKey,
          mimeType: a.mimeType,
          width: a.width,
          height: a.height,
          fileSize: a.fileSize,
          createdAt: toDate(a.createdAt),
        })),
      });

      await tx.detection.createMany({
        data: store.detections.map((d) => ({
          id: d.id,
          projectId: d.projectId,
          pageId: pageIdByProject.get(d.projectId)!,
          sourceAssetId: d.sourceAssetId,
          className: d.className,
          confidence: d.confidence,
          bboxX: d.bbox.x,
          bboxY: d.bbox.y,
          bboxWidth: d.bbox.width,
          bboxHeight: d.bbox.height,
          status: d.status ?? "active",
          source: d.source,
          modelVersionId: d.modelVersionId ?? null,
          originalClassName: d.originalClassName ?? null,
          createdAt: toDate(d.createdAt),
          updatedAt: toDate(d.updatedAt),
        })),
      });

      await tx.codeVersion.createMany({
        data: store.codeVersions.map((c) => ({
          id: c.id,
          projectId: c.projectId,
          pageId: pageIdByProject.get(c.projectId)!,
          versionNumber: c.versionNumber,
          source: legacyCodeVersionSource(c.source),
          html: c.html,
          css: c.css,
          javascript: c.javascript ?? null,
          metadata: c.metadata ?? undefined,
          createdAt: toDate(c.createdAt),
        })),
      });

      await tx.job.createMany({
        data: store.jobs.map((j) => ({
          id: j.id,
          projectId: j.projectId,
          type: j.type,
          status: j.status,
          stage: j.stage,
          progress: j.progress ?? 0,
          sourceAssetId: j.sourceAssetId ?? null,
          errorCode: j.errorCode ?? null,
          errorMessage: j.errorMessage ?? null,
          retryable: j.retryable ?? null,
          detectionCount: j.detectionCount ?? null,
          modelVersionId: j.modelVersionId ?? null,
          pageBoundary: j.pageBoundary ?? undefined,
          rejectedCount: j.rejectedCount ?? null,
          createdAt: toDate(j.createdAt),
          updatedAt: toDate(j.updatedAt),
        })),
      });

      await tx.trainingSample.createMany({
        data: store.trainingSamples.map((t) => ({
          id: t.id,
          projectId: t.projectId,
          imageAssetId: t.imageAssetId,
          storageKey: t.storageKey,
          approved: t.approved,
          approvedAt: toDate(t.approvedAt),
          datasetSplit: t.datasetSplit,
          boxes: t.boxes ?? [],
          imageWidth: t.imageWidth,
          imageHeight: t.imageHeight,
          createdAt: toDate(t.createdAt),
        })),
      });

      await tx.projectExport.createMany({
        data: store.exports.map((e) => ({
          id: e.id,
          projectId: e.projectId,
          codeVersionId: e.codeVersionId,
          versionNumber: e.versionNumber,
          storagePath: e.storagePath,
          fileSize: e.fileSize,
          createdAt: toDate(e.createdAt),
        })),
      });

      await tx.pageBoundaryRecord.createMany({
        data: store.pageBoundaries.map((b) => ({
          id: b.id,
          projectId: b.projectId,
          pageId: pageIdByProject.get(b.projectId)!,
          assetId: b.assetId,
          polygon: b.polygon,
          confidence: b.confidence,
          method: b.method,
          areaFraction: b.areaFraction,
          applied: b.applied,
          overlapThreshold: b.overlapThreshold ?? null,
          source: b.source,
          createdAt: toDate(b.createdAt),
          updatedAt: toDate(b.updatedAt),
        })),
      });

      await tx.correctionRecord.createMany({
        data: store.correctionRecords.map((r) => ({
          id: r.id,
          projectId: r.projectId,
          pageId: pageIdByProject.get(r.projectId)!,
          detectionId: r.detectionId,
          type: r.type,
          source: r.source ?? "user",
          timestamp: toDate(r.timestamp),
          reason: r.reason ?? null,
          oldClassName: r.oldClassName ?? null,
          newClassName: r.newClassName ?? null,
          oldBBoxX: r.oldBBox?.x ?? null,
          oldBBoxY: r.oldBBox?.y ?? null,
          oldBBoxWidth: r.oldBBox?.width ?? null,
          oldBBoxHeight: r.oldBBox?.height ?? null,
          newBBoxX: r.newBBox?.x ?? null,
          newBBoxY: r.newBBox?.y ?? null,
          newBBoxWidth: r.newBBox?.width ?? null,
          newBBoxHeight: r.newBBox?.height ?? null,
          oldParentDetectionId: r.oldParentDetectionId ?? null,
          oldParentDetectionIdSet: "oldParentDetectionId" in r,
          newParentDetectionId: r.newParentDetectionId ?? null,
          newParentDetectionIdSet: "newParentDetectionId" in r,
          oldDisplayOrder: r.oldDisplayOrder ?? null,
          newDisplayOrder: r.newDisplayOrder ?? null,
        })),
      });

      await tx.styleOverride.createMany({
        data: overrideRows("styleOverrides", (detectionId, style, projectId) => ({
          projectId,
          pageId: pageIdByProject.get(projectId)!,
          detectionId,
          style,
        })),
      });

      await tx.contentOverride.createMany({
        data: overrideRows("contentOverrides", (detectionId, ov, projectId) => ({
          projectId,
          pageId: pageIdByProject.get(projectId)!,
          detectionId,
          text: ov.text ?? null,
          altText: ov.altText ?? null,
          href: ov.href ?? null,
          contentState: toContentState(ov.contentState),
        })),
      });

      await tx.geometryOverride.createMany({
        data: overrideRows("geometryOverrides", (detectionId, ov, projectId) => ({
          projectId,
          pageId: pageIdByProject.get(projectId)!,
          detectionId,
          x: ov.x ?? null,
          y: ov.y ?? null,
          width: ov.width ?? null,
          height: ov.height ?? null,
        })),
      });

      await tx.structureOverride.createMany({
        data: overrideRows("structureOverrides", (detectionId, ov, projectId) => ({
          projectId,
          pageId: pageIdByProject.get(projectId)!,
          detectionId,
          parentDetectionId: ov.parentDetectionId ?? null,
          parentDetectionIdSet: "parentDetectionId" in ov,
          displayOrder: ov.displayOrder ?? null,
        })),
      });
    });

    console.log("\nMigration committed.");
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const store = loadStore();
  const problems = validate(store);
  const rows = plan(store);
  const total = rows.reduce((n, [, c]) => n + c, 0);

  console.log(DRY_RUN ? "JSON -> Postgres migration (DRY RUN)\n" : "JSON -> Postgres migration\n");
  console.log(`Source: ${STORE_FILE}\n`);
  console.log("─── Rows to insert (foreign-key-safe order) ───\n");
  for (const [table, count] of rows) {
    console.log(`  ${table.padEnd(22)} ${String(count).padStart(5)}`);
  }
  console.log(`  ${"TOTAL".padEnd(22)} ${String(total).padStart(5)}\n`);

  if (problems.length > 0) {
    const dangling = problems.filter((p) => p.kind === "dangling").length;
    const malformed = problems.filter((p) => p.kind === "malformed").length;
    console.log(`─── ${problems.length} problem(s): ${dangling} dangling reference(s), ${malformed} malformed ───\n`);
    for (const p of problems.slice(0, 40)) {
      console.log(`  [${p.kind}] ${p.table} ${p.id}`);
      console.log(`      ${p.detail}`);
    }
    if (problems.length > 40) console.log(`  … and ${problems.length - 40} more`);
    console.log(
      "\n  Every one of these violates a constraint the schema now enforces and would"
    );
    console.log("  abort the transaction. Fix the source data before migrating.\n");
    if (!DRY_RUN) process.exit(1);
  } else {
    console.log("─── Referential integrity: OK ───\n");
    console.log("  No dangling references, no malformed geometry, no uniqueness conflicts.\n");
  }

  if (DRY_RUN) {
    console.log("(dry run — no database connection was opened)\n");
    return;
  }

  await migrate(store);
}

main().catch((err) => {
  console.error("\nMigration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
