import { beforeEach, describe, expect, it } from "vitest";
import type { CodeVersionRepository, ProjectRepository } from "../types.js";

/**
 * CodeVersionRepository CONTRACT — Phase 8 amendment §12.
 *
 * Weighted toward IMMUTABILITY and version-number correctness: preview, export, and
 * the evaluation baseline all depend on a version's contents never changing once
 * created, and on `resolveActive` correctly preferring a pinned version over the
 * latest. Activating an old version must not mutate it — see the "activation" group.
 */

export function runCodeVersionRepositoryContract(
  name: string,
  makeRepositories: () => Promise<{
    codeVersions: CodeVersionRepository;
    projects: ProjectRepository;
  }>,
  reset: () => Promise<void> | void
): void {
  describe(`CodeVersionRepository contract — ${name}`, () => {
    let codeVersions: CodeVersionRepository;
    let projects: ProjectRepository;
    let projectId: string;

    const input = (over: Record<string, unknown> = {}) => ({
      projectId,
      source: "generated" as const,
      html: "<div>hi</div>",
      css: "div{color:red}",
      ...over,
    });

    beforeEach(async () => {
      await reset();
      const repos = await makeRepositories();
      codeVersions = repos.codeVersions;
      projects = repos.projects;
      projectId = (await projects.create({ name: "Host" })).id;
    });

    describe("create", () => {
      it("assigns versionNumber 1 to the first version", async () => {
        const v = await codeVersions.create(input());
        expect(v.versionNumber).toBe(1);
      });

      it("increments versionNumber per project", async () => {
        await codeVersions.create(input());
        await codeVersions.create(input());
        const v3 = await codeVersions.create(input());
        expect(v3.versionNumber).toBe(3);
      });

      it("numbers each project independently", async () => {
        const other = await projects.create({ name: "Other" });
        await codeVersions.create(input());
        const otherFirst = await codeVersions.create(input({ projectId: other.id }));
        expect(otherFirst.versionNumber).toBe(1);
      });

      it("round-trips html and css exactly", async () => {
        const v = await codeVersions.create(input({ html: "<p>x</p>", css: "p{}" }));
        expect(v.html).toBe("<p>x</p>");
        expect(v.css).toBe("p{}");
      });

      it("preserves source", async () => {
        const v = await codeVersions.create(input({ source: "edited" as const }));
        expect(v.source).toBe("edited");
      });

      it("carries metadata.assets forward when provided", async () => {
        const v = await codeVersions.create(input({ metadata: { assets: { "./a.png": "det-1" } } }));
        expect(v.metadata?.assets).toEqual({ "./a.png": "det-1" });
      });

      it("omits metadata when not provided", async () => {
        const v = await codeVersions.create(input());
        expect(v.metadata).toBeUndefined();
      });

      it("sets createdAt as an ISO string", async () => {
        const v = await codeVersions.create(input());
        expect(Number.isNaN(Date.parse(v.createdAt))).toBe(false);
      });
    });

    describe("findById", () => {
      it("returns the version scoped to its project", async () => {
        const v = await codeVersions.create(input());
        expect((await codeVersions.findById(projectId, v.id))?.id).toBe(v.id);
      });

      it("returns null when the version belongs to another project", async () => {
        const v = await codeVersions.create(input());
        const other = await projects.create({ name: "Other" });
        expect(await codeVersions.findById(other.id, v.id)).toBeNull();
      });

      it("returns null for a missing id", async () => {
        expect(await codeVersions.findById(projectId, "nope")).toBeNull();
      });
    });

    describe("listByProject", () => {
      it("returns versions NEWEST first", async () => {
        await codeVersions.create(input());
        await codeVersions.create(input());
        await codeVersions.create(input());
        const list = await codeVersions.listByProject(projectId);
        expect(list.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
      });

      it("scopes to the project", async () => {
        const other = await projects.create({ name: "Other" });
        await codeVersions.create(input());
        await codeVersions.create(input({ projectId: other.id }));
        expect(await codeVersions.listByProject(projectId)).toHaveLength(1);
      });

      it("returns an empty array for a project with no versions", async () => {
        expect(await codeVersions.listByProject(projectId)).toEqual([]);
      });
    });

    describe("immutability", () => {
      it("create never mutates a previously returned version", async () => {
        const v1 = await codeVersions.create(input({ html: "<a>1</a>" }));
        await codeVersions.create(input({ html: "<a>2</a>" }));
        const reloaded = await codeVersions.findById(projectId, v1.id);
        expect(reloaded?.html).toBe("<a>1</a>");
      });

      it("findById returns a DETACHED copy", async () => {
        const v = await codeVersions.create(input());
        const found = await codeVersions.findById(projectId, v.id);
        (found as { html: string }).html = "mutated";
        expect((await codeVersions.findById(projectId, v.id))?.html).toBe(v.html);
      });
    });

    describe("resolveActive", () => {
      it("returns null when the project has no versions", async () => {
        expect(await codeVersions.resolveActive(projectId)).toBeNull();
      });

      it("returns the latest version when nothing is pinned", async () => {
        await codeVersions.create(input());
        const v2 = await codeVersions.create(input());
        expect((await codeVersions.resolveActive(projectId))?.id).toBe(v2.id);
      });

      it("returns the PINNED version even when it is not the latest", async () => {
        const v1 = await codeVersions.create(input());
        await codeVersions.create(input());
        await projects.setActiveCodeVersion(projectId, v1.id);
        expect((await codeVersions.resolveActive(projectId))?.id).toBe(v1.id);
      });

      it("falls back to latest if the pinned version id is stale", async () => {
        await codeVersions.create(input());
        const v2 = await codeVersions.create(input());
        await projects.setActiveCodeVersion(projectId, "does-not-exist");
        expect((await codeVersions.resolveActive(projectId))?.id).toBe(v2.id);
      });
    });

    describe("cascade", () => {
      it("deleting the project removes its code versions", async () => {
        const v = await codeVersions.create(input());
        await projects.delete(projectId);
        expect(await codeVersions.findById(projectId, v.id)).toBeNull();
      });
    });
  });
}
