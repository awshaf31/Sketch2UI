import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRepository, PageRepository, ProjectRepository } from "../types.js";

/**
 * AssetRepository CONTRACT — Phase 8 amendment §10.
 *
 * Written against the INTERFACE; both adapters run these exact assertions.
 * Not a *.test.ts file and registers nothing on import — each adapter has its own thin
 * test file that calls this once.
 *
 * Assets need a parent project AND page to exist (Postgres enforces the FK, JSON does
 * not), so the harness is given Project/Page repositories to create them.
 */

export function runAssetRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{ assets: AssetRepository; projects: ProjectRepository; pages: PageRepository }>,
  reset: () => Promise<void> | void
): void {
  describe(`AssetRepository contract — ${name}`, () => {
    let assets: AssetRepository;
    let projects: ProjectRepository;
    let pages: PageRepository;
    let projectId: string;
    let pageId: string;

    const input = (over: Partial<Parameters<AssetRepository["create"]>[0]> = {}) => ({
      projectId,
      pageId,
      storageKey: "abc.png",
      mimeType: "image/png",
      width: 800,
      height: 600,
      fileSize: 1234,
      ...over,
    });

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      assets = repos.assets;
      projects = repos.projects;
      pages = repos.pages;
      projectId = (await projects.create({ name: "Host project", ownerId: "test-owner" })).id;
      pageId = (await pages.create({ projectId, name: "Page 1" })).id;
    });

    describe("create", () => {
      it("returns the stored asset with a generated id", async () => {
        const asset = await assets.create(input());
        expect(asset.id).toMatch(/[0-9a-f-]{36}/);
        expect(asset.projectId).toBe(projectId);
        expect(asset.storageKey).toBe("abc.png");
      });

      it("preserves the numeric fields exactly", async () => {
        const asset = await assets.create(input({ width: 1920, height: 1080, fileSize: 999 }));
        expect(asset.width).toBe(1920);
        expect(asset.height).toBe(1080);
        expect(asset.fileSize).toBe(999);
      });

      it("sets createdAt as an ISO string", async () => {
        const asset = await assets.create(input());
        expect(typeof asset.createdAt).toBe("string");
        expect(Number.isNaN(Date.parse(asset.createdAt))).toBe(false);
      });
    });

    describe("findById", () => {
      it("returns the asset", async () => {
        const created = await assets.create(input());
        expect((await assets.findById(created.id))?.id).toBe(created.id);
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await assets.findById("does-not-exist")).toBeNull();
      });

      it("returns a DETACHED copy — mutating it must not affect stored state", async () => {
        const created = await assets.create(input());
        const found = await assets.findById(created.id);
        (found as { storageKey: string }).storageKey = "mutated.png";
        expect((await assets.findById(created.id))?.storageKey).toBe("abc.png");
      });
    });

    describe("listByProject", () => {
      it("returns only that project's assets", async () => {
        const other = await projects.create({ name: "Other", ownerId: "test-owner" });
        const otherPageId = (await pages.create({ projectId: other.id, name: "Page 1" })).id;
        await assets.create(input({ storageKey: "mine.png" }));
        await assets.create(input({ projectId: other.id, pageId: otherPageId, storageKey: "theirs.png" }));

        const mine = await assets.listByProject(projectId);
        expect(mine.map((a) => a.storageKey)).toEqual(["mine.png"]);
      });

      it("returns an empty array for a project with no assets", async () => {
        expect(await assets.listByProject(projectId)).toEqual([]);
      });

      it("returns an empty array for a project that does not exist (never throws)", async () => {
        // The GET route filters without a 404 guard, so a nonexistent project must
        // yield [] rather than an error — preserving that route's contract.
        expect(await assets.listByProject("no-such-project")).toEqual([]);
      });

      it("returns assets in insertion order", async () => {
        // Relied on by exports.routes.ts, which treats the last asset as the project's
        // source sketch.
        await assets.create(input({ storageKey: "first.png" }));
        await new Promise((r) => setTimeout(r, 5));
        await assets.create(input({ storageKey: "second.png" }));
        await new Promise((r) => setTimeout(r, 5));
        await assets.create(input({ storageKey: "third.png" }));

        const list = await assets.listByProject(projectId);
        expect(list.map((a) => a.storageKey)).toEqual(["first.png", "second.png", "third.png"]);
      });
    });

    describe("findLatestForProject", () => {
      it("returns the most recently created asset", async () => {
        await assets.create(input({ storageKey: "old.png" }));
        await new Promise((r) => setTimeout(r, 5));
        await assets.create(input({ storageKey: "newest.png" }));

        expect((await assets.findLatestForProject(projectId))?.storageKey).toBe("newest.png");
      });

      it("returns null when the project has no assets", async () => {
        expect(await assets.findLatestForProject(projectId)).toBeNull();
      });

      it("ignores other projects' assets", async () => {
        const other = await projects.create({ name: "Other", ownerId: "test-owner" });
        const otherPageId = (await pages.create({ projectId: other.id, name: "Page 1" })).id;
        await assets.create(input({ projectId: other.id, pageId: otherPageId, storageKey: "theirs.png" }));
        expect(await assets.findLatestForProject(projectId)).toBeNull();
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its assets", async () => {
        const created = await assets.create(input());
        await projects.delete(projectId);
        // JSON filters the array; Postgres uses ON DELETE CASCADE. Same observable result.
        expect(await assets.findById(created.id)).toBeNull();
      });

      it("project delete reports the assets it removed, for file cleanup", async () => {
        await assets.create(input({ storageKey: "cleanup-me.png" }));
        const removed = await projects.delete(projectId);
        expect(removed?.assets.map((a) => a.storageKey)).toEqual(["cleanup-me.png"]);
      });
    });
  });
}
