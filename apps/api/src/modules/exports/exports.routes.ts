import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { v4 as uuid } from "uuid";
// Pinned to archiver v7: v8 is ESM-only and dropped the callable factory entirely
// (it exports only named Archive classes), while @types/archiver still describes the
// v7 API. v7's default export is the familiar archiver("zip", …) factory.
import createArchive from "archiver";
import type { ProjectExport } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { db } from "../../db/jsonStore.js";
import { sendError } from "../../middleware/apiError.js";
import { CropError, cropDetection } from "../crops/crop.service.js";
import { resolveActiveVersion } from "../codegen/code-versions.routes.js";
import type { ProjectParams } from "../../types.js";

// Export packages — plan §3.9 (FR-09), §18.8, §8.1/§43 (exports table),
// §38 MVP item 13.
//
// An export is built from an immutable CodeVersion, never from a live regeneration, so
// re-downloading v1 after the project has changed still yields exactly what v1 was.

export const exportsRouter = Router({ mergeParams: true });

interface ExportParams extends ProjectParams {
  exportId: string;
}

/**
 * A 160x100 light-grey placeholder PNG (bordered, with a diagonal cross — the
 * conventional wireframe image placeholder), embedded rather than generated.
 *
 * WHY THIS EXISTS — a pre-existing codegen limitation, surfaced not papered over:
 * packages/codegen emits `src="./assets/<node-id>.png"` for every image/avatar
 * detection. That path is derived from the UI-IR node id and points at nothing — codegen
 * has no reference to the uploaded asset, no crop, and no storage URL, so there is no
 * real image file to bundle. Shipping the HTML alone would give every export broken
 * image icons.
 *
 * So the package includes a neutral placeholder at each referenced path, and a README
 * that says exactly that. The generated `alt` text already reads "Image placeholder";
 * this makes the file match the claim instead of 404ing. Cropping the source sketch per
 * detection would be the real fix and belongs in codegen, not here.
 */
const PLACEHOLDER_PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAKAAAABkCAIAAACO1KzYAAAC9ElEQVR42u2cQWoCQRBFx6KuIAgi" +
    "4hWyySZXdunSs4iIIHiJLITJIJpoHLurfr/exOis5vNf/+qZqsl6s+1Yusu4BZJrtVxcPvjlz9fn" +
    "x/F0ns+m3Jrs63g69xrv9gcbfns8nfufWanVnc+mu/3hB9Hz2bS3LxonlXaobv+9Dy+az6a9la+u" +
    "Y8V37U3J/Or/yxXInJHJT6RoiJ2XyU+USUONkTmscX9H7B91MFZOaty7e/A9mdmVg4eplwQmfMUP" +
    "U+McVULs+Ez+p4MhdhYmjyAwxI7M5DGfJkHsgEwe/3Eh5XKVArfo82CsHM24r+7BhK9oYaqEwISv" +
    "imGq6Cs7ELsik9/rYIhdncnlBIbYVZhc4a1KiF2SyUUdDLHLM7mawM0Su7xrK7/43g6xqzA5SmeD" +
    "/AHn6IeO+VpXVK0cwbh19mD58FUxTMUVWCZ8xXFt0O7CvMQOxeSIDs5L7IBMji5wImKHdW2OBvDI" +
    "xI7M5GQd/gHL5SAFrs4IhzhWTmTc0HtwwPAVP0ylF7hi+Ern2txTdkoSOyOTEzu4JLHzMllE4LcS" +
    "O7trpQahjUtsASbrOHhcYsswWVPgF4kt5lrlWZXPEluPyU0MI33wgDPXoSMCP2FleeMK7sEPhi/V" +
    "MNWowDfDV1Ov3TMQHIE7wZdY25k24a21jbTWPmNtto200z5jLc+qaYHY1ni/l7yVnR5c7d5lpwdX" +
    "O3wZrXzaxHZa+bSJ7cxF0Ca20V6tTWyHydrEdpisTWyDydrENmbVaM8HMoyrbWUnTGmHLydMaYcv" +
    "g8naxHaYrE1sh8naxDaYrE1so8DVLpcN42pb2QlT2uHLCVPa4ctgsjaxHSZrE9thsjaxDSZrE9th" +
    "sjaxHSZrE9tgsjaxjUNH7QNOw7jaVnbClHb4csKUdvgymKxNbIfJ2sR2mKxNbIPJ2sQ2Clztctkw" +
    "rraVnTClHb6cMKUdvgwmaxPbhqISppTC12q56Lpust5suS96a7Vc7PYHBoLLrou6Xdd9A8BYYhch" +
    "lCR6AAAAAElFTkSuQmCC",
  "base64"
);

function exportRelPath(projectId: string, versionNumber: number): string {
  // Mirrors the plan's projects/{projectId}/exports/v{n}.zip.
  return path.join("projects", projectId, "exports", `v${versionNumber}.zip`);
}

function exportAbsPath(relPath: string): string {
  return path.join(env.exportsDir, relPath);
}

/** Every distinct `src="./assets/..."` the generated HTML actually references. */
function referencedAssetPaths(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/src="\.\/(assets\/[^"]+)"/g)) found.add(m[1]);
  return [...found];
}

function buildReadme(project: { name: string }, version: number, codeVersionNumber: number): string {
  return `${project.name} — Sketch2UI export v${version}
Generated from code version ${codeVersionNumber}.

CONTENTS
  index.html          the generated page
  styles.css          the generated stylesheet
  assets/             placeholder images (see note below)
  source-sketch.*     the original uploaded sketch, for reference

Open index.html directly in a browser — no server needed.

NOTE ON IMAGES
  The images in assets/ are PLACEHOLDERS, not content from your sketch.

  Sketch2UI's code generator emits <img src="./assets/<id>.png"> for each detected
  image region, but it does not currently carry a reference back to the uploaded
  sketch or crop the region out of it. There is therefore no real image to ship, and
  these placeholder files exist so the page renders without broken-image icons.

  Replace them with your own artwork, keeping the filenames, and the layout will pick
  them up unchanged. The original sketch is included as source-sketch.* so you can see
  what each region was.
`;
}

// POST /api/projects/:id/exports — plan §18.8
exportsRouter.post<ProjectParams>("/", async (req, res, next) => {
  const project = db.state.projects.find((p) => p.id === req.params.id);
  if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

  // Optional body.codeVersionId pins a specific version; default is the active one
  // (a user-pinned pick if set, otherwise the latest). Using resolveActiveVersion keeps
  // export in step with preview — activating a version through the code-versions API is
  // the single control for "this is the current version".
  const requestedId = (req.body ?? {}).codeVersionId as string | undefined;
  const codeVersion = requestedId
    ? db.state.codeVersions.find((c) => c.id === requestedId && c.projectId === project.id)
    : resolveActiveVersion(project.id);

  if (!codeVersion) {
    return sendError(
      res,
      400,
      "VALIDATION_FAILED",
      requestedId
        ? "That code version does not belong to this project."
        : "No generated code yet — save a code version before exporting."
    );
  }

  const previous = db.state.exports.filter((e) => e.projectId === project.id);
  const versionNumber = previous.length + 1;
  const relPath = exportRelPath(project.id, versionNumber);
  const absPath = exportAbsPath(relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const output = fs.createWriteStream(absPath);
  const archive = createArchive("zip", { zlib: { level: 9 } });

  // Stream errors surface through the standard error handler rather than hanging the
  // request or leaving a truncated ZIP presented as valid.
  // A failed archive must not leave a truncated ZIP on disk that a later request could
  // serve as if it were valid.
  const failWith = (err: Error) => {
    fs.rmSync(absPath, { force: true });
    next(err);
  };
  archive.on("error", failWith);
  output.on("error", failWith);

  output.on("close", () => {
    const record: ProjectExport = {
      id: uuid(),
      projectId: project.id,
      codeVersionId: codeVersion.id,
      versionNumber,
      storagePath: relPath,
      fileSize: archive.pointer(),
      createdAt: new Date().toISOString(),
    };
    db.state.exports.push(record);
    db.save();

    res.status(201).json({
      ...record,
      downloadUrl: `/api/projects/${project.id}/exports/${record.id}/download`,
    });
  });

  archive.pipe(output);
  archive.append(codeVersion.html, { name: "index.html" });
  archive.append(codeVersion.css, { name: "styles.css" });

  // Real crops from the source sketch (plan §15.5), placed at exactly the paths the
  // stored HTML references. The map was recorded at code-generation time so an export
  // built from an older immutable version still crops the right regions.
  const assetMap = codeVersion.metadata?.assets ?? {};
  for (const assetPath of referencedAssetPaths(codeVersion.html)) {
    const detectionId = assetMap[assetPath];
    const detection = detectionId
      ? db.state.detections.find((d) => d.id === detectionId)
      : undefined;
    const cropAsset = detection
      ? db.state.assets.find((a) => a.id === detection.sourceAssetId)
      : undefined;

    let bytes: Buffer = PLACEHOLDER_PNG;
    if (detection && cropAsset) {
      try {
        bytes = Buffer.from(await cropDetection(detection, cropAsset));
      } catch (cause) {
        // A crop that cannot be produced (missing source, degenerate box) falls back to
        // the neutral placeholder rather than failing the whole export.
        if (!(cause instanceof CropError)) throw cause;
      }
    }
    archive.append(bytes, { name: assetPath });
  }

  // Bundle the source sketch so the package is self-explanatory about what it came from.
  const asset = db.state.assets.filter((a) => a.projectId === project.id).at(-1);
  if (asset) {
    const source = path.join(env.uploadsDir, asset.storageKey);
    if (fs.existsSync(source)) {
      archive.file(source, { name: `source-sketch${path.extname(asset.storageKey)}` });
    }
  }

  archive.append(buildReadme(project, versionNumber, codeVersion.versionNumber), {
    name: "README.txt",
  });

  void archive.finalize();
});

// GET /api/projects/:id/exports — version history (§43: old exports stay traceable).
exportsRouter.get<ProjectParams>("/", (req, res) => {
  const list = db.state.exports
    .filter((e) => e.projectId === req.params.id)
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map((e) => ({
      ...e,
      downloadUrl: `/api/projects/${e.projectId}/exports/${e.id}/download`,
    }));
  res.json(list);
});

// GET /api/projects/:id/exports/:exportId/download
//
// A route rather than express.static: the ZIP path is derived from a stored record, so
// the id is validated against the project before anything is read off disk. Assets are
// served statically because their storage keys are already public; exports are addressed
// by record id, which keeps that check in one place.
exportsRouter.get<ExportParams>("/:exportId/download", (req, res) => {
  const record = db.state.exports.find(
    (e) => e.id === req.params.exportId && e.projectId === req.params.id
  );
  if (!record) return sendError(res, 404, "NOT_FOUND", "Export not found.");

  const absPath = exportAbsPath(record.storagePath);
  if (!fs.existsSync(absPath)) {
    return sendError(res, 404, "NOT_FOUND", "Export file is missing from storage.");
  }

  const project = db.state.projects.find((p) => p.id === record.projectId);
  const safeName = (project?.name ?? "sketch2ui")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  res.download(absPath, `${safeName || "sketch2ui"}-v${record.versionNumber}.zip`);
});
