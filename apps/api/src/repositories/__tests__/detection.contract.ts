import { beforeEach, describe, expect, it } from "vitest";
import type {
  AssetRepository,
  DetectionRepository,
  ProjectRepository,
} from "../types.js";

/**
 * DetectionRepository CONTRACT — Phase 8 amendment §10.
 *
 * Weighted deliberately toward the model→manual flip. That rule is what stops a
 * re-detect from destroying a human correction (§27.5 + §26), it was route-level logic
 * until this migration, and it is the single behaviour whose loss would be both severe
 * and silent — the app would keep working and just quietly discard user work.
 */

export function runDetectionRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    detections: DetectionRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`DetectionRepository contract — ${name}`, () => {
    let detections: DetectionRepository;
    let assets: AssetRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let assetId: string;

    const BBOX = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

    const manual = (over: Record<string, unknown> = {}) => ({
      projectId,
      sourceAssetId: assetId,
      className: "button",
      bbox: { ...BBOX },
      source: "manual" as const,
      ...over,
    });

    const model = (over: Record<string, unknown> = {}) =>
      manual({ source: "model" as const, confidence: 0.82, modelVersionId: "v1.0.0", ...over });

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      detections = repos.detections;
      assets = repos.assets;
      projects = repos.projects;
      projectId = (await projects.create({ name: "Host" })).id;
      assetId = (
        await assets.create({
          projectId,
          storageKey: "s.png",
          mimeType: "image/png",
          width: 100,
          height: 100,
          fileSize: 10,
        })
      ).id;
    });

    describe("create", () => {
      it("defaults a manual detection to confidence 1 and status active", async () => {
        const d = await detections.create(manual());
        expect(d.confidence).toBe(1);
        expect(d.status).toBe("active");
        expect(d.source).toBe("manual");
      });

      it("preserves a model detection's confidence and version", async () => {
        const d = await detections.create(model());
        expect(d.confidence).toBeCloseTo(0.82, 5);
        expect(d.modelVersionId).toBe("v1.0.0");
      });

      it("round-trips the bbox exactly", async () => {
        const d = await detections.create(manual());
        expect(d.bbox).toEqual(BBOX);
      });

      it("honours an explicit rejected status (§10.7 keeps, never drops)", async () => {
        const d = await detections.create(model({ status: "rejected" as const }));
        expect(d.status).toBe("rejected");
      });

      it("omits originalClassName until a correction happens", async () => {
        const d = await detections.create(model());
        expect(d.originalClassName).toBeUndefined();
      });
    });

    describe("createMany", () => {
      it("creates all rows and returns them in input order", async () => {
        const made = await detections.createMany([
          model({ className: "a" }),
          model({ className: "b" }),
          model({ className: "c" }),
        ]);
        expect(made.map((d) => d.className)).toEqual(["a", "b", "c"]);
        expect(await detections.listByProject(projectId)).toHaveLength(3);
      });

      it("handles an empty batch", async () => {
        expect(await detections.createMany([])).toEqual([]);
      });
    });

    describe("lookups", () => {
      it("findInProject returns the detection", async () => {
        const d = await detections.create(manual());
        expect((await detections.findInProject(projectId, d.id))?.id).toBe(d.id);
      });

      it("findInProject returns null when it belongs to another project", async () => {
        const d = await detections.create(manual());
        const other = await projects.create({ name: "Other" });
        expect(await detections.findInProject(other.id, d.id)).toBeNull();
      });

      it("findById is unscoped", async () => {
        const d = await detections.create(manual());
        expect((await detections.findById(d.id))?.id).toBe(d.id);
      });

      it("returns null for a missing id rather than throwing", async () => {
        expect(await detections.findById("nope")).toBeNull();
        expect(await detections.findInProject(projectId, "nope")).toBeNull();
      });

      it("listActiveByProject excludes rejected and deleted", async () => {
        await detections.create(manual({ className: "keep" }));
        await detections.create(model({ className: "drop", status: "rejected" as const }));
        const active = await detections.listActiveByProject(projectId);
        expect(active.map((d) => d.className)).toEqual(["keep"]);
      });

      it("listActiveByAsset scopes to the asset", async () => {
        await detections.create(manual());
        const otherAsset = await assets.create({
          projectId,
          storageKey: "o.png",
          mimeType: "image/png",
          width: 1,
          height: 1,
          fileSize: 1,
        });
        expect(await detections.listActiveByAsset(otherAsset.id)).toEqual([]);
        expect(await detections.listActiveByAsset(assetId)).toHaveLength(1);
      });

      it("returns DETACHED copies", async () => {
        const d = await detections.create(manual());
        const found = await detections.findById(d.id);
        (found as { className: string }).className = "mutated";
        expect((await detections.findById(d.id))?.className).toBe("button");
      });
    });

    // ---- The rule this migration exists to protect ---------------------------------

    describe("model→manual flip", () => {
      it("flips source to manual when a MODEL detection's class changes", async () => {
        const d = await detections.create(model({ className: "input" }));
        const r = await detections.update(projectId, d.id, { className: "select" });
        expect(r?.detection.source).toBe("manual");
      });

      it("flips source to manual when a MODEL detection's bbox changes", async () => {
        const d = await detections.create(model());
        const r = await detections.update(projectId, d.id, {
          bbox: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
        });
        expect(r?.detection.source).toBe("manual");
      });

      it("pins confidence to 1 on flip", async () => {
        const d = await detections.create(model({ className: "input" }));
        const r = await detections.update(projectId, d.id, { className: "select" });
        expect(r?.detection.confidence).toBe(1);
      });

      it("KEEPS modelVersionId for provenance after the flip", async () => {
        const d = await detections.create(model({ className: "input" }));
        const r = await detections.update(projectId, d.id, { className: "select" });
        expect(r?.detection.modelVersionId).toBe("v1.0.0");
      });

      it("records originalClassName as what the MODEL proposed", async () => {
        const d = await detections.create(model({ className: "input" }));
        const r = await detections.update(projectId, d.id, { className: "select" });
        expect(r?.detection.originalClassName).toBe("input");
      });

      it("does NOT overwrite originalClassName on a second correction", async () => {
        // §36's active-learning signal needs the class the model got wrong, not an
        // intermediate one the user passed through.
        const d = await detections.create(model({ className: "input" }));
        await detections.update(projectId, d.id, { className: "select" });
        const second = await detections.update(projectId, d.id, { className: "textarea" });
        expect(second?.detection.originalClassName).toBe("input");
        expect(second?.detection.className).toBe("textarea");
      });

      it("does NOT flip when the class is set to its existing value", async () => {
        const d = await detections.create(model({ className: "input" }));
        const r = await detections.update(projectId, d.id, { className: "input" });
        expect(r?.classChanged).toBe(false);
        expect(r?.detection.source).toBe("model");
        expect(r?.detection.confidence).toBeCloseTo(0.82, 5);
      });

      it("does NOT flip when the bbox is set to an identical bbox", async () => {
        const d = await detections.create(model());
        const r = await detections.update(projectId, d.id, { bbox: { ...BBOX } });
        expect(r?.bboxChanged).toBe(false);
        expect(r?.detection.source).toBe("model");
      });

      it("does NOT flip on a status-only change", async () => {
        // Boundary filtering rewrites status; that is not a human correction.
        const d = await detections.create(model());
        const r = await detections.update(projectId, d.id, { status: "rejected" });
        expect(r?.detection.source).toBe("model");
        expect(r?.detection.confidence).toBeCloseTo(0.82, 5);
      });

      it("leaves a MANUAL detection's confidence and source alone", async () => {
        const d = await detections.create(manual({ className: "button" }));
        const r = await detections.update(projectId, d.id, { className: "link" });
        expect(r?.detection.source).toBe("manual");
        expect(r?.detection.originalClassName).toBeUndefined();
      });
    });

    describe("update result", () => {
      it("returns the previous state for correction history", async () => {
        const d = await detections.create(manual({ className: "button" }));
        const r = await detections.update(projectId, d.id, { className: "link" });
        expect(r?.previous.className).toBe("button");
        expect(r?.detection.className).toBe("link");
      });

      it("reports which fields changed", async () => {
        const d = await detections.create(manual());
        const r = await detections.update(projectId, d.id, {
          className: "link",
          bbox: { x: 0.9, y: 0.9, width: 0.05, height: 0.05 },
        });
        expect(r?.classChanged).toBe(true);
        expect(r?.bboxChanged).toBe(true);
      });

      it("returns null for a missing detection", async () => {
        expect(await detections.update(projectId, "nope", { className: "x" })).toBeNull();
      });

      it("returns null when the detection belongs to another project", async () => {
        const d = await detections.create(manual());
        const other = await projects.create({ name: "Other" });
        expect(await detections.update(other.id, d.id, { className: "x" })).toBeNull();
      });

      it("persists the change", async () => {
        const d = await detections.create(manual());
        await detections.update(projectId, d.id, { className: "link" });
        expect((await detections.findById(d.id))?.className).toBe("link");
      });
    });

    describe("delete", () => {
      it("returns the removed detection so it can be recorded", async () => {
        const d = await detections.create(manual({ className: "gone" }));
        const removed = await detections.delete(projectId, d.id);
        expect(removed?.className).toBe("gone");
        expect(await detections.findById(d.id)).toBeNull();
      });

      it("returns null for a missing detection", async () => {
        expect(await detections.delete(projectId, "nope")).toBeNull();
      });

      it("refuses to delete another project's detection", async () => {
        const d = await detections.create(manual());
        const other = await projects.create({ name: "Other" });
        expect(await detections.delete(other.id, d.id)).toBeNull();
        expect(await detections.findById(d.id)).not.toBeNull();
      });
    });

    describe("clearModelDetections (§27.5 idempotency)", () => {
      it("removes model detections for that asset", async () => {
        await detections.createMany([model(), model()]);
        const removed = await detections.clearModelDetections(projectId, assetId);
        expect(removed).toBe(2);
        expect(await detections.listByProject(projectId)).toEqual([]);
      });

      it("NEVER removes manual detections", async () => {
        await detections.create(manual({ className: "mine" }));
        await detections.create(model());
        await detections.clearModelDetections(projectId, assetId);
        const left = await detections.listByProject(projectId);
        expect(left.map((d) => d.className)).toEqual(["mine"]);
      });

      it("NEVER removes a corrected detection that was flipped to manual", async () => {
        // The flip's entire purpose. If this fails, a re-detect silently destroys the
        // user's correction.
        const d = await detections.create(model({ className: "input" }));
        await detections.update(projectId, d.id, { className: "select" });
        await detections.clearModelDetections(projectId, assetId);
        const survivor = await detections.findById(d.id);
        expect(survivor?.className).toBe("select");
        expect(survivor?.originalClassName).toBe("input");
      });

      it("does not touch another asset's model detections", async () => {
        const otherAsset = await assets.create({
          projectId,
          storageKey: "o.png",
          mimeType: "image/png",
          width: 1,
          height: 1,
          fileSize: 1,
        });
        await detections.create(model({ sourceAssetId: otherAsset.id }));
        expect(await detections.clearModelDetections(projectId, assetId)).toBe(0);
        expect(await detections.listByProject(projectId)).toHaveLength(1);
      });

      it("is safe to run when there is nothing to clear", async () => {
        expect(await detections.clearModelDetections(projectId, assetId)).toBe(0);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its detections", async () => {
        const d = await detections.create(manual());
        await projects.delete(projectId);
        expect(await detections.findById(d.id)).toBeNull();
      });
    });
  });
}
