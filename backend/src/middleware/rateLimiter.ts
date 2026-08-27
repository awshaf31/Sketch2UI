import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { sendError } from "./apiError.js";

// QA audit DEF-009 (docs/qa/MASTER_DEFECT_REGISTER.md): /api/auth/login and
// /api/auth/register had no rate limiting at all — open to unthrottled
// brute-force/credential-stuffing attempts.
//
// In-memory per-process storage (express-rate-limit's default) matches this app's
// existing single-process deployment model — jobs already run in-process rather than
// through the Redis container `docker-compose.yml` provisions but nothing else uses
// (see PROJECT_STATUS.md §3.3/§5). A shared store only earns its complexity once the
// API actually runs as more than one instance.
//
// 10 requests / 15 minutes per IP, on both routes: within the range OWASP's
// authentication cheat sheet suggests for login throttling, and register reuses the
// same order of magnitude rather than a separately tuned value, since mass-signup
// abuse deserves comparable protection to credential stuffing, not a bespoke number.
//
// Keyed on the direct socket IP (express-rate-limit's default) — this app runs with
// no reverse proxy in front of it yet (`app.set("trust proxy", ...)` is never called
// in server.ts), so `X-Forwarded-For` is correctly ignored; that would need revisiting
// alongside a real deployment config, not preemptively here.
export interface AuthRateLimiterOptions {
  windowMs?: number;
  max?: number;
}

export function buildAuthRateLimiter(options: AuthRateLimiterOptions = {}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? 15 * 60 * 1000,
    limit: options.max ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendError(res, 429, "RATE_LIMITED", "Too many attempts. Try again later.");
    },
  });
}

// Every other module's HTTP-integration test registers its own throwaway users
// through these exact routes (grep any `*.routes.test.ts` for `auth/register`) — a
// shared in-memory counter across a whole test file's cumulative calls would make
// the test suite's own size an accidental rate-limit trip hazard, not a real
// regression. NODE_ENV is set to "test" automatically by Vitest, so this only
// disables the limiter under the test runner; the limiter's own behavior is
// verified directly in rateLimiter.test.ts, which calls buildAuthRateLimiter()
// itself with a tiny limit rather than going through this wrapper.
export function authRateLimiterOrNoop(): RequestHandler {
  if (env.nodeEnv === "test") {
    return (_req, _res, next) => next();
  }
  return buildAuthRateLimiter();
}
