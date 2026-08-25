import { beforeEach, describe, expect, it } from "vitest";
import type {
  AssetRepository,
  DetectionRepository,
  PageRepository,
  ProjectRepository,
  StructureOverrideRepository,
} from "../types.js";

/**
 * StructureOverrideRepository CONTRACT — Phase 8 amendment §13.
 *
 * Weighted toward the three-state `parentDetectionId` (a detection id / explicit
 * root `null` / "not touched" `undefined`) round-tripping exactly — the Prisma
 * adapter needs a side-channel boolean (`parentDetectionIdSet`) to represent this on
 * a column that only has two states, and a bug there would silently collapse
 * "explicit root" into "auto-inferred", which is the opposite of what the user asked.
 */

export function runStructureOverrideRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    structureOverrides: StructureOverrideRepository;
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
    pages: PageRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`StructureOverrideRepository contract — ${name}`, () => {
    let structureOverrides: StructureOverrideRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let pageId: string;
    let detectionId: string;
    let otherDetectionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      structureOverrides = repos.structureOverrides;
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
          bbox: { x: 0, y: 0, width: 0.1, height: 0.1 },
          source: "manual",
        })
      ).id;
      otherDetectionId = (
        await repos.detections.create({
          projectId,
          pageId,
          sourceAssetId: assetId,
          className: "card",
          bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
          source: "manual",
        })
      ).id;
    });

    describe("put — parentDetectionId as a string", () => {
      it("stores a reparent to another detection", async () => {
        const result = await structureOverrides.put(projectId, pageId, detectionId, {
          parentDetectionId: otherDetectionId,
        });
        expect(result).toEqual({ parentDetectionId: otherDetectionId });
      });
    });

    describe("put — parentDetectionId explicit null (root)", () => {
      it("stores and round-trips explicit root — NOT the same as absent", async () => {
        const result = await structureOverrides.put(projectId, pageId, detectionId, { parentDetectionId: null });
        expect(result).toEqual({ parentDetectionId: null });
        expect("parentDetectionId" in (result ?? {})).toBe(true);
      });

      it("findByDetection also returns explicit null, not undefined", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { parentDetectionId: null });
        const found = await structureOverrides.findByDetection(projectId, detectionId);
        expect(found?.parentDetectionId).toBeNull();
        expect(found && "parentDetectionId" in found).toBe(true);
      });
    });

    describe("put — displayOrder only", () => {
      it("stores displayOrder with parentDetectionId left OUT of the returned object entirely", async () => {
        const result = await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 3 });
        expect(result).toEqual({ displayOrder: 3 });
        expect(result && "parentDetectionId" in result).toBe(false);
      });

      it("displayOrder 0 round-trips (falsy but meaningful)", async () => {
        const result = await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 0 });
        expect(result?.displayOrder).toBe(0);
      });
    });

    describe("put — both fields together", () => {
      it("stores parentDetectionId and displayOrder together", async () => {
        const result = await structureOverrides.put(projectId, pageId, detectionId, {
          parentDetectionId: otherDetectionId,
          displayOrder: 1,
        });
        expect(result).toEqual({ parentDetectionId: otherDetectionId, displayOrder: 1 });
      });
    });

    describe("put — emptiness", () => {
      it("an object with neither field is EMPTY — deletes and returns null", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 2 });
        const result = await structureOverrides.put(projectId, pageId, detectionId, {});
        expect(result).toBeNull();
        expect(await structureOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });

    describe("put — full replace semantics", () => {
      it("a second put REPLACES the stored value — displayOrder-only clears a prior parentDetectionId", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { parentDetectionId: otherDetectionId });
        await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 5 });
        const stored = await structureOverrides.findByDetection(projectId, detectionId);
        expect(stored).toEqual({ displayOrder: 5 });
        expect(stored && "parentDetectionId" in stored).toBe(false);
      });

      it("re-setting explicit root after a string parent clears back to null, not absent", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { parentDetectionId: otherDetectionId });
        await structureOverrides.put(projectId, pageId, detectionId, { parentDetectionId: null });
        const stored = await structureOverrides.findByDetection(projectId, detectionId);
        expect(stored?.parentDetectionId).toBeNull();
      });
    });

    describe("mapForProject", () => {
      it("returns the whole project's map", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 1 });
        expect(await structureOverrides.mapForProject(projectId)).toEqual({
          [detectionId]: { displayOrder: 1 },
        });
      });
    });

    describe("remove", () => {
      it("deletes the stored value", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 1 });
        await structureOverrides.remove(projectId, detectionId);
        expect(await structureOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its structure overrides", async () => {
        await structureOverrides.put(projectId, pageId, detectionId, { displayOrder: 1 });
        await projects.delete(projectId);
        expect(await structureOverrides.findByDetection(projectId, detectionId)).toBeNull();
      });
    });
  });
}
