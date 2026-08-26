import type { Page } from "@playwright/test";

// Phase D1 — /app and /app/projects/:id are behind ProtectedRoute, so every e2e spec
// needs a logged-in session before it can reach them. No shared Playwright fixture
// infrastructure exists yet (neither spec uses one), so a plain helper function
// matches the current flat-test style rather than introducing one.
//
// SaaS phase S3 — the authenticated app moved from "/" to "/app" ("/" is now the
// public marketing homepage), so a successful register lands on "/app", not "/".
export async function registerAndLogin(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.locator("#register-email").fill(email);
  await page.locator("#register-password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/app");
}

// SaaS phase S12 — logs into an EXISTING account (the seeded admin from
// playwright.config.ts, or any other already-registered user), as opposed to
// registerAndLogin's create-then-log-in. Lands on /app either way — an admin account
// is a normal user account with an elevated role, not a separate login flow.
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("/app");
}
