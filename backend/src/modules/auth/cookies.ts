import type { Request, Response } from "express";
import { env } from "../../config/env.js";

export const SESSION_COOKIE_NAME = "sid";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, fixed — no sliding refresh.

/** No `cookie-parser` dependency: the token is a high-entropy opaque bearer value, not
 * a trust-bearing payload, so there is nothing an HMAC-signing library would add — a
 * plain reader is all `requireAuth` needs. */
export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === SESSION_COOKIE_NAME) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function cookieFlags() {
  return env.nodeEnv === "production"
    ? ({ httpOnly: true, sameSite: "none", secure: true } as const)
    : ({ httpOnly: true, sameSite: "lax", secure: false } as const);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieFlags(),
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { ...cookieFlags(), path: "/" });
}

export function sessionExpiryFromNow(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_MS);
}
