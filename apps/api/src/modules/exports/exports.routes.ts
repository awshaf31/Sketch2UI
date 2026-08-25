import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
// Pinned to archiver v7: v8 is ESM-only and dropped the callable factory entirely
// (it exports only named Archive classes), while @types/archiver still describes the
// v7 API. v7's default export is the familiar archiver("zip", …) factory.
import createArchive from "archiver";
import { env } from "../../config/env.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { CropError, cropDetection } from "../crops/crop.service.js";
import { resolveActiveVersionForPage } from "../codegen/code-versions.routes.js";
import type { ProjectParams } from "../../types.js";
import type { CodeVersion, Page } from "@sketch2ui/shared-types";
import { getRepositories } from "../../repositories/index.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";

// Export packages — plan §3.9 (FR-09), §18.8, §8.1/§43 (exports table),
// §38 MVP item 13.
//
// An export is built from an immutable CodeVersion, never from a live regeneration, so
// re-downloading v1 after the project has changed still yields exactly what v1 was.

export const exportsRouter = Router({ mergeParams: true });
exportsRouter.use(requireProjectOwnership);

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

/** Page 1 (lowest `order`) exports as index.html; every other page exports as
 * page-{order}.html — Phase D3's "index.html, page-2.html, page-3.html" convention. */
function pageFilename(page: Page): string {
  return page.order === 1 ? "index.html" : `page-${page.order}.html`;
}

function buildReadme(
  project: { name: string },
  version: number,
  pages: Array<{ page: Page; codeVersion: CodeVersion }>
): string {
  const pageLines = pages
    .map(({ page, codeVersion }) => `  ${pageFilename(page).padEnd(20)} "${page.name}" (code version ${codeVersion.versionNumber})`)
    .join("\n");

  return `${project.name} — Sketch2UI export v${version}

CONTENTS
${pageLines}
  styles.css          shared stylesheet for every page above
  assets/             placeholder images (see note below)
  source-sketch-*.*   each page's original uploaded sketch, for reference

Open index.html directly in a browser — no server needed. Pages link to each other
with plain relative paths (e.g. <a href="./page-2.html">), the same way any of the
files above link to styles.css or assets/.

NOTE ON IMAGES
  The images in assets/ are PLACEHOLDERS, not content from your sketch.

  Sketch2UI's code generator emits <img src="./assets/<id>.png"> for each detected
  image region, but it does not currently carry a reference back to the uploaded
  sketch or crop the region out of it. There is therefore no real image to ship, and
  these placeholder files exist so the page renders without broken-image icons.

  Replace them with your own artwork, keeping the filenames, and the layout will pick
  them up unchanged. Each page's original sketch is included as source-sketch-*.* so
  you can see what each region was.
`;
}

/** Append one page's real image crops (or the neutral placeholder) at the paths its
 * HTML references. Shared assets/ folder across pages is collision-safe because
 * codegen's per-page idPrefix makes every referenced path globally unique. */
async function appendPageAssets(archive: ReturnType<typeof createArchive>, codeVersion: CodeVersion): Promise<void> {
  const assetMap = codeVersion.metadata?.assets ?? {};
  for (const assetPath of referencedAssetPaths(codeVersion.html)) {
    const detectionId = assetMap[assetPath];
    const detection = detectionId ? await getRepositories().detections.findById(detectionId) : undefined;
    const cropAsset = detection ? await getRepositories().assets.findById(detection.sourceAssetId) : undefined;

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
}

// POST /api/projects/:id/exports — plan §18.8, extended for multi-page (Phase D3).
// Bundles EVERY page: one HTML file per page (index.html for the lowest `order`,
// page-{order}.html for the rest), one shared styles.css, and every page's own
// crops/source sketch. An export is built from each page's immutable active
// CodeVersion, never a live regeneration, so re-downloading v1 after the project has
// changed still yields exactly what v1 was.
exportsRouter.post<ProjectParams>(
  "/",
  asyncHandler(async (req, res, next) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project) return sendError(res, 404, "NOT_FOUND", "Project not found.");

    const pages = await getRepositories().pages.listByProject(project.id);

    const pageBundles: Array<{ page: Page; codeVersion: CodeVersion }> = [];
    for (const page of pages) {
      const codeVersion = await resolveActiveVersionForPage(page.id);
      if (!codeVersion) {
        return sendError(
          res,
          400,
          "VALIDATION_FAILED",
          `"${page.name}" has no generated code yet — save a code version for every page before exporting.`
        );
      }
      pageBundles.push({ page, codeVersion });
    }

    // Computed BEFORE the ZIP is streamed to disk, since the path depends on it — see
    // ExportRepository.nextVersionNumber's doc comment for why this can't be one
    // atomic operation with the `create()` call below.
    const versionNumber = await getRepositories().exports.nextVersionNumber(project.id);
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

    // The home page's (lowest order) version is the representative record — the export
    // row is a bookkeeping/history pointer, not something the download route
    // reconstructs from, so pointing it at one page's version is sufficient.
    const homeCodeVersion = pageBundles[0].codeVersion;

    output.on("close", () => {
      void getRepositories()
        .exports.create({
          projectId: project.id,
          codeVersionId: homeCodeVersion.id,
          versionNumber,
          storagePath: relPath,
          fileSize: archive.pointer(),
        })
        .then((record) => {
          res.status(201).json({
            ...record,
            downloadUrl: `/api/projects/${project.id}/exports/${record.id}/download`,
          });
        })
        .catch(next);
    });

    archive.pipe(output);

    // One shared styles.css — simple concatenation, not a byte-level dedup: identical
    // component/base blocks repeating across pages are harmless (same declarations,
    // same class name), and the id-selector layout/override blocks are collision-safe
    // by construction (each page's ids are namespaced by codegen's idPrefix).
    const combinedCss = pageBundles
      .map(({ page, codeVersion }) => `/* ---- ${page.name} ---- */\n${codeVersion.css}`)
      .join("\n\n");
    archive.append(combinedCss, { name: "styles.css" });

    for (const { page, codeVersion } of pageBundles) {
      archive.append(codeVersion.html, { name: pageFilename(page) });

      // Real crops from the source sketch (plan §15.5), placed at exactly the paths the
      // stored HTML references. The map was recorded at code-generation time so an
      // export built from an older immutable version still crops the right regions.
      await appendPageAssets(archive, codeVersion);

      // Bundle each page's own source sketch so the package is self-explanatory about
      // what it came from.
      const asset = await getRepositories().assets.findLatestForPage(page.id);
      if (asset) {
        const source = path.join(env.uploadsDir, asset.storageKey);
        if (fs.existsSync(source)) {
          archive.file(source, { name: `source-sketch-${pageFilename(page).replace(/\.html$/, "")}${path.extname(asset.storageKey)}` });
        }
      }
    }

    archive.append(buildReadme(project, versionNumber, pageBundles), {
      name: "README.txt",
    });

    void archive.finalize();
  })
);

// GET /api/projects/:id/exports — version history (§43: old exports stay traceable).
exportsRouter.get<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const list = await getRepositories().exports.listByProject(req.params.id);
    res.json(
      list.map((e) => ({
        ...e,
        downloadUrl: `/api/projects/${e.projectId}/exports/${e.id}/download`,
      }))
    );
  })
);

// GET /api/projects/:id/exports/:exportId/download
//
// A route rather than express.static: the ZIP path is derived from a stored record, so
// the id is validated against the project before anything is read off disk. Assets are
// served statically because their storage keys are already public; exports are addressed
// by record id, which keeps that check in one place.
exportsRouter.get<ExportParams>(
  "/:exportId/download",
  asyncHandler(async (req, res) => {
    const record = await getRepositories().exports.findById(req.params.exportId);
    if (!record || record.projectId !== req.params.id) {
      return sendError(res, 404, "NOT_FOUND", "Export not found.");
    }

    const absPath = exportAbsPath(record.storagePath);
    if (!fs.existsSync(absPath)) {
      return sendError(res, 404, "NOT_FOUND", "Export file is missing from storage.");
    }

    const project = await getRepositories().projects.findById(record.projectId);
    const safeName = (project?.name ?? "sketch2ui")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    res.download(absPath, `${safeName || "sketch2ui"}-v${record.versionNumber}.zip`);
  })
);
