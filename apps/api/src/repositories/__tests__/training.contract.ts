import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRepository, ProjectRepository, TrainingRepository } from "../types.js";

/**
 * TrainingRepository CONTRACT — Phase 8 amendment §14.
 *
 * Weighted toward re-approval SUPERSEDING the previous snapshot rather than
 * stacking duplicates (plan §36) — including the id changing, since the caller
 * mints a fresh one per approval and a real replace must not silently keep the old
 * row's identity (see training.repository.ts's doc comments for why this is the one
 * place JSON and Prisma could quietly diverge).
 */

export function runTrainingRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    training: TrainingRepository;
    assets: AssetRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`TrainingRepository contract — ${name}`, () => {
    let training: TrainingRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let assetId: string;

    const sample = (over: Record<string, unknown> = {}) => ({
      id: "sample-1",
      projectId,
      imageAssetId: assetId,
      storageKey: "s.png",
      approved: true,
      approvedAt: new Date().toISOString(),
      datasetSplit: "train" as const,
      boxes: [{ className: "button", bbox: { x: 0, y: 0, width: 0.1, height: 0.1 }, source: "manual" as const }],
      imageWidth: 100,
      imageHeight: 100,
      createdAt: new Date().toISOString(),
      ...over,
    });

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      training = repos.training;
      projects = repos.projects;
      projectId = (await projects.create({ name: "Host" })).id;
      assetId = (
        await repos.assets.create({
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
      it("returns null when nothing is approved", async () => {
        expect(await training.findByAsset(assetId)).toBeNull();
      });

      it("returns the stored sample", async () => {
        await training.upsertApproval(sample());
        expect((await training.findByAsset(assetId))?.imageAssetId).toBe(assetId);
      });

      it("returns a DETACHED copy", async () => {
        await training.upsertApproval(sample());
        const found = await training.findByAsset(assetId);
        (found as { storageKey: string }).storageKey = "mutated.png";
        expect((await training.findByAsset(assetId))?.storageKey).toBe("s.png");
      });
    });

    describe("upsertApproval — first approval", () => {
      it("stores the sample and reports replacedPrevious: false", async () => {
        const { sample: stored, replacedPrevious } = await training.upsertApproval(sample());
        expect(replacedPrevious).toBe(false);
        expect(stored.approved).toBe(true);
        expect(stored.boxes).toHaveLength(1);
      });

      it("round-trips box fields exactly, including originalClassName", async () => {
        const { sample: stored } = await training.upsertApproval(
          sample({
            boxes: [
              {
                className: "select",
                bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
                source: "manual",
                modelVersionId: "v1.0.0",
                originalClassName: "input",
              },
            ],
          })
        );
        expect(stored.boxes[0]).toEqual({
          className: "select",
          bbox: { x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
          source: "manual",
          modelVersionId: "v1.0.0",
          originalClassName: "input",
        });
      });
    });

    describe("upsertApproval — re-approval", () => {
      it("SUPERSEDES the previous snapshot and reports replacedPrevious: true", async () => {
        await training.upsertApproval(sample({ id: "sample-1", boxes: [] }));
        const { sample: stored, replacedPrevious } = await training.upsertApproval(
          sample({ id: "sample-2", boxes: [{ className: "card", bbox: { x: 0, y: 0, width: 1, height: 1 }, source: "manual" as const }] })
        );
        expect(replacedPrevious).toBe(true);
        expect(stored.id).toBe("sample-2");
        expect(stored.boxes).toHaveLength(1);
      });

      it("does not leave a second row behind — findByAsset returns exactly the new one", async () => {
        await training.upsertApproval(sample({ id: "sample-1" }));
        await training.upsertApproval(sample({ id: "sample-2" }));
        const found = await training.findByAsset(assetId);
        expect(found?.id).toBe("sample-2");
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its training samples", async () => {
        await training.upsertApproval(sample());
        await projects.delete(projectId);
        expect(await training.findByAsset(assetId)).toBeNull();
      });
    });
  });
}
