import { randomBytes, scryptSync } from "node:crypto";

// SaaS phase S12 — pure constants/helpers, no side effects, shared between
// playwright.config.ts (which writes the seed file once, at config-load time) and
// admin.spec.ts (which just needs to know the credentials to log in with). Kept
// separate from playwright.config.ts itself so importing the credentials from a test
// file doesn't also re-run the config's mkdtempSync/writeFileSync side effects in the
// test worker's own module registry — a real, if harmless, waste avoided by not
// having the test import the config module at all.
export const E2E_ADMIN_EMAIL = "e2e-admin@sketch2ui.local";
export const E2E_ADMIN_PASSWORD = "e2e-admin-password";

/** Mirrors backend/src/modules/auth/password.ts's hashPassword() exactly (same salt
 * length, same scrypt cost parameters, same "salt:hash" hex encoding) but
 * synchronous — playwright.config.ts has no async context to await in (Playwright
 * loads it as a plain CommonJS config, per its own `__dirname` usage). */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}
