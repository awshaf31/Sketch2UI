import { describe, it } from "vitest";
import { runGeometryOverrideRepositoryContract } from "./geometry-override.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaGeometryOverrideRepository } = await import("../prisma/geometry-override.repository.js");
  const { PrismaDetectionRepository } = await import("../prisma/detection.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runGeometryOverrideRepositoryContract(
    "Prisma adapter",
    async () => ({
      geometryOverrides: new PrismaGeometryOverrideRepository(),
      detections: new PrismaDetectionRepository(),
      assets: new PrismaAssetRepository(),
      projects: new PrismaProjectRepository(),
    }),
    async () => {
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("GeometryOverrideRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
