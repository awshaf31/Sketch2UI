import fs from "node:fs";
import path from "node:path";
import { v4 as uuid } from "uuid";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Detection, ProjectAsset } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { CropError, cropDetection, cropFromDecoded, decodeSourceImage } from "./crop.service.js";

// DEF-012 (docs/qa/MASTER_DEFECT_REGISTER.md): exports.routes.ts used to call
// cropDetection() — which re-opens and re-decodes the source file from disk — once
// per detection cropped from the same source image. decodeSourceImage()/
// cropFromDecoded() let a caller decode once and extract many crops instead. The one
// thing that refactor must not change is the actual output, so this file's main job
// is proving byte-for-byte equivalence, not just "it doesn't throw."

const WIDTH = 40;
const HEIGHT = 30;

function makeAsset(storageKey: string): ProjectAsset {
  return {
    id: uuid(),
    projectId: "test-project",
    pageId: "test-page",
    storageKey,
    mimeType: "image/png",
    width: WIDTH,
    height: HEIGHT,
    fileSize: 0,
    createdAt: new Date().toISOString(),
  };
}

function makeDetection(sourceAssetId: string, bbox: Detection["bbox"]): Detection {
  return {
    id: uuid(),
    projectId: "test-project",
    pageId: "test-page",
    sourceAssetId,
    className: "image",
    confidence: 0.9,
    bbox,
    status: "active",
    source: "model",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("crop.service — decode-once refactor (DEF-012)", () => {
  const writtenFiles: string[] = [];

  beforeAll(() => {
    fs.mkdirSync(env.uploadsDir, { recursive: true });
  });

  afterEach(() => {
    for (const f of writtenFiles.splice(0)) fs.rmSync(f, { force: true });
  });

  async function writeRealPng(): Promise<string> {
    const storageKey = `${uuid()}.png`;
    const filePath = path.join(env.uploadsDir, storageKey);
    // A real, decodable image — three horizontal color bands, distinct enough that
    // crops from different regions produce genuinely different bytes.
    const bandHeight = Math.floor(HEIGHT / 3);
    const buffer = Buffer.alloc(WIDTH * HEIGHT * 3);
    for (let y = 0; y < HEIGHT; y++) {
      const [r, g, b] = y < bandHeight ? [220, 40, 40] : y < bandHeight * 2 ? [40, 220, 40] : [40, 40, 220];
      for (let x = 0; x < WIDTH; x++) {
        const i = (y * WIDTH + x) * 3;
        buffer[i] = r;
        buffer[i + 1] = g;
        buffer[i + 2] = b;
      }
    }
    const png = await sharp(buffer, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } }).png().toBuffer();
    fs.writeFileSync(filePath, png);
    writtenFiles.push(filePath);
    return storageKey;
  }

  it("cropFromDecoded produces byte-identical output to cropDetection for the same detection", async () => {
    const storageKey = await writeRealPng();
    const asset = makeAsset(storageKey);
    const detection = makeDetection(asset.id, { x: 0.1, y: 0.1, width: 0.3, height: 0.3 });

    const viaOriginalPath = await cropDetection(detection, asset);
    const decoded = await decodeSourceImage(asset);
    const viaDecodedPath = await cropFromDecoded(decoded, detection, asset);

    expect(viaDecodedPath.equals(viaOriginalPath)).toBe(true);
  });

  it("reusing one decoded image produces correct, distinct crops for detections in different regions", async () => {
    const storageKey = await writeRealPng();
    const asset = makeAsset(storageKey);
    const topDetection = makeDetection(asset.id, { x: 0.1, y: 0.05, width: 0.3, height: 0.2 });
    const bottomDetection = makeDetection(asset.id, { x: 0.1, y: 0.75, width: 0.3, height: 0.2 });

    const decoded = await decodeSourceImage(asset);
    const [topCrop, bottomCrop] = await Promise.all([
      cropFromDecoded(decoded, topDetection, asset),
      cropFromDecoded(decoded, bottomDetection, asset),
    ]);

    expect(topCrop.equals(bottomCrop)).toBe(false);
    // Each should independently match what the un-refactored single-shot path produces.
    expect(topCrop.equals(await cropDetection(topDetection, asset))).toBe(true);
    expect(bottomCrop.equals(await cropDetection(bottomDetection, asset))).toBe(true);
  });

  it("decodeSourceImage throws CropError(NOT_FOUND) for a missing source file, same as cropDetection", async () => {
    const asset = makeAsset("does-not-exist.png");
    const detection = makeDetection(asset.id, { x: 0, y: 0, width: 0.5, height: 0.5 });

    await expect(decodeSourceImage(asset)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(cropDetection(detection, asset)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cropFromDecoded throws CropError(INVALID_IMAGE) for a degenerate box, same as cropDetection", async () => {
    const storageKey = await writeRealPng();
    // bboxToPixelRect clamps `left`/`top` defensively (never >= asset dimensions), so
    // a degenerate rect in practice comes from a corrupt/zero-dimension asset record,
    // not an extreme bbox — this reproduces that, matching bboxToPixelRect's own logic.
    const asset = { ...makeAsset(storageKey), width: 0, height: 0 };
    const detection = makeDetection(asset.id, { x: 0.1, y: 0.1, width: 0.3, height: 0.3 });

    const decoded = await decodeSourceImage(asset);
    await expect(cropFromDecoded(decoded, detection, asset)).rejects.toBeInstanceOf(CropError);
    await expect(cropDetection(detection, asset)).rejects.toBeInstanceOf(CropError);
  });
});
