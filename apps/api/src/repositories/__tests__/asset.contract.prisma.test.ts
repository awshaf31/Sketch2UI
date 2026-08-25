import { describe, it } from "vitest";
import { runAssetRepositoryContract } from "./asset.contract.js";
import { databaseReachable } from "./prisma-available.js";

/**
 * Prisma arm — identical assertions to the JSON arm. Skips (visibly, with a reason)
 * when no database is reachable rather than passing vacuously.
 *
 * vitest.setup.ts rewrites DATABASE_URL to a *_test database and refuses to run
 * otherwise, so the destructive reset below cannot touch development data.
 */
const reachable = await databaseReachable();

if (reachable) {
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runAssetRepositoryContract(
    "Prisma adapter",
    async () => ({
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
      pages: new PrismaPageRepository(),
    }),
    async () => {
      // Assets cascade from projects, so clearing projects is sufficient.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("AssetRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
