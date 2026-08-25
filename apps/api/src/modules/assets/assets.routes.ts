import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer, { MulterError } from "multer";
import imageSize from "image-size";
import { v4 as uuid } from "uuid";
import { env } from "../../config/env.js";
import type { PageParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { getRepositories } from "../../repositories/index.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

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

// QA audit DEF-004 (docs/qa/MASTER_DEFECT_REGISTER.md): `upload.single("file")` is
// plain Express middleware (callback-style `next(err)`, not the async/await style
// `asyncHandler` wraps), so a multer-level rejection — an oversized file
// (`MulterError`, code `LIMIT_FILE_SIZE`) or an unsupported MIME type (the plain
// `Error` thrown by `fileFilter` above) — used to skip straight past every route
// handler and land in the catch-all `errorHandler`, which answers every unhandled
// error with a generic `500 INTERNAL "An unexpected server error occurred."` This
// misrepresented an ordinary client input-validation failure as a server crash (wrong
// status code, no actionable message) — placed directly after `upload.single`, this
// intercepts exactly those two multer-level failures and reports them the same way
// every other validation failure in this router already does; anything else is passed
// through unchanged to the real error handler.
function handleUploadError(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      sendError(res, 413, "VALIDATION_FAILED", `File is too large — the limit is ${MAX_SIZE_BYTES / (1024 * 1024)}MB.`);
      return;
    }
    sendError(res, 400, "VALIDATION_FAILED", `Upload failed: ${err.message}.`);
    return;
  }
  if (err instanceof Error && err.message === "unsupported file type") {
    sendError(res, 400, "VALIDATION_FAILED", "Unsupported file type — PNG, JPEG, or WebP only.");
    return;
  }
  next(err);
}

export const assetsRouter = Router({ mergeParams: true });
assetsRouter.use(requireProjectOwnership);
assetsRouter.use(requirePageInProject);

// POST /api/projects/:id/pages/:pageId/assets — plan section 18.2 & 19.1: validate
// upload, never trust the original filename, generate a server-side storage key, and
// decode dimensions before trusting them.
assetsRouter.post<PageParams>(
  "/",
  upload.single("file"),
  handleUploadError,
  asyncHandler(async (req, res) => {
  const repos = getRepositories();

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
  // The file is written before the row is created, so a failed insert leaves an orphan
  // file rather than a row pointing at nothing. That is the same ordering the previous
  // implementation used, and it is the right way round: a stray byte blob is harmless,
  // a dangling storageKey breaks every consumer that tries to read it.
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  fs.writeFileSync(path.join(env.uploadsDir, storageKey), file.buffer);

  const asset = await repos.assets.create({
    projectId: req.params.id,
    pageId: req.params.pageId,
    storageKey,
    mimeType: file.mimetype,
    width: dimensions.width,
    height: dimensions.height,
    fileSize: file.size,
  });

  res.status(201).json(asset);
}));

// GET /api/projects/:id/pages/:pageId/assets
assetsRouter.get<PageParams>("/", asyncHandler(async (req, res) => {
  res.json(await getRepositories().assets.listByPage(req.params.pageId));
}));
