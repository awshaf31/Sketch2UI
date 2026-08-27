import { Router } from "express";
import { effectiveBBox, validateGeometryOverride } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

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
geometryOverridesRouter.use(requireProjectOwnership);
geometryOverridesRouter.use(requirePageInProject);

interface OverrideParams extends PageParams {
  detectionId: string;
}

// GET /api/projects/:id/pages/:pageId/geometry-overrides — the full map for the page.
// Small enough to send at once and needed on workspace load, so no pagination.
geometryOverridesRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().geometryOverrides.mapForPage(req.params.pageId));
  })
);

// PUT /api/projects/:id/pages/:pageId/geometry-overrides/:detectionId — upsert.
// Body: { x?, y?, width?, height? }. Empty write (all fields blank/absent) is a
// delete, matching style/content Reset. Strict normalized validation runs against
// the detection's stored bbox so a partial override still satisfies the
// x+width <= 1 / y+height <= 1 invariant.
geometryOverridesRouter.put<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const detection = await getRepositories().detections.findInPage(req.params.pageId, req.params.detectionId);
    if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found on this page.");

    const result = validateGeometryOverride(req.body ?? {}, detection.bbox);
    if (!result.ok) {
      return sendError(res, 400, "VALIDATION_FAILED", result.error);
    }

    const hasFields = Object.keys(result.override).length > 0;
    if (!hasFields) {
      // Empty write → clear. Symmetric with the style/content Reset flow so a
      // client that sends `{}` gets a predictable revert to the raw detection bbox.
      // The repository detects this itself (put with an empty object).
      await getRepositories().geometryOverrides.put(req.params.id, req.params.pageId, detection.id, result.override);
      return res.json({ detectionId: detection.id, geometry: null });
    }

    // Correction history records the EFFECTIVE bbox change (base + previous override
    // -> base + new override), not the raw override object — that is what the box
    // visually moved from/to, which is what a reader of the history actually wants to
    // see (plan §4.1 oldBBox/newBBox). Fetched BEFORE the write, since it is the
    // pre-write state the correction needs.
    const previous = await getRepositories().geometryOverrides.findByDetection(req.params.id, detection.id);
    const oldEffective = effectiveBBox(detection.bbox, previous);

    const stored = await getRepositories().geometryOverrides.put(req.params.id, req.params.pageId, detection.id, result.override);

    await getRepositories().corrections.append({
      projectId: req.params.id,
      pageId: req.params.pageId,
      detectionId: detection.id,
      type: "bbox_changed",
      oldBBox: oldEffective,
      newBBox: effectiveBBox(detection.bbox, stored),
    });
    res.json({ detectionId: detection.id, geometry: stored });
  })
);

// DELETE /api/projects/:id/pages/:pageId/geometry-overrides/:detectionId — revert to
// the raw detection bbox. Idempotent: absent map or absent key both return 204.
geometryOverridesRouter.delete<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    await getRepositories().geometryOverrides.remove(req.params.id, req.params.detectionId);
    res.status(204).send();
  })
);
