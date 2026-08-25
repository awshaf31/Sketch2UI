import { beforeEach, describe, expect, it } from "vitest";
import type { SessionRepository, UserRepository } from "../types.js";

/**
 * SessionRepository CONTRACT — Phase D1 authentication.
 *
 * Sessions need a parent user to exist (Postgres enforces the FK, JSON does not), so
 * the harness is given a UserRepository to create one — same shape as
 * asset.contract.ts's dependency on ProjectRepository.
 */

export function runSessionRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{ sessions: SessionRepository; users: UserRepository }>,
  reset: () => Promise<void> | void
): void {
  describe(`SessionRepository contract — ${name}`, () => {
    let sessions: SessionRepository;
    let users: UserRepository;
    let userId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      sessions = repos.sessions;
      users = repos.users;
      userId = (await users.create({ email: "owner@example.com", passwordHash: "hash" })).id;
    });

    describe("create / findByTokenHash", () => {
      it("finds a session by its token hash after creating it", async () => {
        const expiresAt = new Date(Date.now() + 60_000);
        await sessions.create({ userId, tokenHash: "hash-1", expiresAt });
        const found = await sessions.findByTokenHash("hash-1");
        expect(found?.userId).toBe(userId);
        expect(found?.tokenHash).toBe("hash-1");
      });

      it("returns null for a token hash that does not exist", async () => {
        expect(await sessions.findByTokenHash("no-such-hash")).toBeNull();
      });

      it("stores expiresAt so it round-trips as a parseable timestamp", async () => {
        const expiresAt = new Date(Date.now() + 60_000);
        await sessions.create({ userId, tokenHash: "hash-2", expiresAt });
        const found = await sessions.findByTokenHash("hash-2");
        expect(Number.isNaN(Date.parse(found!.expiresAt))).toBe(false);
      });
    });

    describe("deleteByTokenHash", () => {
      it("removes the session — a deleted session is unfindable", async () => {
        await sessions.create({ userId, tokenHash: "hash-3", expiresAt: new Date(Date.now() + 60_000) });
        await sessions.deleteByTokenHash("hash-3");
        expect(await sessions.findByTokenHash("hash-3")).toBeNull();
      });

      it("is a silent no-op for a token hash that does not exist", async () => {
        await expect(sessions.deleteByTokenHash("never-existed")).resolves.toBeUndefined();
      });
    });
  });
}
