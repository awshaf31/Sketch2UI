import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { BBox, Detection, ProjectAsset } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";

// Crop generation — plan §15.5 ("original extracted image crops").
//
// Shared by the live-preview crop route and the export ZIP builder so both produce
// byte-identical output for the same detection.

/** A little context around the box keeps strokes that sit right on the edge. */
const PADDING_RATIO = 0.02;
/** Below this a crop is a meaningless smudge; callers fall back to the placeholder. */
const MIN_CROP_PX = 8;

export class CropError extends Error {
  constructor(message: string, readonly code: "NOT_FOUND" | "INVALID_IMAGE") {
    super(message);
  }
}

/** Normalized bbox -> integer pixel rect, clamped inside the image. */
export function bboxToPixelRect(
  bbox: BBox,
  asset: Pick<ProjectAsset, "width" | "height">
): { left: number; top: number; width: number; height: number } {
  const padX = bbox.width * PADDING_RATIO;
  const padY = bbox.height * PADDING_RATIO;

  const x0 = Math.max(0, bbox.x - padX);
  const y0 = Math.max(0, bbox.y - padY);
  const x1 = Math.min(1, bbox.x + bbox.width + padX);
  const y1 = Math.min(1, bbox.y + bbox.height + padY);

  // Uses the asset's STORED dimensions (§8.4) rather than re-probing the file, so the
  // pixel maths matches the coordinate space the detections were recorded in.
  const left = Math.round(x0 * asset.width);
  const top = Math.round(y0 * asset.height);
  const width = Math.max(1, Math.round((x1 - x0) * asset.width));
  const height = Math.max(1, Math.round((y1 - y0) * asset.height));

  return {
    left: Math.min(left, Math.max(0, asset.width - 1)),
    top: Math.min(top, Math.max(0, asset.height - 1)),
    width: Math.min(width, asset.width - left),
    height: Math.min(height, asset.height - top),
  };
}

/** Whether a detection is big enough for a crop to be worth producing. */
export function isCroppable(detection: Detection, asset: ProjectAsset): boolean {
  const rect = bboxToPixelRect(detection.bbox, asset);
  return rect.width >= MIN_CROP_PX && rect.height >= MIN_CROP_PX;
}

/** Render one detection's region of the source sketch as PNG bytes. */
export async function cropDetection(
  detection: Detection,
  asset: ProjectAsset
): Promise<Buffer> {
  const sourcePath = path.join(env.uploadsDir, asset.storageKey);
  if (!fs.existsSync(sourcePath)) {
    throw new CropError("Source image is missing from storage.", "NOT_FOUND");
  }

  const rect = bboxToPixelRect(detection.bbox, asset);
  if (rect.width < 1 || rect.height < 1) {
    throw new CropError("Detection region is degenerate.", "INVALID_IMAGE");
  }

  try {
    return await sharp(sourcePath).extract(rect).png().toBuffer();
  } catch (cause) {
    throw new CropError(
      `Could not crop the source image: ${cause instanceof Error ? cause.message : "unknown"}`,
      "INVALID_IMAGE"
    );
  }
}
