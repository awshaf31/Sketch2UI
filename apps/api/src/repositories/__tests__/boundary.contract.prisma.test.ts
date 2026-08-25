import { describe, it } from "vitest";
import { runBoundaryRepositoryContract } from "./boundary.contract.js";
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
  const { PrismaBoundaryRepository } = await import("../prisma/boundary.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runBoundaryRepositoryContract(
    "Prisma adapter",
    async () => ({
      boundaries: new PrismaBoundaryRepository(),
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
    }),
    async () => {
      // Boundaries cascade from projects, so clearing projects is sufficient.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("BoundaryRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
