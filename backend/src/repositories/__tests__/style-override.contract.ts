import { beforeEach, describe, expect, it } from "vitest";
import type {
  AssetRepository,
  DetectionRepository,
  PageRepository,
  ProjectRepository,
  StyleOverrideRepository,
} from "../types.js";

/**
 * StyleOverrideRepository CONTRACT — Phase 8 amendment §13.
 *
 * Weighted toward the shared OverrideRepository contract (types.ts): an empty `put`
 * value is a delete, `mapForProject` shapes the response the way the API already
 * returns it, and everything is keyed on detection uuid (never a UI-IR node id).
 */

export function runStyleOverrideRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    styleOverrides: StyleOverrideRepository;
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
    pages: PageRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`StyleOverrideRepository contract — ${name}`, () => {
    let styleOverrides: StyleOverrideRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let pageId: string;
    let detectionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      styleOverrides = repos.styleOverrides;
      projects = repos.projects;
      const detections = repos.detections;
      const assets = repos.assets;

      projectId = (await projects.create({ name: "Host", ownerId: "test-owner" })).id;
      pageId = (await repos.pages.create({ projectId, name: "Page 1" })).id;
      const assetId = (
        await assets.create({
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
        await detections.create({
          projectId,
          pageId,
          sourceAssetId: assetId,
          className: "button",
          bbox: { x: 0, y: 0, width: 0.1, height: 0.1 },
          source: "manual",
        })
      ).id;
    });

    describe("put", () => {
      it("stores and returns the value", async () => {
        const result = await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        expect(result).toEqual({ display: "flex" });
      });

      it("an empty object deletes and returns null", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        const result = await styleOverrides.put(projectId, pageId, detectionId, {});
        expect(result).toBeNull();
        expect(await styleOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("a second put fully REPLACES the stored value, not merges", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex", gap: "8px" });
        await styleOverrides.put(projectId, pageId, detectionId, { padding: "4px" });
        expect(await styleOverrides.findByDetection(projectId, detectionId)).toEqual({ padding: "4px" });
      });
    });

    describe("findByDetection", () => {
      it("returns null when nothing is stored", async () => {
        expect(await styleOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("returns a DETACHED copy", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        const found = await styleOverrides.findByDetection(projectId, detectionId);
        (found as Record<string, string>).display = "grid";
        expect((await styleOverrides.findByDetection(projectId, detectionId))?.display).toBe("flex");
      });
    });

    describe("mapForProject", () => {
      it("returns the whole project's map keyed on detection id", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        const map = await styleOverrides.mapForProject(projectId);
        expect(map).toEqual({ [detectionId]: { display: "flex" } });
      });

      it("returns an empty object when nothing is stored", async () => {
        expect(await styleOverrides.mapForProject(projectId)).toEqual({});
      });
    });

    describe("remove", () => {
      it("deletes the stored value", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        await styleOverrides.remove(projectId, detectionId);
        expect(await styleOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("is a no-op when nothing is stored", async () => {
        await expect(styleOverrides.remove(projectId, detectionId)).resolves.toBeUndefined();
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its style overrides", async () => {
        await styleOverrides.put(projectId, pageId, detectionId, { display: "flex" });
        await projects.delete(projectId);
        expect(await styleOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });
  });
}
