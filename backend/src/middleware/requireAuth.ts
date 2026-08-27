import type { RequestHandler } from "express";
import { readSessionCookie } from "../modules/auth/cookies.js";
import { hashToken } from "../modules/auth/token.js";
import { getRepositories } from "../repositories/index.js";
import { sendError } from "./apiError.js";
import { asyncHandler } from "./asyncHandler.js";

/** Gates every route mounted after it in server.ts. Resolves the `sid` cookie to a
 * live session and attaches `req.userId`, or responds 401. */
export const requireAuth: RequestHandler = asyncHandler(async (req, res, next) => {
  const token = readSessionCookie(req);
  if (!token) {
    sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
    return;
  }

  const session = await getRepositories().sessions.findByTokenHash(hashToken(token));
  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
    return;
  }

  req.userId = session.userId;
  next();
});
