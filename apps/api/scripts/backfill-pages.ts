/**
 * One-off, explicit migration: give every page-less project a "Page 1" (Phase D3
 * minimum-viable multi-page).
 *
 * The JSON store backfills this automatically on every load (db/jsonStore.ts's
 * backfillPages) because a page is structurally required for the app to function at
 * all. This script is the Postgres-side equivalent, run by hand — there is no
 * live Postgres data in this environment to require it automatically, matching the
 * same reasoning as backfill-legacy-owner.ts.
 *
 * Every page-owned child table (ProjectAsset, Detection, CodeVersion,
 * PageBoundaryRecord, CorrectionRecord, the four override tables) has `pageId` as a
 * NOT NULL column added by the same migration that introduced it, so a Postgres
 * project with any of those rows already has a page — this script only needs to
 * handle a project with zero pages and (necessarily) zero child rows.
 *
 * Idempotent: safe to run more than once.
 *
 * Usage:
 *   npx tsx apps/api/scripts/backfill-pages.ts
 */

import { env } from "../src/config/env.js";

async function backfillPostgres(): Promise<void> {
  const { getPrismaClient } = await import("../src/repositories/prisma/client.js");
  const prisma = getPrismaClient();

  const projects = await prisma.project.findMany({ select: { id: true } });
  let created = 0;
  for (const project of projects) {
    const existing = await prisma.page.count({ where: { projectId: project.id } });
    if (existing > 0) continue;
    await prisma.page.create({ data: { projectId: project.id, name: "Page 1", order: 1 } });
    created++;
  }
  console.log(`Created "Page 1" for ${created} page-less project(s) (Postgres).`);
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  if (env.persistenceDriver !== "postgres") {
    console.log(
      "PERSISTENCE_DRIVER is not \"postgres\" — nothing to do here. The JSON store " +
        "backfills pages automatically on every load (see db/jsonStore.ts)."
    );
    return;
  }
  await backfillPostgres();
}

main().catch((err) => {
  console.error("Page backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
