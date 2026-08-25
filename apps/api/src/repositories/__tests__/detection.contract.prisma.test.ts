import { describe, it } from "vitest";
import { runDetectionRepositoryContract } from "./detection.contract.js";
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
  const { PrismaDetectionRepository } = await import("../prisma/detection.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runDetectionRepositoryContract(
    "Prisma adapter",
    async () => ({
      detections: new PrismaDetectionRepository(),
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
      pages: new PrismaPageRepository(),
    }),
    async () => {
      // Detections and assets cascade from projects.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("DetectionRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
