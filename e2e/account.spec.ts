import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// SaaS phase S4 — app-shell nav (Projects/Account) and the new minimal Account page.

test("the Account nav link shows the signed-in user's email and highlights as active", async ({ page }) => {
  const email = `account-page-${Date.now()}@e2e.local`;
  await registerAndLogin(page, email);

  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/account$/);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();

  const accountLink = page.getByRole("link", { name: "Account", exact: true });
  await expect(accountLink).toHaveClass(/text-primary/);
});

test("logging out from the Account page returns to /login and revokes the session", async ({ page }) => {
  await registerAndLogin(page, `account-logout-${Date.now()}@e2e.local`);
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/account$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The session is really gone, not just the client-side redirect — /app bounces back.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
});
