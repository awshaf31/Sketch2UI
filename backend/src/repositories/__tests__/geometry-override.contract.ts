import { beforeEach, describe, expect, it } from "vitest";
import type {
  AssetRepository,
  DetectionRepository,
  GeometryOverrideRepository,
  PageRepository,
  ProjectRepository,
} from "../types.js";

/**
 * GeometryOverrideRepository CONTRACT — Phase 8 amendment §13.
 *
 * A partial override (nudge width only) is legal and must round-trip without
 * inventing values for the untouched fields — see geometry-override.ts's
 * effectiveBBox, which relies on the untouched fields staying `undefined`.
 */

export function runGeometryOverrideRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    geometryOverrides: GeometryOverrideRepository;
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
    pages: PageRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`GeometryOverrideRepository contract — ${name}`, () => {
    let geometryOverrides: GeometryOverrideRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let pageId: string;
    let detectionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      geometryOverrides = repos.geometryOverrides;
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
          className: "button",
          bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
          source: "manual",
        })
      ).id;
    });

    describe("put", () => {
      it("stores a full override", async () => {
        const result = await geometryOverrides.put(projectId, pageId, detectionId, {
          x: 0.2,
          y: 0.3,
          width: 0.4,
          height: 0.1,
        });
        expect(result).toEqual({ x: 0.2, y: 0.3, width: 0.4, height: 0.1 });
      });

      it("stores a PARTIAL override — only the given field is set, others stay absent", async () => {
        const result = await geometryOverrides.put(projectId, pageId, detectionId, { width: 0.5 });
        expect(result).toEqual({ width: 0.5 });
        expect(result?.x).toBeUndefined();
        expect(result?.y).toBeUndefined();
        expect(result?.height).toBeUndefined();
      });

      it("an empty object deletes and returns null", async () => {
        await geometryOverrides.put(projectId, pageId, detectionId, { x: 0.5 });
        const result = await geometryOverrides.put(projectId, pageId, detectionId, {});
        expect(result).toBeNull();
        expect(await geometryOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("a second put fully REPLACES the stored value — a prior field not repeated disappears", async () => {
        await geometryOverrides.put(projectId, pageId, detectionId, { x: 0.2, width: 0.4 });
        await geometryOverrides.put(projectId, pageId, detectionId, { y: 0.3 });
        const stored = await geometryOverrides.findByDetection(projectId, detectionId);
        expect(stored).toEqual({ y: 0.3 });
      });

      it("round-trips a zero value (falsy but meaningful)", async () => {
        const result = await geometryOverrides.put(projectId, pageId, detectionId, { x: 0 });
        expect(result?.x).toBe(0);
      });
    });

    describe("findByDetection", () => {
      it("returns null when nothing is stored", async () => {
        expect(await geometryOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });

      it("returns a DETACHED copy", async () => {
        await geometryOverrides.put(projectId, pageId, detectionId, { x: 0.2 });
        const found = await geometryOverrides.findByDetection(projectId, detectionId);
        (found as { x: number }).x = 0.9;
        expect((await geometryOverrides.findByDetection(projectId, detectionId))?.x).toBe(0.2);
      });
    });

    describe("mapForProject", () => {
      it("returns the whole project's map", async () => {
        await geometryOverrides.put(projectId, pageId, detectionId, { x: 0.2 });
        expect(await geometryOverrides.mapForProject(projectId)).toEqual({ [detectionId]: { x: 0.2 } });
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its geometry overrides", async () => {
        await geometryOverrides.put(projectId, pageId, detectionId, { x: 0.2 });
        await projects.delete(projectId);
        expect(await geometryOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });
  });
}
