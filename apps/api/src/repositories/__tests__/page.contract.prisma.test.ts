import { describe, it } from "vitest";
import { runPageRepositoryContract } from "./page.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaPageRepository } = await import("../prisma/page.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runPageRepositoryContract(
    "Prisma adapter",
    async () => ({
      pages: new PrismaPageRepository(),
      projects: new PrismaProjectRepository(),
    }),
    async () => {
      // Pages cascade from projects, so clearing projects is sufficient.
      await getPrismaClient().project.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().project.deleteMany({});
  });
} else {
  describe("PageRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
