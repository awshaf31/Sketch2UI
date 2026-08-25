import { describe, it } from "vitest";
import { runCodeVersionRepositoryContract } from "./code-version.contract.js";
import { databaseReachable } from "./prisma-available.js";

/**
 * Prisma arm — identical assertions to the JSON arm. Skips (visibly, with a reason)
 * when no database is reachable rather than passing vacuously.
 *
 * vitest.setup.ts points DATABASE_URL at a *_test database and refuses to run
 * otherwise, so the destructive reset below cannot touch development data.
 */
const reachable = await databaseReachable();

if (reachable) {
  const { PrismaCodeVersionRepository } = await import("../prisma/code-version.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runCodeVersionRepositoryContract(
    "Prisma adapter",
    async () => ({
      codeVersions: new PrismaCodeVersionRepository(),
      projects: new PrismaProjectRepository(),
    }),
    async () => {
      // Code versions cascade from projects, so clearing projects is sufficient.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("CodeVersionRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
