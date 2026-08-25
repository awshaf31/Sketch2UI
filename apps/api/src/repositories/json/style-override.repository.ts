import { db } from "../../db/jsonStore.js";
import type { StyleOverrideRepository } from "../types.js";

/**
 * JSON-backed StyleOverrideRepository — Phase 8 compatibility adapter.
 *
 * Storage is unchanged from before the migration: the map lives on `project.styleOverrides`,
 * keyed on detection uuid. `put` with an empty object is a delete — the Reset flow every
 * override group shares (see OverrideRepository's doc comment in types.ts).
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonStyleOverrideRepository implements StyleOverrideRepository {
  async mapForProject(projectId: string): Promise<Record<string, Record<string, string>>> {
    const project = db.state.projects.find((p) => p.id === projectId);
    return project?.styleOverrides ? detach(project.styleOverrides) : {};
  }

  async mapForPage(pageId: string): Promise<Record<string, Record<string, string>>> {
    const page = db.state.pages.find((p) => p.id === pageId);
    if (!page) return {};
    const project = db.state.projects.find((p) => p.id === page.projectId);
    const fullMap = project?.styleOverrides ?? {};
    const pageDetectionIds = new Set(
      db.state.detections.filter((d) => d.pageId === pageId).map((d) => d.id)
    );
    return detach(
      Object.fromEntries(Object.entries(fullMap).filter(([detectionId]) => pageDetectionIds.has(detectionId)))
    );
  }

  async findByDetection(projectId: string, detectionId: string): Promise<Record<string, string> | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    const value = project?.styleOverrides?.[detectionId];
    return value ? detach(value) : null;
  }

  async put(
    projectId: string,
    _pageId: string,
    detectionId: string,
    value: Record<string, string>
  ): Promise<Record<string, string> | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return null;

    if (Object.keys(value).length === 0) {
      if (project.styleOverrides) delete project.styleOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
      return null;
    }

    project.styleOverrides = project.styleOverrides ?? {};
    project.styleOverrides[detectionId] = detach(value);
    project.updatedAt = new Date().toISOString();
    db.save();
    return detach(value);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (project?.styleOverrides?.[detectionId] !== undefined) {
      delete project.styleOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
    }
  }
}
