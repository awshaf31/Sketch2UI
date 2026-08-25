import { describe, it } from "vitest";
import { runUserRepositoryContract } from "./user.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaUserRepository } = await import("../prisma/user.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runUserRepositoryContract(
    "Prisma adapter",
    () => new PrismaUserRepository(),
    async () => {
      // Cascades to sessions and (via Project.owner) is safe because no project rows
      // exist in this suite's isolated reset.
      await getPrismaClient().user.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().user.deleteMany({});
  });
} else {
  describe("UserRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
