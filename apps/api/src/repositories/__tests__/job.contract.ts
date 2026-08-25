import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRepository, JobRepository, ProjectRepository } from "../types.js";

/**
 * JobRepository CONTRACT — Phase 8 amendment §16.
 *
 * Weighted toward `failOrphaned` (plan §27's in-process job semantics: a restart
 * abandons anything mid-flight) and `update`'s missing-job no-op contract, since
 * server startup calls `failOrphaned` unconditionally and must never throw.
 */

export function runJobRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    jobs: JobRepository;
    projects: ProjectRepository;
    assets: AssetRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`JobRepository contract — ${name}`, () => {
    let jobs: JobRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let assetId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      jobs = repos.jobs;
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

    describe("create", () => {
      it("defaults to status/stage 'queued' and progress 0", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        expect(job.status).toBe("queued");
        expect(job.stage).toBe("queued");
        expect(job.progress).toBe(0);
      });

      it("carries an optional sourceAssetId", async () => {
        const job = await jobs.create({ projectId, type: "detect", sourceAssetId: assetId });
        expect(job.sourceAssetId).toBe(assetId);
      });

      it("omits sourceAssetId when not given", async () => {
        const job = await jobs.create({ projectId, type: "codegen" });
        expect(job.sourceAssetId).toBeUndefined();
      });
    });

    describe("findById", () => {
      it("returns the job", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        expect((await jobs.findById(job.id))?.id).toBe(job.id);
      });

      it("returns null for a missing id", async () => {
        expect(await jobs.findById("nope")).toBeNull();
      });

      it("returns a DETACHED copy", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        const found = await jobs.findById(job.id);
        (found as { status: string }).status = "completed";
        expect((await jobs.findById(job.id))?.status).toBe("queued");
      });
    });

    describe("update", () => {
      it("patches only the given fields and stamps updatedAt", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        const updated = await jobs.update(job.id, { status: "processing", stage: "preprocessing", progress: 10 });
        expect(updated?.status).toBe("processing");
        expect(updated?.stage).toBe("preprocessing");
        expect(updated?.progress).toBe(10);
      });

      it("round-trips the completion payload — detectionCount, modelVersionId, pageBoundary, rejectedCount", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        const updated = await jobs.update(job.id, {
          status: "completed",
          stage: "completed",
          progress: 100,
          detectionCount: 5,
          modelVersionId: "v1.0.0",
          rejectedCount: 2,
          pageBoundary: {
            polygon: [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
            ],
            confidence: 0.9,
            method: "contour",
            areaFraction: 0.8,
            applied: true,
          },
        });
        expect(updated?.detectionCount).toBe(5);
        expect(updated?.modelVersionId).toBe("v1.0.0");
        expect(updated?.rejectedCount).toBe(2);
        expect(updated?.pageBoundary?.method).toBe("contour");
        expect(updated?.pageBoundary?.polygon).toEqual([
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ]);
      });

      it("round-trips the failure payload — errorCode, errorMessage, retryable", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        const updated = await jobs.update(job.id, {
          status: "failed",
          stage: "failed",
          errorCode: "WORKER_UNREACHABLE",
          errorMessage: "Could not reach the detection service.",
          retryable: true,
        });
        expect(updated?.errorCode).toBe("WORKER_UNREACHABLE");
        expect(updated?.errorMessage).toBe("Could not reach the detection service.");
        expect(updated?.retryable).toBe(true);
      });

      it("returns null and does not throw for a missing job", async () => {
        expect(await jobs.update("nope", { status: "completed" })).toBeNull();
      });

      it("persists the change", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        await jobs.update(job.id, { progress: 42 });
        expect((await jobs.findById(job.id))?.progress).toBe(42);
      });
    });

    describe("failOrphaned", () => {
      it("fails queued and processing jobs", async () => {
        const queued = await jobs.create({ projectId, type: "detect" });
        const processing = await jobs.create({ projectId, type: "detect" });
        await jobs.update(processing.id, { status: "processing", stage: "component_detection" });

        const count = await jobs.failOrphaned();
        expect(count).toBe(2);

        expect((await jobs.findById(queued.id))?.status).toBe("failed");
        expect((await jobs.findById(processing.id))?.status).toBe("failed");
      });

      it("marks failed jobs retryable with an INTERNAL error code", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        await jobs.failOrphaned();
        const reloaded = await jobs.findById(job.id);
        expect(reloaded?.errorCode).toBe("INTERNAL");
        expect(reloaded?.retryable).toBe(true);
        expect(reloaded?.stage).toBe("failed");
      });

      it("does NOT touch already-completed or already-failed jobs", async () => {
        const completed = await jobs.create({ projectId, type: "detect" });
        await jobs.update(completed.id, { status: "completed", stage: "completed", progress: 100 });
        const failed = await jobs.create({ projectId, type: "detect" });
        await jobs.update(failed.id, { status: "failed", stage: "failed", errorCode: "X", errorMessage: "x", retryable: false });

        const count = await jobs.failOrphaned();
        expect(count).toBe(0);
        expect((await jobs.findById(completed.id))?.status).toBe("completed");
        expect((await jobs.findById(failed.id))?.errorCode).toBe("X");
      });

      it("is safe to run when there is nothing orphaned", async () => {
        expect(await jobs.failOrphaned()).toBe(0);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its jobs", async () => {
        const job = await jobs.create({ projectId, type: "detect" });
        await projects.delete(projectId);
        expect(await jobs.findById(job.id)).toBeNull();
      });
    });
  });
}
