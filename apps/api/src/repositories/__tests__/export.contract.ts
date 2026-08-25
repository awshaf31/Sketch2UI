import { beforeEach, describe, expect, it } from "vitest";
import type { CodeVersionRepository, ExportRepository, ProjectRepository } from "../types.js";

/**
 * ExportRepository CONTRACT — Phase 8 amendment §15.
 *
 * Weighted toward `nextVersionNumber` and `create` being separate calls (the caller
 * needs the number to compute a file path before the ZIP finishes streaming — see
 * export.repository.ts's doc comment) and per-project numbering.
 */

export function runExportRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    exports: ExportRepository;
    codeVersions: CodeVersionRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`ExportRepository contract — ${name}`, () => {
    let exportsRepo: ExportRepository;
    let projects: ProjectRepository;
    let projectId: string;
    let codeVersionId: string;

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      exportsRepo = repos.exports;
      projects = repos.projects;

      projectId = (await projects.create({ name: "Host" })).id;
      codeVersionId = (
        await repos.codeVersions.create({
          projectId,
          source: "generated",
          html: "<div></div>",
          css: "",
        })
      ).id;
    });

    const input = (over: Record<string, unknown> = {}) => ({
      projectId,
      codeVersionId,
      versionNumber: 1,
      storagePath: "projects/p/exports/v1.zip",
      fileSize: 100,
      ...over,
    });

    describe("nextVersionNumber", () => {
      it("returns 1 for a project with no exports", async () => {
        expect(await exportsRepo.nextVersionNumber(projectId)).toBe(1);
      });

      it("increments as exports are created", async () => {
        await exportsRepo.create(input({ versionNumber: 1 }));
        expect(await exportsRepo.nextVersionNumber(projectId)).toBe(2);
      });

      it("numbers each project independently", async () => {
        const other = await projects.create({ name: "Other" });
        await exportsRepo.create(input({ versionNumber: 1 }));
        expect(await exportsRepo.nextVersionNumber(other.id)).toBe(1);
      });
    });

    describe("create", () => {
      it("stores and returns the record", async () => {
        const record = await exportsRepo.create(input({ storagePath: "p/v1.zip", fileSize: 555 }));
        expect(record.storagePath).toBe("p/v1.zip");
        expect(record.fileSize).toBe(555);
        expect(record.versionNumber).toBe(1);
      });

      it("sets createdAt as an ISO string", async () => {
        const record = await exportsRepo.create(input());
        expect(Number.isNaN(Date.parse(record.createdAt))).toBe(false);
      });
    });

    describe("findById", () => {
      it("returns the export", async () => {
        const record = await exportsRepo.create(input());
        expect((await exportsRepo.findById(record.id))?.id).toBe(record.id);
      });

      it("returns null for a missing id", async () => {
        expect(await exportsRepo.findById("nope")).toBeNull();
      });
    });

    describe("listByProject", () => {
      it("returns exports NEWEST first", async () => {
        await exportsRepo.create(input({ versionNumber: 1 }));
        await exportsRepo.create(input({ versionNumber: 2 }));
        await exportsRepo.create(input({ versionNumber: 3 }));
        const list = await exportsRepo.listByProject(projectId);
        expect(list.map((e) => e.versionNumber)).toEqual([3, 2, 1]);
      });

      it("scopes to the project", async () => {
        const other = await projects.create({ name: "Other" });
        await exportsRepo.create(input({ versionNumber: 1 }));
        await exportsRepo.create(input({ projectId: other.id, versionNumber: 1 }));
        expect(await exportsRepo.listByProject(projectId)).toHaveLength(1);
      });

      it("returns an empty array when nothing has been exported", async () => {
        expect(await exportsRepo.listByProject(projectId)).toEqual([]);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its export records", async () => {
        const record = await exportsRepo.create(input());
        await projects.delete(projectId);
        expect(await exportsRepo.findById(record.id)).toBeNull();
      });
    });
  });
}
