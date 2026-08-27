import { describe, it } from "vitest";
import { runProjectRepositoryContract } from "./project.contract.js";
import { databaseReachable } from "./prisma-available.js";

/**
 * Prisma arm of the ProjectRepository contract.
 *
 * Runs the IDENTICAL assertions as the JSON arm — that is the entire point: parity is
 * demonstrated by both adapters passing one suite, not by two suites that happen to
 * look similar.
 *
 * SKIPS when no database is reachable, and says so. A skipped suite is visibly skipped
 * in the reporter, whereas one that quietly asserted nothing would look like evidence
 * it is not.
 *
 * vitest.setup.ts rewrites DATABASE_URL to a *_test database and refuses to run
 * otherwise, so the destructive reset below cannot reach development data.
 *
 * To run this arm:
 *   1. Provide a dedicated Postgres and a <db>_test database.
 *   2. DATABASE_URL=postgresql://... npm run db:migrate -w backend
 *   3. npm run test -w backend
 */
const reachable = await databaseReachable();

if (reachable) {
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runProjectRepositoryContract(
    "Prisma adapter",
    () => new PrismaProjectRepository(),
    async () => {
      // Only projects need clearing; every other table cascades from it.
      await getPrismaClient().project.deleteMany({});
    }
  );

  // beforeEach clears BEFORE each test, so the final test's rows would otherwise be
  // left behind in a shared database — which then looks like real data to anything
  // else pointed at it (the JSON importer once counted such a row as pre-existing).
  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("ProjectRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
