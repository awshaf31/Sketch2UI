import { describe, it } from "vitest";
import { runContentOverrideRepositoryContract } from "./content-override.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaContentOverrideRepository } = await import("../prisma/content-override.repository.js");
  const { PrismaDetectionRepository } = await import("../prisma/detection.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runContentOverrideRepositoryContract(
    "Prisma adapter",
    async () => ({
      contentOverrides: new PrismaContentOverrideRepository(),
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
  describe("ContentOverrideRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
