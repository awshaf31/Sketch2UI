import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// SaaS phase S3 — public marketing site (Home + Pricing). Mirrors the flat-test style
// of the existing specs (no shared fixture infrastructure yet). Covers the Phase 17/1
// CTA-by-auth-status rule and the Phase 19 "pricing must not look like real billing"
// rule, plus the basic navigation the rest of the site depends on.

test("signed-out visitor sees the marketing homepage with a registration CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Turn hand-drawn wireframes/ })).toBeVisible();

  const startBuilding = page.getByRole("link", { name: "Start Building", exact: true }).first();
  await expect(startBuilding).toBeVisible();
  await expect(startBuilding).toHaveAttribute("href", "/register");

  // Signed out — no "Open App" link should exist anywhere on the page.
  await expect(page.getByRole("link", { name: "Open App" })).toHaveCount(0);
});

test("Pricing is reachable from the nav and is clearly labeled non-billing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Pricing", exact: true }).first().click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "Simple, illustrative pricing" })).toBeVisible();
  await expect(page.getByText("Not live.")).toBeVisible();

  const getStarted = page.getByRole("link", { name: "Get started free" }).first();
  await expect(getStarted).toHaveAttribute("href", "/register");
});

test("the Features nav link lands on the Core features section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Features", exact: true }).first().click();
  await expect(page).toHaveURL(/\/#features$/);
  await expect(page.getByRole("heading", { name: "Everything from first detection to final export" })).toBeInViewport();
});

test("a signed-in visitor sees Open App instead of the registration CTA", async ({ page }) => {
  await registerAndLogin(page, `marketing-home-${Date.now()}@e2e.local`);
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Open App" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Start Building", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Log in", exact: true })).toHaveCount(0);
});
