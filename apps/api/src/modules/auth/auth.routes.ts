import { Router } from "express";
import type { PublicUser, User } from "@sketch2ui/shared-types";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authRateLimiterOrNoop } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getRepositories } from "../../repositories/index.js";
import { clearSessionCookie, readSessionCookie, sessionExpiryFromNow, setSessionCookie } from "./cookies.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateSessionToken, hashToken } from "./token.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return "A valid email is required.";
  }
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

async function issueSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  await getRepositories().sessions.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: sessionExpiryFromNow(),
  });
  return token;
}

// POST /api/auth/register — DEF-009: rate-limited, see rateLimiter.ts.
authRouter.post(
  "/register",
  authRateLimiterOrNoop(),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    const validationError = validateCredentials(email, password);
    if (validationError) {
      return sendError(res, 400, "VALIDATION_FAILED", validationError);
    }

    const normalizedEmail = normalizeEmail(email);
    const repos = getRepositories();
    const existing = await repos.users.findByEmail(normalizedEmail);
    if (existing) {
      return sendError(res, 409, "EMAIL_IN_USE", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const user = await repos.users.create({ email: normalizedEmail, passwordHash });
    const token = await issueSession(user.id);
    setSessionCookie(res, token);
    await repos.auditLogs.record({ event: "user_registered", userId: user.id });
    res.status(201).json(toPublicUser(user));
  })
);

// POST /api/auth/login — DEF-009: rate-limited, see rateLimiter.ts.
authRouter.post(
  "/login",
  authRateLimiterOrNoop(),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const repos = getRepositories();
    const user = await repos.users.findByEmail(normalizeEmail(email));
    // Identical response whether the account doesn't exist or the password is wrong —
    // neither the status code nor the message may leak which one it was.
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const token = await issueSession(user.id);
    setSessionCookie(res, token);
    await repos.auditLogs.record({ event: "user_login", userId: user.id });
    res.status(200).json(toPublicUser(user));
  })
);

// POST /api/auth/logout
authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = readSessionCookie(req);
    if (token) {
      const repos = getRepositories();
      const tokenHash = hashToken(token);
      // Looked up BEFORE deletion — the session (and its userId) won't exist to read
      // afterward, and the audit event is specifically "this user logged out," not
      // "some session was deleted."
      const session = await repos.sessions.findByTokenHash(tokenHash);
      await repos.sessions.deleteByTokenHash(tokenHash);
      if (session) {
        await repos.auditLogs.record({ event: "user_logout", userId: session.userId });
      }
    }
    clearSessionCookie(res);
    res.status(204).send();
  })
);

// GET /api/auth/me
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getRepositories().users.findById(req.userId!);
    if (!user) {
      return sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
    }
    res.json(toPublicUser(user));
  })
);
