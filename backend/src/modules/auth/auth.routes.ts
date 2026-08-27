import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import type { PublicUser, User } from "@sketch2ui/shared-types";
import { env } from "../../config/env.js";
import { sendError } from "../../middleware/apiError.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authRateLimiterOrNoop } from "../../middleware/rateLimiter.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { getRepositories } from "../../repositories/index.js";
import { clearSessionCookie, readSessionCookie, sessionExpiryFromNow, setSessionCookie } from "./cookies.js";
import { sendPasswordResetEmail } from "./email.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateSessionToken, hashToken } from "./token.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validatePassword(password: unknown): string | null {
  if (
    typeof password !== "string" ||
    password.length < MIN_PASSWORD_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function validateCredentials(email: unknown, password: unknown): string | null {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return "A valid email is required.";
  }
  return validatePassword(password);
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
    // Identical response whether the account doesn't exist, the password is wrong, or
    // the account is Google-only (passwordHash null) — none of those may be
    // distinguishable from the response.
    const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
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

// POST /api/auth/google — Google Identity Services hands the frontend a signed ID
// token (JWT); this route is the only place that token is ever seen server-side.
// Verifying it (rather than trusting whatever the client claims) is what makes this
// safe — verifyIdToken checks the signature against Google's own public keys and the
// audience against our Client ID.
authRouter.post(
  "/google",
  authRateLimiterOrNoop(),
  asyncHandler(async (req, res) => {
    if (!env.googleClientId) {
      return sendError(res, 501, "NOT_CONFIGURED", "Google sign-in is not configured.");
    }
    const { credential } = req.body ?? {};
    if (typeof credential !== "string" || !credential) {
      return sendError(res, 400, "VALIDATION_FAILED", "A Google credential is required.");
    }

    let payload;
    try {
      const ticket = await new OAuth2Client(env.googleClientId).verifyIdToken({
        idToken: credential,
        audience: env.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Could not verify the Google credential.");
    }
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Could not verify the Google credential.");
    }

    const repos = getRepositories();
    const normalizedEmail = normalizeEmail(payload.email);
    let user = await repos.users.findByEmail(normalizedEmail);
    if (user) {
      // Google has already verified this is the same email — safe to link onto an
      // existing password account, same trust boundary a verified-email OAuth
      // provider is meant to establish.
      if (!user.googleId) user = await repos.users.linkGoogleAccount(user.id, payload.sub);
    } else {
      user = await repos.users.create({ email: normalizedEmail, passwordHash: null, googleId: payload.sub });
    }

    const token = await issueSession(user.id);
    setSessionCookie(res, token);
    await repos.auditLogs.record({ event: "user_login", userId: user.id });
    res.status(200).json(toPublicUser(user));
  })
);

// POST /api/auth/forgot-password — DEF-009-style rate limiting applies here too: this
// route is as attractive a target for abuse (mass-emailing strangers, or probing which
// emails have accounts) as login/register.
authRouter.post(
  "/forgot-password",
  authRateLimiterOrNoop(),
  asyncHandler(async (req, res) => {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return sendError(res, 400, "VALIDATION_FAILED", "A valid email is required.");
    }

    const repos = getRepositories();
    const user = await repos.users.findByEmail(normalizeEmail(email));
    // Same response whether or not the account exists — never let this route be used
    // to enumerate registered emails.
    if (user) {
      await repos.passwordResetTokens.deleteAllForUser(user.id);
      const token = generateSessionToken();
      await repos.passwordResetTokens.create({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      });
      const resetUrl = `${env.webUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }
    res.status(200).json({ message: "If an account exists for that email, a reset link has been sent." });
  })
);

// POST /api/auth/reset-password
authRouter.post(
  "/reset-password",
  authRateLimiterOrNoop(),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      return sendError(res, 400, "VALIDATION_FAILED", "A reset token is required.");
    }
    const validationError = validatePassword(password);
    if (validationError) {
      return sendError(res, 400, "VALIDATION_FAILED", validationError);
    }

    const repos = getRepositories();
    const resetToken = await repos.passwordResetTokens.findByTokenHash(hashToken(token));
    if (!resetToken || new Date(resetToken.expiresAt).getTime() < Date.now()) {
      return sendError(res, 400, "INVALID_TOKEN", "This reset link is invalid or has expired.");
    }

    const passwordHash = await hashPassword(password);
    await repos.users.updatePasswordHash(resetToken.userId, passwordHash);
    await repos.passwordResetTokens.deleteAllForUser(resetToken.userId);
    // A password reset is a "log out everywhere" event — the standard expectation
    // when a password changes, and the right response if the reset was prompted by a
    // compromised account.
    await repos.sessions.deleteAllForUser(resetToken.userId);
    await repos.auditLogs.record({ event: "user_password_reset", userId: resetToken.userId });
    res.status(200).json({ message: "Password reset." });
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
