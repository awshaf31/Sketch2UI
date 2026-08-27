import type { RequestHandler } from "express";
import type { ProjectParams } from "../types.js";
import { getRepositories } from "../repositories/index.js";
import { sendError } from "./apiError.js";
import { asyncHandler } from "./asyncHandler.js";

/**
 * Mounted as the first `.use()` on every nested project-scoped router (mergeParams
 * already makes `req.params.id` available there). Fetches the project once and
 * confirms `req.userId` (set by requireAuth, which runs first) owns it.
 *
 * Returns 404, never 403, on a mismatch — matching every existing route's "unknown
 * id" response, so a caller cannot distinguish "doesn't exist" from "exists, not
 * yours" by probing ids.
 */
export const requireProjectOwnership: RequestHandler<ProjectParams> = asyncHandler(
  async (req, res, next) => {
    const project = await getRepositories().projects.findById(req.params.id);
    if (!project || project.ownerId !== req.userId) {
      sendError(res, 404, "NOT_FOUND", "Project not found.");
      return;
    }
    next();
  }
);
