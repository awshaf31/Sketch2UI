import { describe, it } from "vitest";
import { runSessionRepositoryContract } from "./session.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaSessionRepository } = await import("../prisma/session.repository.js");
  const { PrismaUserRepository } = await import("../prisma/user.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runSessionRepositoryContract(
    "Prisma adapter",
    async () => ({
      sessions: new PrismaSessionRepository(),
      users: new PrismaUserRepository(),
    }),
    async () => {
      // Sessions cascade from users, so clearing users is sufficient.
      await getPrismaClient().user.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().user.deleteMany({});
  });
} else {
  describe("SessionRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
