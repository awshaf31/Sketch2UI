import { Router } from "express";
import { validateGeneratedCode } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import type { PageParams } from "../../types.js";
import { getRepositories } from "../../repositories/index.js";
import type { CodeVersion } from "@sketch2ui/shared-types";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { requirePageInProject } from "../../middleware/requirePageInProject.js";

// Code version history and hand-editing — plan §6.9 ("read-only mode initially, then
// add editable mode"), §39 V1 tier. Page-scoped since Phase D3: every page has its own
// independent version history and active version.
//
// IMMUTABILITY IS PRESERVED. A hand-edit never mutates an existing CodeVersion; it
// appends a new one with source "edited". Export (§18.8) and the evaluation baseline
// both depend on a version's contents never changing underneath them — the repository
// interface has no update/delete method for a CodeVersion, which makes a mutate-in-
// place edit impossible to write rather than merely discouraged.

export const codeVersionsRouter = Router({ mergeParams: true });
codeVersionsRouter.use(requireProjectOwnership);
codeVersionsRouter.use(requirePageInProject);

interface VersionParams extends PageParams {
  versionId: string;
}

/** The version preview and export use for one page: the explicit choice, else the
 * latest. */
export async function resolveActiveVersionForPage(pageId: string): Promise<CodeVersion | null> {
  return getRepositories().codeVersions.resolveActiveForPage(pageId);
}

// GET /api/projects/:id/pages/:pageId/code-versions — full history for this page.
codeVersionsRouter.get<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    const [active, versions] = await Promise.all([
      resolveActiveVersionForPage(req.params.pageId),
      getRepositories().codeVersions.listByPage(req.params.pageId),
    ]);
    res.json({
      activeVersionId: active?.id ?? null,
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        source: v.source,
        createdAt: v.createdAt,
        htmlBytes: v.html.length,
        cssBytes: v.css.length,
        isActive: v.id === active?.id,
      })),
    });
  })
);

// GET /api/projects/:id/pages/:pageId/code-versions/:versionId — one version's full content.
codeVersionsRouter.get<VersionParams>(
  "/:versionId",
  asyncHandler(async (req, res) => {
    const version = await getRepositories().codeVersions.findByPage(req.params.pageId, req.params.versionId);
    if (!version) return sendError(res, 404, "NOT_FOUND", "Code version not found.");
    res.json(version);
  })
);

/**
 * POST /api/projects/:id/pages/:pageId/code-versions — save a hand-edited page as a
 * NEW version.
 *
 * The generator endpoint (POST /code-generation-jobs) takes no body and always renders
 * from the UI-IR; this is its counterpart for user-authored content.
 */
codeVersionsRouter.post<PageParams>(
  "/",
  asyncHandler(async (req, res) => {
    const { html, css, basedOnVersionId } = (req.body ?? {}) as {
      html?: unknown;
      css?: unknown;
      basedOnVersionId?: unknown;
    };

    if (typeof html !== "string" || typeof css !== "string") {
      return sendError(res, 400, "VALIDATION_FAILED", "Both html and css are required.");
    }

    // §21.4 checks, via the shared validator the evaluation harness also uses. Broken
    // code is never persisted — a saved version that does not parse would poison export
    // and the preview alike.
    const validation = validateGeneratedCode(html, css);
    if (!validation.ok) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_FAILED",
          message: validation.issues.map((i) => i.message).join(" "),
          retryable: false,
          issues: validation.issues,
        },
      });
    }

    // Carry the asset map forward from whatever version the edit started from, so image
    // paths in a hand-edited page still resolve to real crops at export time.
    const basis =
      typeof basedOnVersionId === "string"
        ? await getRepositories().codeVersions.findByPage(req.params.pageId, basedOnVersionId)
        : await resolveActiveVersionForPage(req.params.pageId);

    const version = await getRepositories().codeVersions.create({
      projectId: req.params.id,
      pageId: req.params.pageId,
      source: "edited",
      html,
      css,
      ...(basis?.metadata ? { metadata: { ...basis.metadata } } : {}),
    });

    // A freshly saved edit becomes what you are looking at — otherwise the preview would
    // keep showing the old version and the save would appear to have done nothing.
    await getRepositories().pages.setActiveCodeVersion(req.params.pageId, version.id);

    res.status(201).json(version);
  })
);

// PUT /api/projects/:id/pages/:pageId/code-versions/:versionId/activate — choose which
// version preview and export use for this page. This is how a user reverts to a
// generated version after an edit, without anything being deleted.
codeVersionsRouter.put<VersionParams>(
  "/:versionId/activate",
  asyncHandler(async (req, res) => {
    const version = await getRepositories().codeVersions.findByPage(req.params.pageId, req.params.versionId);
    if (!version) return sendError(res, 404, "NOT_FOUND", "Code version not found.");

    await getRepositories().pages.setActiveCodeVersion(req.params.pageId, version.id);

    res.json({ activeVersionId: version.id });
  })
);
