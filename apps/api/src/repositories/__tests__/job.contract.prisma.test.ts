import { describe, it } from "vitest";
import { runJobRepositoryContract } from "./job.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaJobRepository } = await import("../prisma/job.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { PrismaAssetRepository } = await import("../prisma/asset.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runJobRepositoryContract(
    "Prisma adapter",
    async () => ({
      jobs: new PrismaJobRepository(),
      projects: new PrismaProjectRepository(),
      assets: new PrismaAssetRepository(),
    }),
    async () => {
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("JobRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
