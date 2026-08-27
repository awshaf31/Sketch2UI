import { v4 as uuid } from "uuid";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CodeVersionRepository, CreateCodeVersionInput } from "../types.js";

/**
 * JSON-backed CodeVersionRepository — Phase 8 compatibility adapter.
 *
 * IMMUTABILITY. Rows are never updated in place — a hand-edit creates a new row with
 * source "edited" rather than mutating an existing one (see code-versions.routes.ts's
 * module comment). This adapter has no update/delete method for exactly that reason:
 * the interface itself makes the mutate-in-place bug impossible to write.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

/** Newest first — matches the existing listVersions() ordering the UI depends on. */
function sortNewestFirst(versions: CodeVersion[]): CodeVersion[] {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
}

export class JsonCodeVersionRepository implements CodeVersionRepository {
  async listByProject(projectId: string): Promise<CodeVersion[]> {
    return sortNewestFirst(db.state.codeVersions.filter((c) => c.projectId === projectId)).map(detach);
  }

  async listByPage(pageId: string): Promise<CodeVersion[]> {
    return sortNewestFirst(db.state.codeVersions.filter((c) => c.pageId === pageId)).map(detach);
  }

  async findById(projectId: string, versionId: string): Promise<CodeVersion | null> {
    const found = db.state.codeVersions.find((c) => c.id === versionId && c.projectId === projectId);
    return found ? detach(found) : null;
  }

  async findByPage(pageId: string, versionId: string): Promise<CodeVersion | null> {
    const found = db.state.codeVersions.find((c) => c.id === versionId && c.pageId === pageId);
    return found ? detach(found) : null;
  }

  async create(input: CreateCodeVersionInput): Promise<CodeVersion> {
    // Version numbers are per-PAGE (Phase D3) — the schema's unique constraint moved
    // from [projectId, versionNumber] to [pageId, versionNumber] to match.
    const existing = db.state.codeVersions.filter((c) => c.pageId === input.pageId);
    const version: CodeVersion = {
      id: uuid(),
      projectId: input.projectId,
      pageId: input.pageId,
      versionNumber: existing.length + 1,
      source: input.source,
      html: input.html,
      css: input.css,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      createdAt: new Date().toISOString(),
    };
    db.state.codeVersions.push(version);
    db.save();
    return detach(version);
  }

  async resolveActive(projectId: string): Promise<CodeVersion | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    const versions = sortNewestFirst(db.state.codeVersions.filter((c) => c.projectId === projectId));

    if (project?.activeCodeVersionId) {
      const pinned = versions.find((v) => v.id === project.activeCodeVersionId);
      if (pinned) return detach(pinned);
    }
    return versions[0] ? detach(versions[0]) : null;
  }

  async resolveActiveForPage(pageId: string): Promise<CodeVersion | null> {
    const page = db.state.pages.find((p) => p.id === pageId);
    const versions = sortNewestFirst(db.state.codeVersions.filter((c) => c.pageId === pageId));

    if (page?.activeCodeVersionId) {
      const pinned = versions.find((v) => v.id === page.activeCodeVersionId);
      if (pinned) return detach(pinned);
    }
    return versions[0] ? detach(versions[0]) : null;
  }
}
