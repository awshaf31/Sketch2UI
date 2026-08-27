import type { RequestHandler } from "express";
import type { PageParams } from "../types.js";
import { getRepositories } from "../repositories/index.js";
import { sendError } from "./apiError.js";
import { asyncHandler } from "./asyncHandler.js";

/**
 * Mounted as the SECOND `.use()` (right after `requireProjectOwnership`) on every
 * page-nested router — Phase D3 multi-page. `requireProjectOwnership` already
 * established that `req.userId` owns the project, so this only needs to confirm the
 * page named in the URL actually belongs to that project.
 *
 * Returns 404, never 403, on a mismatch — same "doesn't exist" vs "exists, not
 * yours" indistinguishability rule as `requireProjectOwnership`.
 */
export const requirePageInProject: RequestHandler<PageParams> = asyncHandler(
  async (req, res, next) => {
    const page = await getRepositories().pages.findById(req.params.pageId);
    if (!page || page.projectId !== req.params.id) {
      sendError(res, 404, "NOT_FOUND", "Page not found.");
      return;
    }
    next();
  }
);
