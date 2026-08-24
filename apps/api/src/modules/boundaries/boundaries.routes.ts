import { Router } from "express";
import type { PageBoundary } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import { getBoundary, saveBoundary, toPageBoundary } from "./boundaries.service.js";

// GET/PUT /api/projects/:id/assets/:assetId/page-boundary — plan §10.6 Strategy C.

export const boundariesRouter = Router({ mergeParams: true });

interface AssetParams extends Record<string, string> {
  id: string;
  assetId: string;
}

boundariesRouter.get<AssetParams>("/", (req, res) => {
  const record = getBoundary(req.params.assetId);
  if (!record) return res.json({ boundary: null, source: null });
  res.json({ boundary: toPageBoundary(record), source: record.source });
});

/** A user adjustment. Always wins, and marks the asset user-owned from then on. */
boundariesRouter.put<AssetParams>("/", (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const asset = db.state.assets.find(
    (a) => a.id === req.params.assetId && a.projectId === project.id
  );
  if (!asset) return sendError(res, 404, "NOT_FOUND", "Asset not found for this project.");

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

  const { record } = saveBoundary(
    project.id,
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
});
