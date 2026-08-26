/**
 * One-off, explicit admin-role grant (SaaS phase S6 / brief Phase 9: "Do not give
 * admin arbitrary password access" — role changes are a controlled operation, not a
 * self-service upgrade or an automatic mutation). Idempotent: promoting an
 * already-admin user is a no-op.
 *
 * Goes through the repository layer (UserRepository.setRole(), added phase S7) rather
 * than branching on PERSISTENCE_DRIVER itself the way backfill-legacy-owner.ts does —
 * that script predates setRole() existing; this one didn't need to duplicate that
 * pattern once the repository method was there.
 *
 * Usage:
 *   npx tsx apps/api/scripts/promote-admin.ts someone@example.com
 */

import os from "node:os";
import { env } from "../src/config/env.js";
import { getRepositories } from "../src/repositories/index.js";
import { disconnectPrisma } from "../src/repositories/prisma/client.js";

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx apps/api/scripts/promote-admin.ts <email>");
    process.exit(1);
  }

  const repos = getRepositories();
  const user = await repos.users.findByEmail(email.trim().toLowerCase());
  if (!user) {
    throw new Error(`No user found with email "${email}".`);
  }
  if (user.role !== "admin") {
    await repos.users.setRole(user.id, "admin");
    // userId is the PROMOTED user (the audit subject), not an actor id — there is no
    // authenticated caller for a CLI script. os.userInfo() records who ran it, best
    // effort, for the same reason: this is a controlled, operator-run action, and
    // "which operator" is exactly the non-sensitive context worth keeping.
    await repos.auditLogs.record({
      event: "admin_role_changed",
      userId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: { newRole: "admin", ranBy: os.userInfo().username },
    });
    console.log(`${email} is now an admin.`);
  } else {
    console.log(`${email} is already an admin — nothing to do.`);
  }

  // Postgres's connection pool otherwise keeps the process alive after main()
  // resolves; the JSON adapter never touches Prisma at all, so this is a no-op there.
  if (env.persistenceDriver === "postgres") {
    await disconnectPrisma();
  }
}

main().catch((err) => {
  console.error("Admin promotion failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
