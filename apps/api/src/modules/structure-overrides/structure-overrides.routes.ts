import { Router } from "express";
import type { StructureOverride } from "@sketch2ui/shared-types";
import { validateStructureOverride } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Per-node structure overrides — plan §17.3 Structure group.
//
// Mirrors the style/content/geometry override modules one-for-one: keyed on detection
// uuid, stored via StructureOverrideRepository, applied at generation time inside
// buildUITree (see packages/codegen/src/layout.ts resolveParent /
// reorderByStructureOverrides).
//
// The validator is shared with the browser via @sketch2ui/shared-types so the
// Inspector rejects a self-parent or a cycle before the request goes out — same
// pattern used by geometry, boundary parity, and code-validation. Cycle detection
// runs against the pending state (existing map merged with the proposed edit).

export const structureOverridesRouter = Router({ mergeParams: true });
structureOverridesRouter.use(requireProjectOwnership);
structureOverridesRouter.use(requirePageInProject);

interface OverrideParams extends PageParams {
  detectionId: string;
}

// GET /api/projects/:id/pages/:pageId/structure-overrides — full map for the page.
structureOverridesRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().structureOverrides.mapForPage(req.params.pageId));
  })
);

// PUT /api/projects/:id/structure-overrides/:detectionId — upsert.
// Body: { parentDetectionId?: string | null, displayOrder?: number }. Empty body is
// a delete (symmetric with the other Inspector groups' Reset flow).
//
// parentDetectionId must reference a currently ACTIVE detection in this project — a
// deleted/rejected parent is refused rather than silently dangling. The cycle check
// runs against the pending state, so a chained edit that would loop back gets a 400
// before it can land.
structureOverridesRouter.put<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const detection = await getRepositories().detections.findInPage(req.params.pageId, req.params.detectionId);
    if (!detection) return sendError(res, 404, "NOT_FOUND", "Detection not found on this page.");

    const [activeDetections, existing] = await Promise.all([
      getRepositories().detections.listActiveByPage(req.params.pageId),
      getRepositories().structureOverrides.mapForPage(req.params.pageId),
    ]);

    // Build the projected state — existing map plus this PUT overlaid — so the cycle
    // check reflects what would land, not what is already stored.
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

    const hasFields =
      result.override.parentDetectionId !== undefined ||
      result.override.displayOrder !== undefined;
    if (!hasFields) {
      // The repository detects this itself (put with an empty object).
      await getRepositories().structureOverrides.put(req.params.id, req.params.pageId, detection.id, result.override);
      return res.json({ detectionId: detection.id, structure: null });
    }

    // Record parent_changed / order_changed separately — a single PUT can carry both
    // fields, and the plan's §4.2 taxonomy treats them as distinct correction types
    // (a reader asking "why did the tree shape change" wants a different answer than
    // "why did the sibling order change"). `previous` is the PRE-write state, fetched
    // above alongside the cycle-check map.
    const previous = existing[detection.id];
    if (result.override.parentDetectionId !== undefined) {
      await getRepositories().corrections.append({
        projectId: req.params.id,
        pageId: req.params.pageId,
        detectionId: detection.id,
        type: "parent_changed",
        oldParentDetectionId: previous?.parentDetectionId,
        newParentDetectionId: result.override.parentDetectionId,
      });
    }
    if (result.override.displayOrder !== undefined) {
      await getRepositories().corrections.append({
        projectId: req.params.id,
        pageId: req.params.pageId,
        detectionId: detection.id,
        type: "order_changed",
        oldDisplayOrder: previous?.displayOrder,
        newDisplayOrder: result.override.displayOrder,
      });
    }

    const stored = await getRepositories().structureOverrides.put(req.params.id, req.params.pageId, detection.id, result.override);
    res.json({ detectionId: detection.id, structure: stored });
  })
);

// DELETE /api/projects/:id/pages/:pageId/structure-overrides/:detectionId — revert to
// auto inference. Idempotent: absent map or absent key both return 204.
structureOverridesRouter.delete<OverrideParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    await getRepositories().structureOverrides.remove(req.params.id, req.params.detectionId);
    res.status(204).send();
  })
);
