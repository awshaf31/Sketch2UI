import { beforeEach, describe, expect, it } from "vitest";
import type { UserRepository } from "../types.js";

/**
 * UserRepository CONTRACT — Phase D1 authentication.
 *
 * Written against the INTERFACE, following the same pattern as every other domain's
 * contract (project.contract.ts etc.): both adapters run these exact assertions.
 */

export function runUserRepositoryContract(
  name: string,
  makeRepository: () => Promise<UserRepository> | UserRepository,
  reset: () => Promise<void> | void
): void {
  describe(`UserRepository contract — ${name}`, () => {
    let repo: UserRepository;

    beforeEach(async () => {
      await reset();
      repo = await makeRepository();
    });

    describe("create", () => {
      it("returns a user with a generated id and default role", async () => {
        const user = await repo.create({ email: "a@example.com", passwordHash: "hash" });
        expect(user.id).toMatch(/[0-9a-f-]{36}/);
        expect(user.email).toBe("a@example.com");
        expect(user.role).toBe("user");
      });

      it("never returns the password in plain form — passwordHash is exactly what was supplied", async () => {
        const user = await repo.create({ email: "a@example.com", passwordHash: "the-hash" });
        expect(user.passwordHash).toBe("the-hash");
      });

      it("sets createdAt and updatedAt as ISO strings", async () => {
        const user = await repo.create({ email: "a@example.com", passwordHash: "hash" });
        expect(typeof user.createdAt).toBe("string");
        expect(Number.isNaN(Date.parse(user.createdAt))).toBe(false);
      });
    });

    describe("findByEmail", () => {
      it("returns the user", async () => {
        await repo.create({ email: "findme@example.com", passwordHash: "hash" });
        const found = await repo.findByEmail("findme@example.com");
        expect(found?.email).toBe("findme@example.com");
      });

      it("returns null for an email that does not exist", async () => {
        expect(await repo.findByEmail("nobody@example.com")).toBeNull();
      });
    });

    describe("findById", () => {
      it("returns the user", async () => {
        const created = await repo.create({ email: "a@example.com", passwordHash: "hash" });
        expect((await repo.findById(created.id))?.id).toBe(created.id);
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await repo.findById("does-not-exist")).toBeNull();
      });
    });

    describe("count", () => {
      it("is zero with no users", async () => {
        expect(await repo.count()).toBe(0);
      });

      it("reflects every created user", async () => {
        await repo.create({ email: "a@example.com", passwordHash: "hash" });
        await repo.create({ email: "b@example.com", passwordHash: "hash" });
        expect(await repo.count()).toBe(2);
      });
    });

    describe("listAll", () => {
      it("is empty with no users", async () => {
        expect(await repo.listAll()).toEqual([]);
      });

      it("returns every created user", async () => {
        await repo.create({ email: "a@example.com", passwordHash: "hash" });
        await repo.create({ email: "b@example.com", passwordHash: "hash" });
        const all = await repo.listAll();
        expect(all.map((u) => u.email).sort()).toEqual(["a@example.com", "b@example.com"]);
      });
    });

    describe("setRole", () => {
      it("updates the role and returns the updated user", async () => {
        const user = await repo.create({ email: "a@example.com", passwordHash: "hash" });
        const updated = await repo.setRole(user.id, "admin");
        expect(updated?.role).toBe("admin");
        expect((await repo.findById(user.id))?.role).toBe("admin");
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await repo.setRole("does-not-exist", "admin")).toBeNull();
      });
    });
  });
}
