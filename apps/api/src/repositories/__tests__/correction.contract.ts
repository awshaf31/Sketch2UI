import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRepository, CorrectionRepository, DetectionRepository, ProjectRepository } from "../types.js";

/**
 * CorrectionRepository CONTRACT — Phase 8 amendment §14.
 *
 * Weighted toward the three-state `parentDetectionId` fields round-tripping exactly
 * (same problem StructureOverride solves, doubled for old/new) and chronological
 * ordering, since the Inspector's History section reads top-to-bottom as a timeline.
 */

export function runCorrectionRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    corrections: CorrectionRepository;
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`CorrectionRepository contract — ${name}`, () => {
    let corrections: CorrectionRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let detectionId: string;
    let otherDetectionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      corrections = repos.corrections;
      projects = repos.projects;

      projectId = (await projects.create({ name: "Host" })).id;
      const assetId = (
        await repos.assets.create({
          projectId,
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
          sourceAssetId: assetId,
          className: "button",
          bbox: { x: 0, y: 0, width: 0.1, height: 0.1 },
          source: "manual",
        })
      ).id;
      otherDetectionId = (
        await repos.detections.create({
          projectId,
          sourceAssetId: assetId,
          className: "card",
          bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
          source: "manual",
        })
      ).id;
    });

    describe("append", () => {
      it("mints an id, sets source to 'user', and stamps a timestamp", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "created",
          newClassName: "button",
        });
        expect(record.id).toBeTruthy();
        expect(record.source).toBe("user");
        expect(Number.isNaN(Date.parse(record.timestamp))).toBe(false);
      });

      it("round-trips class_changed fields", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "class_changed",
          oldClassName: "input",
          newClassName: "select",
        });
        expect(record.oldClassName).toBe("input");
        expect(record.newClassName).toBe("select");
      });

      it("round-trips bbox_changed fields exactly", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "bbox_changed",
          oldBBox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
          newBBox: { x: 0.15, y: 0.1, width: 0.2, height: 0.1 },
        });
        expect(record.oldBBox).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 });
        expect(record.newBBox).toEqual({ x: 0.15, y: 0.1, width: 0.2, height: 0.1 });
      });

      it("round-trips explicit null parentDetectionId (root) — NOT the same as absent", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "parent_changed",
          oldParentDetectionId: otherDetectionId,
          newParentDetectionId: null,
        });
        expect(record.oldParentDetectionId).toBe(otherDetectionId);
        expect(record.newParentDetectionId).toBeNull();
        expect("newParentDetectionId" in record).toBe(true);
      });

      it("leaves parentDetectionId fields OUT entirely when not provided", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "order_changed",
          oldDisplayOrder: 1,
          newDisplayOrder: 2,
        });
        expect("oldParentDetectionId" in record).toBe(false);
        expect("newParentDetectionId" in record).toBe(false);
      });

      it("round-trips displayOrder 0 (falsy but meaningful)", async () => {
        const record = await corrections.append({
          projectId,
          detectionId,
          type: "order_changed",
          newDisplayOrder: 0,
        });
        expect(record.newDisplayOrder).toBe(0);
      });
    });

    describe("list", () => {
      it("returns a project's records in CHRONOLOGICAL order", async () => {
        await corrections.append({ projectId, detectionId, type: "created", newClassName: "a" });
        await new Promise((r) => setTimeout(r, 5));
        await corrections.append({ projectId, detectionId, type: "class_changed", newClassName: "b" });
        await new Promise((r) => setTimeout(r, 5));
        await corrections.append({ projectId, detectionId, type: "class_changed", newClassName: "c" });

        const list = await corrections.list(projectId);
        expect(list.map((r) => r.newClassName)).toEqual(["a", "b", "c"]);
      });

      it("scopes to one detection when detectionId is given", async () => {
        await corrections.append({ projectId, detectionId, type: "created", newClassName: "mine" });
        await corrections.append({ projectId, detectionId: otherDetectionId, type: "created", newClassName: "theirs" });

        const list = await corrections.list(projectId, detectionId);
        expect(list.map((r) => r.newClassName)).toEqual(["mine"]);
      });

      it("returns an empty array for a project with no records", async () => {
        expect(await corrections.list(projectId)).toEqual([]);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its correction records", async () => {
        await corrections.append({ projectId, detectionId, type: "created", newClassName: "a" });
        await projects.delete(projectId);
        expect(await corrections.list(projectId)).toEqual([]);
      });
    });
  });
}
