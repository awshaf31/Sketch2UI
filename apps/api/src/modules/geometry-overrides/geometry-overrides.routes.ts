import { Router } from "express";
import { validateGeometryOverride } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";

// Per-node geometry overrides — plan §17.3 Geometry group.
//
// Mirrors style-overrides.routes.ts and content-overrides.routes.ts one-for-one:
// keyed on detection uuid, stored on project.geometryOverrides, applied at
// generation time (see packages/codegen's generateCode + geometry-override.ts).
// The validator lives in shared-types so the browser could apply the same rule
// before making the request — matches how the boundary-parity + code-validation
// utilities are shared across web/api. Runs against the DETECTION's current bbox
// so a partial override still satisfies `x + width <= 1` under mixed override + base
// values.

export const geometryOverridesRouter = Router({ mergeParams: true });

interface OverrideParams extends ProjectParams {
  detectionId: string;
}

// GET /api/projects/:id/geometry-overrides — the full map for the project. Small
// enough to send at once and needed on workspace load, so no pagination.
geometryOverridesRouter.get<ProjectParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  res.json(project.geometryOverrides ?? {});
});

// PUT /api/projects/:id/geometry-overrides/:detectionId — upsert.
// Body: { x?, y?, width?, height? }. Empty write (all fields blank/absent) is a
// delete, matching style/content Reset. Strict normalized validation runs against
// the detection's stored bbox so a partial override still satisfies the
// x+width <= 1 / y+height <= 1 invariant.
geometryOverridesRouter.put<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const detection = db.state.detections.find(
    (d) => d.id === req.params.detectionId && d.projectId === project.id
  );
  if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found in this project.");

  const result = validateGeometryOverride(req.body ?? {}, detection.bbox);
  if (!result.ok) {
    return sendError(res, 400, "VALIDATION_FAILED", result.error);
  }

  project.geometryOverrides = project.geometryOverrides ?? {};
  const hasFields = Object.keys(result.override).length > 0;
  if (!hasFields) {
    // Empty write → clear. Symmetric with the style/content Reset flow so a
    // client that sends `{}` gets a predictable revert to the raw detection bbox.
    delete project.geometryOverrides[detection.id];
    project.updatedAt = new Date().toISOString();
    db.save();
    return res.json({ detectionId: detection.id, geometry: null });
  }

  project.geometryOverrides[detection.id] = result.override;
  project.updatedAt = new Date().toISOString();
  db.save();
  res.json({ detectionId: detection.id, geometry: result.override });
});

// DELETE /api/projects/:id/geometry-overrides/:detectionId — revert to the raw
// detection bbox. Idempotent: absent map or absent key both return 204.
geometryOverridesRouter.delete<OverrideParams>("/:detectionId", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
  if (project.geometryOverrides) {
    delete project.geometryOverrides[req.params.detectionId];
    project.updatedAt = new Date().toISOString();
    db.save();
  }
  res.status(204).send();
});
