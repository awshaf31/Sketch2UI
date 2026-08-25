import { describe, it } from "vitest";
import { runExportRepositoryContract } from "./export.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaExportRepository } = await import("../prisma/export.repository.js");
  const { PrismaCodeVersionRepository } = await import("../prisma/code-version.repository.js");
  const { PrismaProjectRepository } = await import("../prisma/project.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runExportRepositoryContract(
    "Prisma adapter",
    async () => ({
      exports: new PrismaExportRepository(),
      codeVersions: new PrismaCodeVersionRepository(),
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
  describe("ExportRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
