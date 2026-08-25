import { Router } from "express";
import { effectiveBBox, validateGeometryOverride } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import type { ProjectParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

// Per-node geometry overrides — plan §17.3 Geometry group.
//
// Mirrors style-overrides.routes.ts and content-overrides.routes.ts one-for-one:
// keyed on detection uuid, stored via GeometryOverrideRepository, applied at
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
geometryOverridesRouter.get<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
    res.json(await getRepositories().geometryOverrides.mapForProject(project.id));
  })
);

// PUT /api/projects/:id/geometry-overrides/:detectionId — upsert.
// Body: { x?, y?, width?, height? }. Empty write (all fields blank/absent) is a
// delete, matching style/content Reset. Strict normalized validation runs against
// the detection's stored bbox so a partial override still satisfies the
// x+width <= 1 / y+height <= 1 invariant.
geometryOverridesRouter.put<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    const detection = await getRepositories().detections.findInProject(project.id, req.params.detectionId);
    if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found in this project.");

    const result = validateGeometryOverride(req.body ?? {}, detection.bbox);
    if (!result.ok) {
      return sendError(res, 400, "VALIDATION_FAILED", result.error);
    }

    const hasFields = Object.keys(result.override).length > 0;
    if (!hasFields) {
      // Empty write → clear. Symmetric with the style/content Reset flow so a
      // client that sends `{}` gets a predictable revert to the raw detection bbox.
      // The repository detects this itself (put with an empty object).
      await getRepositories().geometryOverrides.put(project.id, detection.id, result.override);
      return res.json({ detectionId: detection.id, geometry: null });
    }

    // Correction history records the EFFECTIVE bbox change (base + previous override
    // -> base + new override), not the raw override object — that is what the box
    // visually moved from/to, which is what a reader of the history actually wants to
    // see (plan §4.1 oldBBox/newBBox). Fetched BEFORE the write, since it is the
    // pre-write state the correction needs.
    const previous = await getRepositories().geometryOverrides.findByDetection(project.id, detection.id);
    const oldEffective = effectiveBBox(detection.bbox, previous);

    const stored = await getRepositories().geometryOverrides.put(project.id, detection.id, result.override);

    await getRepositories().corrections.append({
      projectId: project.id,
      detectionId: detection.id,
      type: "bbox_changed",
      oldBBox: oldEffective,
      newBBox: effectiveBBox(detection.bbox, stored),
    });
    res.json({ detectionId: detection.id, geometry: stored });
  })
);

// DELETE /api/projects/:id/geometry-overrides/:detectionId — revert to the raw
// detection bbox. Idempotent: absent map or absent key both return 204.
geometryOverridesRouter.delete<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");
    await getRepositories().geometryOverrides.remove(project.id, req.params.detectionId);
    res.status(204).send();
  })
);
