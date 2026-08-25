import { Router } from "express";
import type { ProjectParams } from "../../types.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireProjectOwnership } from "../../middleware/requireProjectOwnership.js";
import { getRepositories } from "../../repositories/index.js";

// Pages — Phase D3 minimum-viable multi-page. Mounted at /api/projects/:id/pages,
// gated by requireProjectOwnership only: this module DEFINES what pages exist, so it
// isn't itself nested under one.

export const pagesRouter = Router({ mergeParams: true });
pagesRouter.use(requireProjectOwnership);

interface PageIdParams extends ProjectParams {
  pageId: string;
}

// GET /api/projects/:id/pages — ordered, for the Pages strip.
pagesRouter.get<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getRepositories().pages.listByProject(req.params.id));
  })
);

// POST /api/projects/:id/pages
pagesRouter.post<ProjectParams>(
  "/",
  asyncHandler(async (req, res) => {
    const { name } = req.body ?? {};
    const existing = await getRepositories().pages.listByProject(req.params.id);
    const page = await getRepositories().pages.create({
      projectId: req.params.id,
      name: typeof name === "string" && name.trim() ? name.trim() : `Page ${existing.length + 1}`,
    });
    res.status(201).json(page);
  })
);

// PATCH /api/projects/:id/pages/:pageId — rename.
pagesRouter.patch<PageIdParams>(
  "/:pageId",
  asyncHandler(async (req, res) => {
    const page = await getRepositories().pages.findById(req.params.pageId);
    if (!page || page.projectId !== req.params.id) {
      return sendError(res, 404, "NOT_FOUND", "Page not found.");
    }

    const { name } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return sendError(res, 400, "VALIDATION_FAILED", "A page name is required.");
    }

    const updated = await getRepositories().pages.update(req.params.pageId, { name: name.trim() });
    res.json(updated);
  })
);

// DELETE /api/projects/:id/pages/:pageId — refuses to remove a project's last page.
pagesRouter.delete<PageIdParams>(
  "/:pageId",
  asyncHandler(async (req, res) => {
    const page = await getRepositories().pages.findById(req.params.pageId);
    if (!page || page.projectId !== req.params.id) {
      return sendError(res, 404, "NOT_FOUND", "Page not found.");
    }

    const removed = await getRepositories().pages.delete(req.params.pageId);
    if (!removed) {
      return sendError(
        res,
        400,
        "VALIDATION_FAILED",
        "A project must keep at least one page — delete the project instead."
      );
    }
    res.status(204).send();
  })
);
