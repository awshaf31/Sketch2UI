import { Router } from "express";
import type { Detection } from "@sketch2ui/shared-types";
import type { DetectionParams, PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { sendError } from "../../middleware/apiError.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

export const detectionsRouter = Router({ mergeParams: true });
detectionsRouter.use(requireProjectOwnership);
detectionsRouter.use(requirePageInProject);

// GET /api/projects/:id/pages/:pageId/detections — plan section 18.4.
// Returns manual and model detections together; the client tells them apart via `source`.
detectionsRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().detections.listByPage(req.params.pageId));
  })
);

// POST /api/projects/:id/pages/:pageId/detections — manual annotation creation
// (source: "manual"). Uses the same repository the model detect job writes through,
// so both produce identical records.
detectionsRouter.post<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    const { className, bbox, sourceAssetId } = req.body ?? {};
    if (!className || !bbox || !sourceAssetId) {
      return sendError(res, 400, "VALIDATION_FAILED", "className, bbox and sourceAssetId are required.");
    }

    const detection = await getRepositories().detections.create({
      projectId: req.params.id,
      pageId: req.params.pageId,
      sourceAssetId,
      className,
      bbox,
      source: "manual",
    });
    await getRepositories().corrections.append({
      projectId: req.params.id,
      pageId: req.params.pageId,
      detectionId: detection.id,
      type: "created",
      newClassName: detection.className,
      newBBox: detection.bbox,
    });
    res.status(201).json(detection);
  })
);

// PATCH /api/projects/:id/pages/:pageId/detections/:detectionId — plan section 18.5
//
// The model->manual flip and originalClassName capture now live in
// DetectionRepository.updateInPage() (Phase 8 amendment, Phase D3 page-scoping) — this
// handler only builds the patch and turns the returned classChanged/bboxChanged flags
// into correction records.
detectionsRouter.patch<DetectionParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const { className, x, y, width, height, status } = req.body ?? {};

    // All-or-nothing: a partial bbox (e.g. only `x`) is not applied, matching the
    // pre-migration behaviour.
    const editedBox = [x, y, width, height].every((v) => typeof v === "number");

    const result = await getRepositories().detections.updateInPage(req.params.pageId, req.params.detectionId, {
      ...(typeof className === "string" ? { className } : {}),
      ...(editedBox ? { bbox: { x, y, width, height } } : {}),
      ...(typeof status === "string" ? { status: status as Detection["status"] } : {}),
    });
    if (!result) return sendError(res, 404, "NOT_FOUND", "Detection not found.");

    // Recorded AFTER the repository's flip so class_changed/bbox_changed rows reflect
    // the corrected detection's final className/bbox, not an intermediate state.
    if (result.classChanged) {
      await getRepositories().corrections.append({
        projectId: result.detection.projectId,
        pageId: result.detection.pageId,
        detectionId: result.detection.id,
        type: "class_changed",
        oldClassName: result.previous.className,
        newClassName: result.detection.className,
      });
    }
    if (result.bboxChanged) {
      await getRepositories().corrections.append({
        projectId: result.detection.projectId,
        pageId: result.detection.pageId,
        detectionId: result.detection.id,
        type: "bbox_changed",
        oldBBox: result.previous.bbox,
        newBBox: result.detection.bbox,
      });
    }

    res.json(result.detection);
  })
);

// DELETE /api/projects/:id/pages/:pageId/detections/:detectionId
detectionsRouter.delete<DetectionParams>(
  "/:detectionId",
  asyncHandler(async (req, res) => {
    const deleted = await getRepositories().detections.deleteInPage(req.params.pageId, req.params.detectionId);
    if (!deleted) return sendError(res, 404, "NOT_FOUND", "Detection not found.");

    // Snapshot of the removed row — repository already deleted it, so this is the
    // last chance to record what it was.
    await getRepositories().corrections.append({
      projectId: deleted.projectId,
      pageId: deleted.pageId,
      detectionId: deleted.id,
      type: "deleted",
      oldClassName: deleted.className,
      oldBBox: deleted.bbox,
    });

    res.status(204).send();
  })
);
