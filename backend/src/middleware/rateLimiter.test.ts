import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./errorHandler.js";
import { buildAuthRateLimiter } from "./rateLimiter.js";

/**
 * HTTP-integration regression coverage for DEF-009
 * (docs/qa/MASTER_DEFECT_REGISTER.md) — /api/auth/login and /register had no rate
 * limiting at all. This exercises `buildAuthRateLimiter()` directly with a tiny
 * limit rather than going through `authRateLimiterOrNoop()`'s NODE_ENV=test bypass
 * (see rateLimiter.ts) — that bypass exists so every OTHER module's own
 * HTTP-integration tests can register/log in as many throwaway users as they need
 * without tripping the production-sized limit; it would make this file's own
 * regression coverage impossible if applied here too.
 */

function makeApp(max: number) {
  const app = express();
  app.use(express.json());
  app.post("/limited", buildAuthRateLimiter({ windowMs: 60_000, max }), (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("buildAuthRateLimiter", () => {
  it("allows requests up to the limit, then rejects with 429 RATE_LIMITED", async () => {
    const app = makeApp(3);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/limited");
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/limited");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.body.error.retryable).toBe(true);
  });

  it("keys the limit by client IP — one client's block doesn't affect another's", async () => {
    // trust proxy + X-Forwarded-For, JUST in this test app, to simulate two distinct
    // client IPs through supertest (which otherwise sends every request from the
    // same loopback address). The real app never sets trust proxy — see the "no
    // reverse proxy in front of this app yet" note in rateLimiter.ts's comment.
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.post("/limited", buildAuthRateLimiter({ windowMs: 60_000, max: 1 }), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);

    const clientA1 = await request(app).post("/limited").set("X-Forwarded-For", "10.0.0.1");
    expect(clientA1.status).toBe(200);
    const clientA2 = await request(app).post("/limited").set("X-Forwarded-For", "10.0.0.1");
    expect(clientA2.status).toBe(429);

    // A different IP has its own, unaffected budget.
    const clientB1 = await request(app).post("/limited").set("X-Forwarded-For", "10.0.0.2");
    expect(clientB1.status).toBe(200);
  });
});
