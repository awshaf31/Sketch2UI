/**
 * One-off, explicit migration: assign every ownerless project to a well-known legacy
 * owner account (Phase D1 authentication).
 *
 * Deliberately NOT run automatically on server boot: the execution plan calls for a
 * "controlled migration" using "a seeded/configured legacy owner", and this script is
 * that control point rather than a silent mutation of real dev data the first time the
 * server happens to start after this change lands.
 *
 * Idempotent: safe to run more than once. Works against either persistence backend —
 * whichever PERSISTENCE_DRIVER / DATABASE_URL currently point at.
 *
 * Usage:
 *   npx tsx apps/api/scripts/backfill-legacy-owner.ts
 */

import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/modules/auth/password.js";
import { LEGACY_OWNER_EMAIL, LEGACY_OWNER_ID } from "../src/modules/auth/legacy-owner.js";
import { db } from "../src/db/jsonStore.js";
import { env } from "../src/config/env.js";

async function backfillJson(): Promise<void> {
  let user = db.state.users.find((u) => u.id === LEGACY_OWNER_ID);
  if (!user) {
    const now = new Date().toISOString();
    user = {
      id: LEGACY_OWNER_ID,
      email: LEGACY_OWNER_EMAIL,
      // Unusable — nobody knows this value, and there is no password-reset flow to
      // recover it. This account exists only to satisfy `ownerId NOT NULL`.
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      role: "user",
      createdAt: now,
      updatedAt: now,
    };
    db.state.users.push(user);
    console.log(`Created legacy owner user ${LEGACY_OWNER_ID} (${LEGACY_OWNER_EMAIL}).`);
  } else {
    console.log("Legacy owner user already exists — skipping creation.");
  }

  let backfilled = 0;
  for (const project of db.state.projects) {
    if (!project.ownerId) {
      project.ownerId = LEGACY_OWNER_ID;
      backfilled++;
    }
  }
  db.save();
  console.log(`Backfilled ownerId on ${backfilled} project(s) (JSON store).`);
}

async function backfillPostgres(): Promise<void> {
  const { getPrismaClient } = await import("../src/repositories/prisma/client.js");
  const prisma = getPrismaClient();

  await prisma.user.upsert({
    where: { id: LEGACY_OWNER_ID },
    update: {},
    create: {
      id: LEGACY_OWNER_ID,
      email: LEGACY_OWNER_EMAIL,
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
    },
  });
  console.log(`Ensured legacy owner user ${LEGACY_OWNER_ID} (${LEGACY_OWNER_EMAIL}) exists.`);

  // No project-row backfill needed here: `projects.ownerId` is a NOT NULL column added
  // by the same migration that introduced it, which Postgres only allows against an
  // empty table (per the schema's own note that no migration has ever run against a
  // live database) — so no Postgres-resident project can exist without an owner
  // already. The importer (db/migrate-json-to-postgres.ts) is what actually needs this
  // legacy user, for projects arriving from the JSON store.
  await prisma.$disconnect();
}

async function main(): Promise<void> {
  if (env.persistenceDriver === "postgres") {
    await backfillPostgres();
  } else {
    await backfillJson();
  }
}

main().catch((err) => {
  console.error("Legacy owner backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
