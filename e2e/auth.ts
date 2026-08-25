import type { Page } from "@playwright/test";

// Phase D1 — / and /projects/:id are now behind ProtectedRoute, so every e2e spec
// needs a logged-in session before it can reach them. No shared Playwright fixture
// infrastructure exists yet (neither spec uses one), so a plain helper function
// matches the current flat-test style rather than introducing one.
export async function registerAndLogin(page: Page, email: string): Promise<void> {
  await page.goto("/register");
  await page.locator("#register-email").fill(email);
  await page.locator("#register-password").fill("e2e-test-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
}
