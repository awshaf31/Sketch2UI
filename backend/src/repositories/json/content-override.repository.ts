import type { ContentOverride } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { ContentOverrideRepository } from "../types.js";

/**
 * JSON-backed ContentOverrideRepository — Phase 8 compatibility adapter.
 *
 * "Empty" is domain-specific here: `contentState` is server-controlled and always
 * present on a non-empty value, so emptiness means none of text/altText/href were
 * set — matching content-overrides.routes.ts's `fieldsSeen.size === 0` check.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

function isEmpty(value: ContentOverride): boolean {
  return value.text === undefined && value.altText === undefined && value.href === undefined;
}

export class JsonContentOverrideRepository implements ContentOverrideRepository {
  async mapForProject(projectId: string): Promise<Record<string, ContentOverride>> {
    const project = db.state.projects.find((p) => p.id === projectId);
    return project?.contentOverrides ? detach(project.contentOverrides) : {};
  }

  async mapForPage(pageId: string): Promise<Record<string, ContentOverride>> {
    const page = db.state.pages.find((p) => p.id === pageId);
    if (!page) return {};
    const project = db.state.projects.find((p) => p.id === page.projectId);
    const fullMap = project?.contentOverrides ?? {};
    const pageDetectionIds = new Set(
      db.state.detections.filter((d) => d.pageId === pageId).map((d) => d.id)
    );
    return detach(
      Object.fromEntries(Object.entries(fullMap).filter(([detectionId]) => pageDetectionIds.has(detectionId)))
    );
  }

  async findByDetection(projectId: string, detectionId: string): Promise<ContentOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    const value = project?.contentOverrides?.[detectionId];
    return value ? detach(value) : null;
  }

  async put(
    projectId: string,
    _pageId: string,
    detectionId: string,
    value: ContentOverride
  ): Promise<ContentOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return null;

    if (isEmpty(value)) {
      if (project.contentOverrides) delete project.contentOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
      return null;
    }

    project.contentOverrides = project.contentOverrides ?? {};
    project.contentOverrides[detectionId] = detach(value);
    project.updatedAt = new Date().toISOString();
    db.save();
    return detach(value);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (project?.contentOverrides?.[detectionId] !== undefined) {
      delete project.contentOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
    }
  }
}
