import { Router } from "express";
import { v4 as uuid } from "uuid";
import type { TrainingSample, TrainingSampleBox } from "@sketch2ui/shared-types";
import { splitForKey } from "@sketch2ui/shared-types";
import type { PageParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { getRepositories } from "../../repositories/index.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Training feedback loop — plan section 36, FR-11 (§3.11), section 8.8
// (training_samples), section 22.1 (quality-check before a dataset version).

export const trainingRouter = Router({ mergeParams: true });
trainingRouter.use(requireProjectOwnership);
trainingRouter.use(requirePageInProject);

interface AssetParams extends PageParams {
  assetId: string;
}

// POST /api/projects/:id/pages/:pageId/assets/:assetId/approve-training
//
// Explicit human approval — section 8.8's `approved` flag exists precisely so this is a
// deliberate action, not inferred from data state. Both manual and model detections are
// captured: after correction the user has vouched for both equally, which is the whole
// point of the section 36 loop.
trainingRouter.post<AssetParams>(
  "/",
  asyncHandler(async (req, res) => {
    const asset = await getRepositories().assets.findById(req.params.assetId);
    if (!asset || asset.pageId !== req.params.pageId) {
      return sendError(res, 404, "NOT_FOUND", "Asset not found for this page.");
    }

    const active = await getRepositories().detections.listActiveByAsset(asset.id);

    if (active.length === 0) {
      return sendError(
        res,
        400,
        "VALIDATION_FAILED",
        "Nothing to approve — this asset has no active detections."
      );
    }

    const boxes: TrainingSampleBox[] = active.map((d) => ({
      className: d.className,
      bbox: d.bbox,
      source: d.source,
      ...(d.modelVersionId ? { modelVersionId: d.modelVersionId } : {}),
      // Carry the correction signal forward — see TrainingSampleBox.originalClassName.
      // Without this, an approved box that was corrected is indistinguishable from one
      // drawn from scratch once this snapshot is taken.
      ...(d.originalClassName ? { originalClassName: d.originalClassName } : {}),
    }));

    const now = new Date().toISOString();
    const sample: TrainingSample = {
      id: uuid(),
      projectId: req.params.id,
      imageAssetId: asset.id,
      storageKey: asset.storageKey,
      approved: true,
      approvedAt: now,
      // Same deterministic hash the exporter uses — one source of truth, so an approved
      // sample lands in the same split however it is reached.
      datasetSplit: splitForKey(asset.id),
      boxes,
      imageWidth: asset.width,
      imageHeight: asset.height,
      createdAt: now,
    };

    // Re-approving supersedes the previous snapshot for this asset rather than stacking
    // duplicates — the exporter would otherwise emit the same image twice. The
    // repository owns this (see training.repository.ts's doc comments).
    const { replacedPrevious } = await getRepositories().training.upsertApproval(sample);

    await getRepositories().auditLogs.record({
      event: "training_approved",
      userId: req.userId!,
      targetType: "project",
      targetId: req.params.id,
      metadata: { assetId: asset.id, boxCount: sample.boxes.length, datasetSplit: sample.datasetSplit },
    });

    res.status(201).json({
      id: sample.id,
      approved: sample.approved,
      datasetSplit: sample.datasetSplit,
      boxCount: sample.boxes.length,
      replacedPrevious,
    });
  })
);

// GET /api/projects/:id/assets/:assetId/approve-training — current approval state.
trainingRouter.get<AssetParams>(
  "/",
  asyncHandler(async (req, res) => {
    const sample = await getRepositories().training.findByAsset(req.params.assetId);
    if (!sample) return res.json({ approved: false });
    res.json({
      approved: sample.approved,
      approvedAt: sample.approvedAt,
      datasetSplit: sample.datasetSplit,
      boxCount: sample.boxes.length,
    });
  })
);
