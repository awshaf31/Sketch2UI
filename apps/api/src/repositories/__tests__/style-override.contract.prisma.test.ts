import { describe, it } from "vitest";
import { runStyleOverrideRepositoryContract } from "./style-override.contract.js";
import { databaseReachable } from "./prisma-available.js";

/**
 * Prisma arm — identical assertions to the JSON arm. Skips (visibly, with a reason)
 * when no database is reachable rather than passing vacuously.
 */
const reachable = await databaseReachable();

if (reachable) {
  const { PrismaStyleOverrideRepository } = await import("../prisma/style-override.repository.js");
  const { PrismaDetectionRepository } = await import("../prisma/detection.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runStyleOverrideRepositoryContract(
    "Prisma adapter",
    async () => ({
      styleOverrides: new PrismaStyleOverrideRepository(),
      detections: new PrismaDetectionRepository(),
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
      pages: new PrismaPageRepository(),
    }),
    async () => {
      // Style overrides cascade from projects, so clearing projects is sufficient.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("StyleOverrideRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
