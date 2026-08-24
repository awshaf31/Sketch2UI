import { Router } from "express";
import type { StructureOverride } from "@sketch2ui/shared-types";
import { validateStructureOverride } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";
import { recordCorrection } from "../corrections/corrections.service.js";

// Per-node structure overrides — plan §17.3 Structure group.
//
// Mirrors the style/content/geometry override modules one-for-one: keyed on detection
// uuid, stored on project.structureOverrides, applied at generation time inside
// buildUITree (see packages/codegen/src/layout.ts resolveParent /
// reorderByStructureOverrides).
//
// The validator is shared with the browser via @sketch2ui/shared-types so the
// Inspector rejects a self-parent or a cycle before the request goes out — same
// pattern used by geometry, boundary parity, and code-validation. Cycle detection
// runs against the pending state (existing map merged with the proposed edit).

export const structureOverridesRouter = Router({ mergeParams: true });

interface OverrideParams extends ProjectParams {
  detectionId: string;
}

// GET /api/projects/:id/structure-overrides — full map for the project.
structureOverridesRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  res.json(project.structureOverrides ?? {});
});

// PUT /api/projects/:id/structure-overrides/:detectionId — upsert.
// Body: { parentDetectionId?: string | null, displayOrder?: number }. Empty body is
// a delete (symmetric with the other Inspector groups' Reset flow).
//
// parentDetectionId must reference a currently ACTIVE detection in this project — a
// deleted/rejected parent is refused rather than silently dangling. The cycle check
// runs against the pending state, so a chained edit that would loop back gets a 400
// before it can land.
structureOverridesRouter.put<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const detection = db.state.detections.find(
    (d) => d.id === req.params.detectionId && d.projectId === project.id
  );
  if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found in this project.");

  const activeDetections = db.state.detections.filter(
    (d) => d.projectId === project.id && d.status === "active"
  );

  // Build the projected state — existing map plus this PUT overlaid — so the cycle
  // check reflects what would land, not what is already stored.
  const existing = project.structureOverrides ?? {};
  const proposed: Record<string, StructureOverride> = { ...existing };
  const parsedBody = (req.body ?? {}) as Record<string, unknown>;
  // Preview the resulting map entry so validateStructureOverride can walk from it.
  // Anything the validator rejects will prevent the actual write below.
  const previewCandidate: StructureOverride = {};
  if ("parentDetectionId" in parsedBody) {
    const v = parsedBody.parentDetectionId;
    if (v === null || typeof v === "string") previewCandidate.parentDetectionId = v;
  }
  if ("displayOrder" in parsedBody) {
    const v = parsedBody.displayOrder;
    if (typeof v === "number") previewCandidate.displayOrder = v;
  }
  proposed[detection.id] = previewCandidate;

  const result = validateStructureOverride(
    req.body ?? {},
    detection.id,
    activeDetections,
    proposed
  );
  if (!result.ok) {
    return sendError(res, 400, "VALIDATION_FAILED", result.error);
  }

  project.structureOverrides = project.structureOverrides ?? {};
  const hasFields =
    result.override.parentDetectionId !== undefined ||
    result.override.displayOrder !== undefined;
  if (!hasFields) {
    delete project.structureOverrides[detection.id];
    project.updatedAt = new Date().toISOString();
    db.save();
    return res.json({ detectionId: detection.id, structure: null });
  }

  // Record parent_changed / order_changed separately — a single PUT can carry both
  // fields, and the plan's §4.2 taxonomy treats them as distinct correction types
  // (a reader asking "why did the tree shape change" wants a different answer than
  // "why did the sibling order change").
  const previous = existing[detection.id];
  if (result.override.parentDetectionId !== undefined) {
    recordCorrection({
      projectId: project.id,
      detectionId: detection.id,
      type: "parent_changed",
      oldParentDetectionId: previous?.parentDetectionId,
      newParentDetectionId: result.override.parentDetectionId,
    });
  }
  if (result.override.displayOrder !== undefined) {
    recordCorrection({
      projectId: project.id,
      detectionId: detection.id,
      type: "order_changed",
      oldDisplayOrder: previous?.displayOrder,
      newDisplayOrder: result.override.displayOrder,
    });
  }

  project.structureOverrides[detection.id] = result.override;
  project.updatedAt = new Date().toISOString();
  db.save();
  res.json({ detectionId: detection.id, structure: result.override });
});

// DELETE /api/projects/:id/structure-overrides/:detectionId — revert to auto
// inference. Idempotent: absent map or absent key both return 204.
structureOverridesRouter.delete<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  if (project.structureOverrides) {
    delete project.structureOverrides[req.params.detectionId];
    project.updatedAt = new Date().toISOString();
    db.save();
  }
  res.status(204).send();
});
