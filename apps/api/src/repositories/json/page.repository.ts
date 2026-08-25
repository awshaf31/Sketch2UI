import { v4 as uuid } from "uuid";
import type { Page } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreatePageInput, PageRepository, UpdatePageInput } from "../types.js";

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonPageRepository implements PageRepository {
  async listByProject(projectId: string): Promise<Page[]> {
    return db.state.pages
      .filter((p) => p.projectId === projectId)
      .sort((a, b) => a.order - b.order)
      .map(detach);
  }

  async findById(id: string): Promise<Page | null> {
    const page = db.state.pages.find((p) => p.id === id);
    return page ? detach(page) : null;
  }

  async create(input: CreatePageInput): Promise<Page> {
    const existing = db.state.pages.filter((p) => p.projectId === input.projectId);
    const now = new Date().toISOString();
    const page: Page = {
      id: uuid(),
      projectId: input.projectId,
      name: input.name,
      order: existing.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    db.state.pages.push(page);
    db.save();
    return detach(page);
  }

  async update(id: string, patch: UpdatePageInput): Promise<Page | null> {
    const page = db.state.pages.find((p) => p.id === id);
    if (!page) return null;
    if (patch.name !== undefined) page.name = patch.name;
    page.updatedAt = new Date().toISOString();
    db.save();
    return detach(page);
  }

  async delete(id: string): Promise<boolean> {
    const page = db.state.pages.find((p) => p.id === id);
    if (!page) return false;

    const siblingCount = db.state.pages.filter((p) => p.projectId === page.projectId).length;
    if (siblingCount <= 1) return false;

    db.state.pages = db.state.pages.filter((p) => p.id !== id);
    // Cascade — JSON has no FK enforcement, so every page-owned domain is filtered
    // here explicitly (mirrors ProjectRepository.delete's cascade list).
    db.state.assets = db.state.assets.filter((a) => a.pageId !== id);
    db.state.detections = db.state.detections.filter((d) => d.pageId !== id);
    db.state.codeVersions = db.state.codeVersions.filter((c) => c.pageId !== id);
    db.state.jobs = db.state.jobs.filter((j) => j.pageId !== id);
    db.state.pageBoundaries = db.state.pageBoundaries.filter((b) => b.pageId !== id);
    db.state.correctionRecords = db.state.correctionRecords.filter((r) => r.pageId !== id);
    db.save();
    return true;
  }

  async setActiveCodeVersion(pageId: string, codeVersionId: string): Promise<void> {
    const page = db.state.pages.find((p) => p.id === pageId);
    if (!page) return;
    page.activeCodeVersionId = codeVersionId;
    page.updatedAt = new Date().toISOString();
    db.save();
  }
}
