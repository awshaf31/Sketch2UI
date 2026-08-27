import { beforeEach, describe, expect, it } from "vitest";
import type { PageRepository, ProjectRepository } from "../types.js";

/**
 * PageRepository CONTRACT — Phase D3 minimum-viable multi-page.
 *
 * Weighted toward the two structural guarantees the rest of the feature depends on:
 * `order` assignment being per-project and gapless, and `delete` refusing to remove a
 * project's last remaining page (the app has no valid "zero pages" state).
 */

export function runPageRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{ pages: PageRepository; projects: ProjectRepository }>,
  reset: () => Promise<void> | void
): void {
  describe(`PageRepository contract — ${name}`, () => {
    let pages: PageRepository;
    let projects: ProjectRepository;
    let projectId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      pages = repos.pages;
      projects = repos.projects;
      projectId = (await projects.create({ name: "Host", ownerId: "test-owner" })).id;
    });

    describe("create", () => {
      it("assigns order 1 to the first page", async () => {
        const page = await pages.create({ projectId, name: "Page 1" });
        expect(page.order).toBe(1);
      });

      it("increments order per project", async () => {
        await pages.create({ projectId, name: "Page 1" });
        const second = await pages.create({ projectId, name: "Page 2" });
        expect(second.order).toBe(2);
      });

      it("numbers each project's pages independently", async () => {
        const other = await projects.create({ name: "Other", ownerId: "test-owner" });
        await pages.create({ projectId, name: "Page 1" });
        const otherFirst = await pages.create({ projectId: other.id, name: "Page 1" });
        expect(otherFirst.order).toBe(1);
      });

      it("sets createdAt/updatedAt as ISO strings", async () => {
        const page = await pages.create({ projectId, name: "Page 1" });
        expect(Number.isNaN(Date.parse(page.createdAt))).toBe(false);
        expect(Number.isNaN(Date.parse(page.updatedAt))).toBe(false);
      });
    });

    describe("listByProject", () => {
      it("returns pages ordered by `order` ascending", async () => {
        await pages.create({ projectId, name: "Page 1" });
        await pages.create({ projectId, name: "Page 2" });
        await pages.create({ projectId, name: "Page 3" });
        const list = await pages.listByProject(projectId);
        expect(list.map((p) => p.order)).toEqual([1, 2, 3]);
      });

      it("scopes to the project", async () => {
        const other = await projects.create({ name: "Other", ownerId: "test-owner" });
        await pages.create({ projectId, name: "Mine" });
        await pages.create({ projectId: other.id, name: "Theirs" });
        expect((await pages.listByProject(projectId)).map((p) => p.name)).toEqual(["Mine"]);
      });
    });

    describe("findById", () => {
      it("returns the page", async () => {
        const created = await pages.create({ projectId, name: "Page 1" });
        expect((await pages.findById(created.id))?.id).toBe(created.id);
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await pages.findById("does-not-exist")).toBeNull();
      });
    });

    describe("update", () => {
      it("renames the page", async () => {
        const created = await pages.create({ projectId, name: "Before" });
        const updated = await pages.update(created.id, { name: "After" });
        expect(updated?.name).toBe("After");
      });

      it("returns null for a missing page", async () => {
        expect(await pages.update("nope", { name: "x" })).toBeNull();
      });
    });

    describe("setActiveCodeVersion", () => {
      it("sets the active code version", async () => {
        const created = await pages.create({ projectId, name: "Page 1" });
        await pages.setActiveCodeVersion(created.id, "version-123");
        expect((await pages.findById(created.id))?.activeCodeVersionId).toBe("version-123");
      });

      it("is a silent no-op for a missing page", async () => {
        await expect(pages.setActiveCodeVersion("missing", "v")).resolves.toBeUndefined();
      });
    });

    describe("delete — the last-page guard", () => {
      it("refuses to delete a project's only page", async () => {
        const only = await pages.create({ projectId, name: "Page 1" });
        expect(await pages.delete(only.id)).toBe(false);
        expect(await pages.findById(only.id)).not.toBeNull();
      });

      it("deletes a page when at least one sibling remains", async () => {
        const first = await pages.create({ projectId, name: "Page 1" });
        await pages.create({ projectId, name: "Page 2" });
        expect(await pages.delete(first.id)).toBe(true);
        expect(await pages.findById(first.id)).toBeNull();
      });

      it("returns false for a missing page", async () => {
        expect(await pages.delete("does-not-exist")).toBe(false);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its pages", async () => {
        const page = await pages.create({ projectId, name: "Page 1" });
        await projects.delete(projectId);
        expect(await pages.findById(page.id)).toBeNull();
      });
    });
  });
}
