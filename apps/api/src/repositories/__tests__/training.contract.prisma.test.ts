import { describe, it } from "vitest";
import { runTrainingRepositoryContract } from "./training.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaTrainingRepository } = await import("../prisma/training.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runTrainingRepositoryContract(
    "Prisma adapter",
    async () => ({
      training: new PrismaTrainingRepository(),
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
  describe("TrainingRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
