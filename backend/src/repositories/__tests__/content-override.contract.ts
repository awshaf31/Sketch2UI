import { beforeEach, describe, expect, it } from "vitest";
import type {
  AssetRepository,
  ContentOverrideRepository,
  DetectionRepository,
  PageRepository,
  ProjectRepository,
} from "../types.js";

/**
 * ContentOverrideRepository CONTRACT — Phase 8 amendment §13.
 *
 * "Empty" is domain-specific here: `contentState` is always present on a stored
 * value, so emptiness means none of text/altText/href were set (see
 * content-override.repository.ts's doc comment) — NOT `Object.keys(value).length === 0`.
 */

export function runContentOverrideRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    contentOverrides: ContentOverrideRepository;
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
    pages: PageRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`ContentOverrideRepository contract — ${name}`, () => {
    let contentOverrides: ContentOverrideRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let pageId: string;
    let detectionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      contentOverrides = repos.contentOverrides;
      projects = repos.projects;

      projectId = (await projects.create({ name: "Host", ownerId: "test-owner" })).id;
      pageId = (await repos.pages.create({ projectId, name: "Page 1" })).id;
      const assetId = (
        await repos.assets.create({
          projectId,
          pageId,
          storageKey: "s.png",
          mimeType: "image/png",
          width: 100,
          height: 100,
          fileSize: 10,
        })
      ).id;
      detectionId = (
        await repos.detections.create({
          projectId,
          pageId,
          sourceAssetId: assetId,
          className: "heading",
          bbox: { x: 0, y: 0, width: 0.1, height: 0.1 },
          source: "manual",
        })
      ).id;
    });

    describe("put", () => {
      it("stores and returns text + contentState", async () => {
        const result = await contentOverrides.put(projectId, pageId, detectionId, {
          text: "Hello",
          contentState: "user-edited",
        });
        expect(result).toEqual({ text: "Hello", contentState: "user-edited" });
      });

      it("a value with only contentState (no text/altText/href) is EMPTY — deletes and returns null", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Hello", contentState: "user-edited" });
        const result = await contentOverrides.put(projectId, pageId, detectionId, { contentState: "user-edited" });
        expect(result).toBeNull();
        expect(await contentOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("stores href", async () => {
        const result = await contentOverrides.put(projectId, pageId, detectionId, {
          href: "/pricing",
          contentState: "user-edited",
        });
        expect(result?.href).toBe("/pricing");
      });

      it("a second put fully REPLACES the stored value", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, {
          text: "First",
          altText: "alt",
          contentState: "user-edited",
        });
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Second", contentState: "user-edited" });
        const stored = await contentOverrides.findByDetection(projectId, detectionId);
        expect(stored).toEqual({ text: "Second", contentState: "user-edited" });
        expect(stored?.altText).toBeUndefined();
      });
    });

    describe("findByDetection", () => {
      it("returns null when nothing is stored", async () => {
        expect(await contentOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("returns a DETACHED copy", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Hello", contentState: "user-edited" });
        const found = await contentOverrides.findByDetection(projectId, detectionId);
        (found as { text: string }).text = "mutated";
        expect((await contentOverrides.findByDetection(projectId, detectionId))?.text).toBe("Hello");
      });
    });

    describe("mapForProject", () => {
      it("returns the whole project's map", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Hello", contentState: "user-edited" });
        expect(await contentOverrides.mapForProject(projectId)).toEqual({
          [detectionId]: { text: "Hello", contentState: "user-edited" },
        });
      });
    });

    describe("remove", () => {
      it("deletes the stored value", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Hello", contentState: "user-edited" });
        await contentOverrides.remove(projectId, detectionId);
        expect(await contentOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its content overrides", async () => {
        await contentOverrides.put(projectId, pageId, detectionId, { text: "Hello", contentState: "user-edited" });
        await projects.delete(projectId);
        expect(await contentOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });
  });
}
