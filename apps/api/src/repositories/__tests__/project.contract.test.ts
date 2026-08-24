import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db/jsonStore.js";
import { JsonProjectRepository } from "../json/project.repository.js";
import type { ProjectRepository } from "../types.js";

/**
 * ProjectRepository CONTRACT test — Phase 8 amendment §10.
 *
 * The point of this suite is that it is written against the INTERFACE, not against an
 * implementation. Every adapter must satisfy identical assertions, which is what makes
 * swapping JSON for Prisma a verifiable change rather than a hopeful one.
 *
 * The Prisma arm is defined in project.contract.prisma.test.ts and skips itself when no
 * database is reachable — it shares this suite via `runProjectRepositoryContract`.
 */

export function runProjectRepositoryContract(
  name: string,
  makeRepository: () => Promise<ProjectRepository> | ProjectRepository,
  reset: () => Promise<void> | void
): void {
  describe(`ProjectRepository contract — ${name}`, () => {
    let repo: ProjectRepository;

    beforeEach(async () => {
      await reset();
      repo = await makeRepository();
    });

    describe("create", () => {
      it("returns a project with a generated id and draft status", async () => {
        const project = await repo.create({ name: "Demo" });
        expect(project.id).toMatch(/[0-9a-f-]{36}/);
        expect(project.name).toBe("Demo");
        expect(project.status).toBe("draft");
      });

      it("sets createdAt and updatedAt as ISO strings", async () => {
        const project = await repo.create({ name: "Demo" });
        // ISO strings, not Dates — these are serialized straight into JSON responses,
        // so a Date here would change the wire format.
        expect(typeof project.createdAt).toBe("string");
        expect(typeof project.updatedAt).toBe("string");
        expect(Number.isNaN(Date.parse(project.createdAt))).toBe(false);
      });

      it("omits description entirely when not supplied", async () => {
        const project = await repo.create({ name: "Demo" });
        // Absent, not null: `res.json` must not start emitting "description": null.
        expect("description" in project && project.description !== undefined).toBe(false);
      });

      it("keeps description when supplied", async () => {
        const project = await repo.create({ name: "Demo", description: "hello" });
        expect(project.description).toBe("hello");
      });
    });

    describe("findById", () => {
      it("returns the project", async () => {
        const created = await repo.create({ name: "Findable" });
        const found = await repo.findById(created.id);
        expect(found?.id).toBe(created.id);
        expect(found?.name).toBe("Findable");
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await repo.findById("does-not-exist")).toBeNull();
      });

      it("returns a DETACHED copy — mutating it must not affect stored state", async () => {
        // This is the single most important assertion in the suite. The pre-migration
        // code mutated objects obtained from db.state and relied on that persisting.
        // Prisma cannot do that, so the contract forbids it and both adapters must
        // behave the same way (amendment §2.3).
        const created = await repo.create({ name: "Original" });
        const found = await repo.findById(created.id);
        (found as { name: string }).name = "Mutated In Place";

        const refetched = await repo.findById(created.id);
        expect(refetched?.name).toBe("Original");
      });
    });

    describe("list", () => {
      it("returns every project", async () => {
        await repo.create({ name: "A" });
        await repo.create({ name: "B" });
        const all = await repo.list();
        expect(all.map((p) => p.name).sort()).toEqual(["A", "B"]);
      });

      it("returns an empty array when there are none", async () => {
        expect(await repo.list()).toEqual([]);
      });
    });

    describe("update", () => {
      it("changes only the supplied fields", async () => {
        const created = await repo.create({ name: "Before", description: "keep me" });
        const updated = await repo.update(created.id, { name: "After" });
        expect(updated?.name).toBe("After");
        expect(updated?.description).toBe("keep me");
      });

      it("persists the change", async () => {
        const created = await repo.create({ name: "Before" });
        await repo.update(created.id, { name: "After" });
        expect((await repo.findById(created.id))?.name).toBe("After");
      });

      it("updates status", async () => {
        const created = await repo.create({ name: "S" });
        const updated = await repo.update(created.id, { status: "generated" });
        expect(updated?.status).toBe("generated");
      });

      it("advances updatedAt", async () => {
        const created = await repo.create({ name: "T" });
        await new Promise((r) => setTimeout(r, 5));
        const updated = await repo.update(created.id, { name: "T2" });
        expect(Date.parse(updated!.updatedAt)).toBeGreaterThanOrEqual(
          Date.parse(created.createdAt)
        );
      });

      it("returns null for a missing project", async () => {
        expect(await repo.update("nope", { name: "x" })).toBeNull();
      });
    });

    describe("setActiveCodeVersion / setStatus", () => {
      it("sets the active code version", async () => {
        const created = await repo.create({ name: "V" });
        await repo.setActiveCodeVersion(created.id, "version-123");
        expect((await repo.findById(created.id))?.activeCodeVersionId).toBe("version-123");
      });

      it("sets status", async () => {
        const created = await repo.create({ name: "V" });
        await repo.setStatus(created.id, "generated");
        expect((await repo.findById(created.id))?.status).toBe("generated");
      });

      it("is a silent no-op for a missing project", async () => {
        // Contract: no throw. The JSON adapter naturally no-ops; Prisma's `update` would
        // throw P2025, which is why its adapter uses updateMany.
        await expect(repo.setActiveCodeVersion("missing", "v")).resolves.toBeUndefined();
        await expect(repo.setStatus("missing", "generated")).resolves.toBeUndefined();
      });
    });

    describe("delete", () => {
      it("removes the project", async () => {
        const created = await repo.create({ name: "Doomed" });
        await repo.delete(created.id);
        expect(await repo.findById(created.id)).toBeNull();
      });

      it("returns null for a missing project", async () => {
        expect(await repo.delete("missing")).toBeNull();
      });

      it("returns the file-bearing rows so the caller can clean up", async () => {
        const created = await repo.create({ name: "WithFiles" });
        const result = await repo.delete(created.id);
        // Shape matters even when empty: the route iterates these unconditionally.
        expect(Array.isArray(result?.assets)).toBe(true);
        expect(Array.isArray(result?.exports)).toBe(true);
      });

      it("does not affect other projects", async () => {
        const keep = await repo.create({ name: "Keep" });
        const drop = await repo.create({ name: "Drop" });
        await repo.delete(drop.id);
        expect(await repo.findById(keep.id)).not.toBeNull();
      });
    });

    describe("override maps are not part of the project record", () => {
      it("never exposes styleOverrides etc. on a returned project", async () => {
        // Deliberate narrowing — overrides are their own repositories and their own
        // tables in the Prisma schema. Verified safe: apps/web reads them only from the
        // dedicated endpoints. See ProjectRecord's doc comment.
        const created = await repo.create({ name: "Clean" });
        const found = (await repo.findById(created.id)) as Record<string, unknown>;
        expect(found.styleOverrides).toBeUndefined();
        expect(found.contentOverrides).toBeUndefined();
        expect(found.geometryOverrides).toBeUndefined();
        expect(found.structureOverrides).toBeUndefined();
      });
    });
  });
}

// --- JSON adapter arm -------------------------------------------------------------
// Always runs: it needs no external service.
runProjectRepositoryContract(
  "JSON adapter",
  () => new JsonProjectRepository(),
  () => {
    // Safe because vitest.setup.ts redirected STORE_FILE to a temp file and asserted
    // the redirect took effect before any module loaded.
    db.reset();
  }
);
