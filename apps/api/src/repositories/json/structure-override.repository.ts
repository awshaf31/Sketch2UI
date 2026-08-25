import type { StructureOverride } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { StructureOverrideRepository } from "../types.js";

/**
 * JSON-backed StructureOverrideRepository — Phase 8 compatibility adapter.
 *
 * "Empty" here means neither field was touched: `parentDetectionId` may legitimately
 * be `null` (explicit root) as a NON-empty value, so emptiness is "both fields
 * undefined" — matching structure-overrides.routes.ts's `hasFields` check, not
 * `Object.keys(value).length === 0`.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

function isEmpty(value: StructureOverride): boolean {
  return value.parentDetectionId === undefined && value.displayOrder === undefined;
}

export class JsonStructureOverrideRepository implements StructureOverrideRepository {
  async mapForProject(projectId: string): Promise<Record<string, StructureOverride>> {
    const project = db.state.projects.find((p) => p.id === projectId);
    return project?.structureOverrides ? detach(project.structureOverrides) : {};
  }

  async findByDetection(projectId: string, detectionId: string): Promise<StructureOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    const value = project?.structureOverrides?.[detectionId];
    return value ? detach(value) : null;
  }

  async put(
    projectId: string,
    detectionId: string,
    value: StructureOverride
  ): Promise<StructureOverride | null> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (!project) return null;

    if (isEmpty(value)) {
      if (project.structureOverrides) delete project.structureOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
      return null;
    }

    project.structureOverrides = project.structureOverrides ?? {};
    project.structureOverrides[detectionId] = detach(value);
    project.updatedAt = new Date().toISOString();
    db.save();
    return detach(value);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    const project = db.state.projects.find((p) => p.id === projectId);
    if (project?.structureOverrides?.[detectionId] !== undefined) {
      delete project.structureOverrides[detectionId];
      project.updatedAt = new Date().toISOString();
      db.save();
    }
  }
}
