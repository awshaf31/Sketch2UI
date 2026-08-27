import { beforeEach, describe, expect, it } from "vitest";
import type { AuditLogRepository } from "../types.js";

/**
 * AuditLogRepository CONTRACT — SaaS phase S10 (brief Phase 14).
 *
 * Weighted toward the append-oriented contract itself: `record` never mutates an
 * existing row (there's no method that could), and `listRecent` orders newest-first
 * and respects `limit` — the two properties the admin UI actually depends on.
 */

export function runAuditLogRepositoryContract(
  name: string,
  makeRepository: () => Promise<AuditLogRepository> | AuditLogRepository,
  reset: () => Promise<void> | void
): void {
  describe(`AuditLogRepository contract — ${name}`, () => {
    let repo: AuditLogRepository;

    beforeEach(async () => {
      await reset();
      repo = await makeRepository();
    });

    describe("record", () => {
      it("returns a generated id and ISO createdAt", async () => {
        const entry = await repo.record({ event: "user_registered" });
        expect(entry.id).toMatch(/[0-9a-f-]{36}/);
        expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
      });

      it("defaults userId/targetType/targetId/metadata to null when not given", async () => {
        const entry = await repo.record({ event: "user_login" });
        expect(entry.userId).toBeNull();
        expect(entry.targetType).toBeNull();
        expect(entry.targetId).toBeNull();
        expect(entry.metadata).toBeNull();
      });

      it("round-trips userId, target, and metadata", async () => {
        const entry = await repo.record({
          event: "project_created",
          userId: "user-1",
          targetType: "project",
          targetId: "project-1",
          metadata: { projectName: "Demo" },
        });
        expect(entry.userId).toBe("user-1");
        expect(entry.targetType).toBe("project");
        expect(entry.targetId).toBe("project-1");
        expect(entry.metadata).toEqual({ projectName: "Demo" });
      });
    });

    describe("listRecent", () => {
      it("is empty with no entries", async () => {
        expect(await repo.listRecent(50)).toEqual([]);
      });

      it("returns newest first", async () => {
        const first = await repo.record({ event: "user_registered" });
        await new Promise((r) => setTimeout(r, 5));
        const second = await repo.record({ event: "user_login" });
        const listed = await repo.listRecent(50);
        expect(listed.map((e) => e.id)).toEqual([second.id, first.id]);
      });

      it("respects the limit", async () => {
        await repo.record({ event: "user_registered" });
        await repo.record({ event: "user_login" });
        await repo.record({ event: "user_logout" });
        const listed = await repo.listRecent(2);
        expect(listed).toHaveLength(2);
      });
    });
  });
}
