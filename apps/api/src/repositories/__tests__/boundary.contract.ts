import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRepository, BoundaryRepository, ProjectRepository } from "../types.js";

/**
 * BoundaryRepository CONTRACT — Phase 8 amendment §11.
 *
 * Weighted toward the sticky-correction rule: once a human adjusts a page boundary, a
 * later auto-detection run must NOT overwrite it. That is the same guarantee the
 * Detection contract protects for box corrections (§10), applied to the boundary
 * domain — and it is the entire reason `saveRespectingManual` exists as one domain
 * operation instead of a read-then-write the caller could get wrong.
 */

export function runBoundaryRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    boundaries: BoundaryRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`BoundaryRepository contract — ${name}`, () => {
    let boundaries: BoundaryRepository;
    let assets: AssetRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let assetId: string;

    const AUTO_POLYGON: [number, number][] = [
      [0.05, 0.05],
      [0.95, 0.05],
      [0.95, 0.95],
      [0.05, 0.95],
    ];
    const MANUAL_POLYGON: [number, number][] = [
      [0.1, 0.1],
      [0.9, 0.1],
      [0.9, 0.9],
      [0.1, 0.9],
    ];

    const auto = (over: Record<string, unknown> = {}) => ({
      polygon: AUTO_POLYGON,
      confidence: 0.87,
      method: "contour" as const,
      areaFraction: 0.7,
      applied: true,
      overlapThreshold: 0.5,
      ...over,
    });

    const manual = (over: Record<string, unknown> = {}) => ({
      polygon: MANUAL_POLYGON,
      confidence: 1,
      method: "manual" as const,
      areaFraction: 1,
      applied: true,
      overlapThreshold: 0.5,
      ...over,
    });

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      boundaries = repos.boundaries;
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

    describe("findByAsset", () => {
      it("returns null when no boundary has been saved", async () => {
        expect(await boundaries.findByAsset(assetId)).toBeNull();
      });

      it("returns the saved record", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto(), "auto");
        expect((await boundaries.findByAsset(assetId))?.assetId).toBe(assetId);
      });

      it("returns a DETACHED copy", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto(), "auto");
        const found = await boundaries.findByAsset(assetId);
        (found as { method: string }).method = "manual";
        expect((await boundaries.findByAsset(assetId))?.method).toBe("contour");
      });
    });

    describe("saveRespectingManual — first write", () => {
      it("creates a new record for an auto write", async () => {
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          auto(),
          "auto"
        );
        expect(preservedManual).toBe(false);
        expect(record.source).toBe("auto");
        expect(record.polygon).toEqual(AUTO_POLYGON);
      });

      it("creates a new record for a manual write", async () => {
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          manual(),
          "manual"
        );
        expect(preservedManual).toBe(false);
        expect(record.source).toBe("manual");
      });

      it("round-trips confidence, method, areaFraction, applied, overlapThreshold", async () => {
        const { record } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          auto({ confidence: 0.6123, areaFraction: 0.42, applied: false, overlapThreshold: 0.35 }),
          "auto"
        );
        expect(record.confidence).toBeCloseTo(0.6123, 5);
        expect(record.areaFraction).toBeCloseTo(0.42, 5);
        expect(record.applied).toBe(false);
        expect(record.overlapThreshold).toBeCloseTo(0.35, 5);
      });
    });

    describe("saveRespectingManual — sticky-correction rule", () => {
      it("an AUTO write overwrites a prior AUTO record", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto({ confidence: 0.5 }), "auto");
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          auto({ confidence: 0.9 }),
          "auto"
        );
        expect(preservedManual).toBe(false);
        expect(record.confidence).toBeCloseTo(0.9, 5);
      });

      it("a MANUAL write overwrites a prior AUTO record", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto(), "auto");
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          manual(),
          "manual"
        );
        expect(preservedManual).toBe(false);
        expect(record.source).toBe("manual");
        expect(record.polygon).toEqual(MANUAL_POLYGON);
      });

      it("an AUTO write does NOT overwrite an existing MANUAL record — the rule's entire purpose", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, manual(), "manual");
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          auto(),
          "auto"
        );
        expect(preservedManual).toBe(true);
        expect(record.source).toBe("manual");
        expect(record.polygon).toEqual(MANUAL_POLYGON);

        const stored = await boundaries.findByAsset(assetId);
        expect(stored?.source).toBe("manual");
        expect(stored?.polygon).toEqual(MANUAL_POLYGON);
      });

      it("a MANUAL write always wins over a prior MANUAL record (re-adjustment)", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, manual(), "manual");
        const { record, preservedManual } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          manual({ polygon: AUTO_POLYGON }),
          "manual"
        );
        expect(preservedManual).toBe(false);
        expect(record.polygon).toEqual(AUTO_POLYGON);
      });

      it("one boundary per asset — a second write updates the same row, not a new one", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto(), "auto");
        const { record: second } = await boundaries.saveRespectingManual(
          projectId,
          assetId,
          manual(),
          "manual"
        );
        const first = await boundaries.findByAsset(assetId);
        expect(first?.id).toBe(second.id);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its boundary records", async () => {
        await boundaries.saveRespectingManual(projectId, assetId, auto(), "auto");
        await projects.delete(projectId);
        expect(await boundaries.findByAsset(assetId)).toBeNull();
      });
    });
  });
}
