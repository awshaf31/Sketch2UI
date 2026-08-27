import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/jsonStore.js";
import { errorHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { projectsRouter } from "../projects/projects.routes.js";
import { authRouter } from "./auth.routes.js";

// Google sign-in: never calls the real google-auth-library (no network, no real
// Google credential to test with) — mock verifyIdToken so each test controls exactly
// what "Google" claims about the credential.
const verifyIdTokenMock = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken(...args: unknown[]) {
      return verifyIdTokenMock(...args);
    }
  },
}));

// Forgot/reset password: never calls Resend — mock the send so tests can assert what
// WOULD have been emailed (the reset URL/token) without any external dependency.
const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("./email.js", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

/**
 * First HTTP-integration test file for backend (Phase D1).
 *
 * Every prior module was verifiable at the repository-contract level alone because
 * route handlers were thin pass-throughs. Auth is different: cookie issuance,
 * requireAuth's 401 behaviour, and requireProjectOwnership's cross-user 404 behaviour
 * are properties of route/middleware WIRING, not of any single repository — no
 * contract test can see them. Hence supertest, mounted here rather than against the
 * full server.ts (which also wires up multer/sharp upload handling, static file
 * serving, and the CV worker — none of which this suite needs).
 */

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/projects", projectsRouter);
  app.use(errorHandler);
  return app;
}

describe("auth routes", () => {
  const app = makeApp();

  beforeEach(() => {
    db.reset();
    verifyIdTokenMock.mockReset();
    sendPasswordResetEmailMock.mockClear();
  });

  describe("POST /api/auth/register", () => {
    it("creates an account, sets a session cookie, and returns the public user", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@example.com", password: "correct-horse" });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe("new@example.com");
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/^sid=/);
    });

    it("rejects a duplicate email with 409", async () => {
      await request(app).post("/api/auth/register").send({ email: "dupe@example.com", password: "correct-horse" });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "DUPE@example.com", password: "another-password" });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_IN_USE");
    });

    it("rejects a short password", async () => {
      const res = await request(app).post("/api/auth/register").send({ email: "a@example.com", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("POST /api/auth/login then GET /api/auth/me", () => {
    it("logs in and resolves the session on /me", async () => {
      // Register with a plain (cookie-less) request, then log in with a fresh agent —
      // this actually exercises the login route rather than reusing register's session.
      await request(app).post("/api/auth/register").send({ email: "login@example.com", password: "correct-horse" });
      const anon = request.agent(app);
      const login = await anon.post("/api/auth/login").send({ email: "login@example.com", password: "correct-horse" });
      expect(login.status).toBe(200);

      const me = await anon.get("/api/auth/me");
      expect(me.status).toBe(200);
      expect(me.body.email).toBe("login@example.com");
    });

    it("returns an identical 401 for a wrong password and for an unknown email", async () => {
      await request(app).post("/api/auth/register").send({ email: "known@example.com", password: "correct-horse" });

      const wrongPassword = await request(app)
        .post("/api/auth/login")
        .send({ email: "known@example.com", password: "wrong-password" });
      const unknownEmail = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@example.com", password: "wrong-password" });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });
  });

  describe("GET /api/auth/me without a session", () => {
    it("returns 401", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the session — /me returns 401 afterward", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "out@example.com", password: "correct-horse" });
      await agent.post("/api/auth/logout");
      const res = await agent.get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/google", () => {
    function mockGoogle(payload: Record<string, unknown> | null) {
      verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => payload });
    }

    it("creates a new, password-less account for a first-time Google sign-in", async () => {
      mockGoogle({ email: "fresh@example.com", email_verified: true, sub: "google-sub-1" });

      const res = await request(app).post("/api/auth/google").send({ credential: "fake-jwt" });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("fresh@example.com");
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.headers["set-cookie"]?.[0]).toMatch(/^sid=/);
    });

    it("links Google onto an existing password account with the same (verified) email", async () => {
      await request(app).post("/api/auth/register").send({ email: "linked@example.com", password: "correct-horse" });
      mockGoogle({ email: "linked@example.com", email_verified: true, sub: "google-sub-2" });

      const res = await request(app).post("/api/auth/google").send({ credential: "fake-jwt" });

      expect(res.status).toBe(200);
      expect(res.body.email).toBe("linked@example.com");
      // Still exactly one account for this email, not a duplicate.
      expect(db.state.users.filter((u) => u.email === "linked@example.com")).toHaveLength(1);
    });

    it("rejects a credential Google did not verify the email on", async () => {
      mockGoogle({ email: "unverified@example.com", email_verified: false, sub: "google-sub-3" });
      const res = await request(app).post("/api/auth/google").send({ credential: "fake-jwt" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects a credential that fails signature verification", async () => {
      verifyIdTokenMock.mockRejectedValueOnce(new Error("bad signature"));
      const res = await request(app).post("/api/auth/google").send({ credential: "fake-jwt" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("a Google-only account cannot log in with a password", async () => {
      mockGoogle({ email: "googleonly@example.com", email_verified: true, sub: "google-sub-4" });
      await request(app).post("/api/auth/google").send({ credential: "fake-jwt" });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "googleonly@example.com", password: "whatever12" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("POST /api/auth/forgot-password and /api/auth/reset-password", () => {
    it("responds identically whether or not the account exists, and only emails a link for a real one", async () => {
      await request(app).post("/api/auth/register").send({ email: "resetme@example.com", password: "correct-horse" });

      const known = await request(app).post("/api/auth/forgot-password").send({ email: "resetme@example.com" });
      const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@example.com" });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
      expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
      expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
        "resetme@example.com",
        expect.stringContaining("/reset-password?token=")
      );
    });

    it("resets the password with a valid token, and invalidates it and existing sessions", async () => {
      const agent = request.agent(app);
      await agent.post("/api/auth/register").send({ email: "fullflow@example.com", password: "original-pass" });
      // The session from register should NOT survive the reset below.
      expect((await agent.get("/api/auth/me")).status).toBe(200);

      await request(app).post("/api/auth/forgot-password").send({ email: "fullflow@example.com" });
      const [, url] = sendPasswordResetEmailMock.mock.calls[0] as [string, string];
      const token = new URL(url).searchParams.get("token")!;

      const reset = await request(app).post("/api/auth/reset-password").send({ token, password: "new-password-1" });
      expect(reset.status).toBe(200);

      // Old session is dead.
      expect((await agent.get("/api/auth/me")).status).toBe(401);
      // Old password no longer works, new one does.
      const oldLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "fullflow@example.com", password: "original-pass" });
      expect(oldLogin.status).toBe(401);
      const newLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "fullflow@example.com", password: "new-password-1" });
      expect(newLogin.status).toBe(200);

      // The token is single-use.
      const reuse = await request(app).post("/api/auth/reset-password").send({ token, password: "another-pass1" });
      expect(reuse.status).toBe(400);
      expect(reuse.body.error.code).toBe("INVALID_TOKEN");
    });

    it("rejects an unknown or malformed token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "not-a-real-token", password: "new-password-1" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_TOKEN");
    });

    it("rejects a reset with too short a password", async () => {
      await request(app).post("/api/auth/register").send({ email: "shortpw@example.com", password: "correct-horse" });
      await request(app).post("/api/auth/forgot-password").send({ email: "shortpw@example.com" });
      const [, url] = sendPasswordResetEmailMock.mock.calls[0] as [string, string];
      const token = new URL(url).searchParams.get("token")!;

      const res = await request(app).post("/api/auth/reset-password").send({ token, password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("project ownership", () => {
    it("a request without a session is rejected before ownership is even checked", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(401);
    });

    it("a second user cannot fetch the first user's project by id", async () => {
      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "owner@example.com", password: "correct-horse" });
      const created = await owner.post("/api/projects").send({ name: "Mine" });

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "other@example.com", password: "correct-horse" });
      const res = await other.get(`/api/projects/${created.body.id}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("listing projects only returns the caller's own", async () => {
      const owner = request.agent(app);
      await owner.post("/api/auth/register").send({ email: "listowner@example.com", password: "correct-horse" });
      await owner.post("/api/projects").send({ name: "Mine" });

      const other = request.agent(app);
      await other.post("/api/auth/register").send({ email: "listother@example.com", password: "correct-horse" });
      await other.post("/api/projects").send({ name: "Theirs" });

      const res = await owner.get("/api/projects");
      expect(res.body.map((p: { name: string }) => p.name)).toEqual(["Mine"]);
    });
  });
});
