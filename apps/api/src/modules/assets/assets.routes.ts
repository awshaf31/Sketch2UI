import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import imageSize from "image-size";
import { v4 as uuid } from "uuid";
import type { ProjectAsset } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { db } from "../../db/jsonStore.js";
import type { ProjectParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";

const ALLOWED_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

// image-size sniffs the real file format from content, ignoring the declared MIME type,
// and has unpatched DoS advisories in its ICNS/HEIF/JXL parsers (GHSA-w3rx-r6r6-pgpr,
// GHSA-5p2g-fcmc-qvqq). Verifying the magic bytes ourselves before calling it keeps a
// mislabeled malicious upload from ever reaching those code paths.
function detectRealImageType(buffer: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      cb(new Error("unsupported file type"));
      return;
    }
    cb(null, true);
  },
});

export const assetsRouter = Router({ mergeParams: true });

// POST /api/projects/:id/assets — plan section 18.2 & 19.1: validate upload, never trust the
// original filename, generate a server-side storage key, and decode dimensions before trusting them.
assetsRouter.post<ProjectParams>("/", upload.single("file"), (req, res) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  const file = req.file;
  if (!file) return sendError(res, 400, "VALIDATION_FAILED", "A file is required.");

  const realType = detectRealImageType(file.buffer);
  if (!realType || realType !== file.mimetype) {
    return sendError(res, 400, "INVALID_IMAGE", "File content does not match a supported image type.");
  }

  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(file.buffer);
  } catch {
    return sendError(res, 400, "INVALID_IMAGE", "The uploaded file could not be decoded as an image.");
  }
  if (!dimensions.width || !dimensions.height) {
    return sendError(res, 400, "INVALID_IMAGE", "The uploaded file could not be decoded as an image.");
  }

  const ext = ALLOWED_MIME[file.mimetype];
  const storageKey = `${uuid()}${ext}`;
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(env.uploadsDir, storageKey), file.buffer);

  const asset: ProjectAsset = {
    id: uuid(),
    projectId: project.id,
    storageKey,
    mimeType: file.mimetype,
    width: dimensions.width,
    height: dimensions.height,
    fileSize: file.size,
    createdAt: new Date().toISOString(),
  };

  db.state.assets.push(asset);
  db.save();
  res.status(201).json(asset);
});

// GET /api/projects/:id/assets
assetsRouter.get<ProjectParams>("/", (req, res) => {
  res.json(db.state.assets.filter((a) => a.projectId === req.params.id));
});
