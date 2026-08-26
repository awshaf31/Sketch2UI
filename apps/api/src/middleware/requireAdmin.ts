import type { RequestHandler } from "express";
import { getRepositories } from "../repositories/index.js";
import { sendError } from "./apiError.js";
import { asyncHandler } from "./asyncHandler.js";

/**
 * SaaS phase S6 — gates every `/api/admin` route. Mounted after the global
 * `requireAuth` (server.ts), so `req.userId` is always already set here.
 *
 * Unlike requireProjectOwnership's deliberate 404 (avoiding an existence-enumeration
 * oracle on a resource the caller might otherwise legitimately own), this is a
 * route-level role check, not a per-resource ownership check — there is nothing to
 * enumerate by probing admin URLs, so the correct, honest response is 403 FORBIDDEN,
 * exactly the case that error code's own comment (apiError.ts) reserved this for.
 */
export const requireAdmin: RequestHandler = asyncHandler(async (req, res, next) => {
  const user = await getRepositories().users.findById(req.userId!);
  if (!user || user.role !== "admin") {
    sendError(res, 403, "FORBIDDEN", "Admin access required.");
    return;
  }
  next();
});
