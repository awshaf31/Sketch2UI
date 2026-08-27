import { describe, it } from "vitest";
import { runStructureOverrideRepositoryContract } from "./structure-override.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaStructureOverrideRepository } = await import("../prisma/structure-override.repository.js");
  const { PrismaDetectionRepository } = await import("../prisma/detection.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runStructureOverrideRepositoryContract(
    "Prisma adapter",
    async () => ({
      structureOverrides: new PrismaStructureOverrideRepository(),
      detections: new PrismaDetectionRepository(),
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
      pages: new PrismaPageRepository(),
    }),
    async () => {
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("StructureOverrideRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
