import type { GeometryOverride } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { GeometryOverrideRepository } from "../types.js";

/**
 * JSON-backed GeometryOverrideRepository — Phase 8 compatibility adapter.
 * Same shape as style-override.repository.ts; see its doc comment.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonGeometryOverrideRepository implements GeometryOverrideRepository {
  async mapForProject(projectId: string): Promise<Record<string, GeometryOverride>> {
    const project = db.state.projects.find((p) => p.id === projectId);
    return project?.geometryOverrides ? detach(project.geometryOverrides) : {};
  }

  async findByDetection(projectId: string, detectionId: string): Promise<GeometryOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    const value = project?.geometryOverrides?.[detectionId];
    return value ? detach(value) : null;
  }

  async put(projectId: string, detectionId: string, value: GeometryOverride): Promise<GeometryOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return null;

    if (Object.keys(value).length === 0) {
      if (project.geometryOverrides) delete project.geometryOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
      return null;
    }

    project.geometryOverrides = project.geometryOverrides ?? {};
    project.geometryOverrides[detectionId] = detach(value);
    project.updatedAt = new Date().toISOString();
    db.save();
    return detach(value);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (project?.geometryOverrides?.[detectionId] !== undefined) {
      delete project.geometryOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
    }
  }
}
