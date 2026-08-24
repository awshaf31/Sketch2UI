import { describe, it } from "vitest";
import { runProjectRepositoryContract } from "./project.contract.test.js";

/**
 * Prisma arm of the ProjectRepository contract.
 *
 * Runs the IDENTICAL assertions as the JSON arm — that is the entire point: parity is
 * demonstrated by both adapters passing one suite, not by two suites that happen to
 * look similar.
 *
 * SKIPS when no database is reachable, and says why. It does not silently pass: a
 * skipped suite is visibly skipped in the reporter, whereas a suite that quietly
 * asserted nothing would look like evidence it is not.
 *
 * To run this arm:
 *   1. Provide a dedicated Postgres (see the Phase 8 report — do NOT reuse the
 *      unrelated instance already running on this machine).
 *   2. DATABASE_URL=postgresql://... npm run db:migrate -w apps/api
 *   3. DATABASE_URL=postgresql://... npm run test -w apps/api
 */

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Cheap reachability probe. Deliberately does NOT run migrations or create anything —
 * it only answers "is there a database I am allowed to talk to". Anything else would
 * risk touching a server this project does not own.
 */
async function databaseReachable(): Promise<boolean> {
  if (!DATABASE_URL) return false;
  try {
    const { getPrismaClient } = await import("../prisma/client.js");
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");

  runProjectRepositoryContract(
    "Prisma adapter",
    () => new PrismaProjectRepository(),
    async () => {
      // Only projects need clearing; every other table cascades from it.
      await getPrismaClient().project.deleteMany({});
    }
  );
} else {
  describe("ProjectRepository contract — Prisma adapter", () => {
    it.skip(
      `skipped: no reachable database (DATABASE_URL ${
        DATABASE_URL ? "is set but unreachable" : "is not set"
      })`,
      () => {}
    );
  });
}
