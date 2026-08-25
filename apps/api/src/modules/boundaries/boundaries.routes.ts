import { Router } from "express";
import type { PageBoundary } from "@sketch2ui/shared-types";
import type { PageParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getRepositories } from "../../repositories/index.js";
import { toPageBoundary } from "./boundaries.service.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// GET/PUT /api/projects/:id/pages/:pageId/assets/:assetId/page-boundary — plan §10.6
// Strategy C.

export const boundariesRouter = Router({ mergeParams: true });
boundariesRouter.use(requireProjectOwnership);
boundariesRouter.use(requirePageInProject);

interface AssetParams extends PageParams {
  assetId: string;
}

boundariesRouter.get<AssetParams>(
  "/",
  asyncHandler(async (req, res) => {
    const record = await getRepositories().boundaries.findByAsset(req.params.assetId);
    if (!record) return res.json({ boundary: null, source: null });
    res.json({ boundary: toPageBoundary(record), source: record.source });
  })
);

/** A user adjustment. Always wins, and marks the asset user-owned from then on. */
boundariesRouter.put<AssetParams>(
  "/",
  asyncHandler(async (req, res) => {
    const asset = await getRepositories().assets.findById(req.params.assetId);
    if (!asset || asset.pageId !== req.params.pageId) {
      return sendError(res, 404, "NOT_FOUND", "Asset not found for this page.");
    }

    const body = req.body as Partial<PageBoundary> | undefined;
    const polygon = body?.polygon;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return sendError(
        res,
        400,
        "VALIDATION_FAILED",
        "A boundary polygon of at least 3 points is required."
      );
    }
    const wellFormed = polygon.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((v) => typeof v === "number" && v >= 0 && v <= 1)
    );
    if (!wellFormed) {
      return sendError(
        res,
        400,
        "VALIDATION_FAILED",
        "Polygon points must be [x, y] pairs normalized to [0, 1]."
      );
    }

    const { record } = await getRepositories().boundaries.saveRespectingManual(
      req.params.id,
      req.params.pageId,
      asset.id,
      {
        polygon,
        confidence: 1,
        method: "manual",
        areaFraction: body?.areaFraction ?? 1,
        applied: true,
        overlapThreshold: body?.overlapThreshold ?? 0.5,
      },
      "manual"
    );

    res.json({ boundary: toPageBoundary(record), source: record.source });
  })
);
