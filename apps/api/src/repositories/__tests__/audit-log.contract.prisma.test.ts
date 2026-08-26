import { describe, it } from "vitest";
import { runAuditLogRepositoryContract } from "./audit-log.contract.js";
import { databaseReachable } from "./prisma-available.js";

const reachable = await databaseReachable();

if (reachable) {
  const { PrismaAuditLogRepository } = await import("../prisma/audit-log.repository.js");
  const { getPrismaClient } = await import("../prisma/client.js");
  const { afterAll } = await import("vitest");

  runAuditLogRepositoryContract(
    "Prisma adapter",
    () => new PrismaAuditLogRepository(),
    async () => {
      await getPrismaClient().auditLog.deleteMany({});
    }
  );

  afterAll(async () => {
    await getPrismaClient().auditLog.deleteMany({});
  });
} else {
  describe("AuditLogRepository contract — Prisma adapter", () => {
    it.skip("skipped: no reachable database (see DATABASE_URL)", () => {});
  });
}
