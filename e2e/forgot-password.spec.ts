import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// Forgot/reset password — backend/src/modules/auth/auth.routes.ts's POST
// /forgot-password and /reset-password. This suite's e2e webServer has no
// RESEND_API_KEY (see playwright.config.ts's apiEnv), so the reset link only ever
// prints to the API's own stdout — there's no inbox for a browser test to read it
// from. The full "request a link, click it, set a new password, log in with it" path
// is covered directly against the routes instead, in
// backend/src/modules/auth/auth.routes.test.ts, where the token is available in the
// test process. This suite covers what IS reachable through the browser: the
// generic, enumeration-safe confirmation, and the reset page's handling of a
// missing/invalid token.

test("forgot-password always shows the same generic confirmation, known email or not", async ({ page }) => {
  const email = `forgot-pw-${Date.now()}@e2e.local`;
  await registerAndLogin(page, email);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL("/login");

  await page.goto("/forgot-password");
  await page.locator("#forgot-password-email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();

  await page.goto("/forgot-password");
  await page.locator("#forgot-password-email").fill(`nobody-${Date.now()}@e2e.local`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("visiting reset-password with no token shows an error, not a broken form", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Invalid reset link" })).toBeVisible();
  await expect(page.locator("#reset-password")).toHaveCount(0);
});

test("an unknown token is rejected with a clear error instead of resetting anything", async ({ page }) => {
  await page.goto("/reset-password?token=not-a-real-token");
  await page.locator("#reset-password").fill("brand-new-password-1");
  await page.locator("#reset-password-confirm").fill("brand-new-password-1");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
});

test("mismatched passwords are flagged before submitting", async ({ page }) => {
  await page.goto("/reset-password?token=irrelevant-for-this-check");
  await page.locator("#reset-password").fill("brand-new-password-1");
  await page.locator("#reset-password-confirm").fill("does-not-match");
  await expect(page.getByText("Passwords don't match.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset password" })).toBeDisabled();
});
