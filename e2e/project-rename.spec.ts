import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// SaaS phase S5 — Phase 4 of the brief ("rename if supported"). Covers both surfaces
// added this phase: the Dashboard project card and the Workspace toolbar title, both
// using the same click-to-edit pattern PagesStrip.tsx already established for pages.

test("renaming a project from the Dashboard card persists the new name", async ({ page }) => {
  await registerAndLogin(page, `rename-dashboard-${Date.now()}@e2e.local`);
  await page.goto("/app");
  await page.getByPlaceholder("New project name").fill("Original Name");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/app\/projects\/[^/]+$/);

  await page.goto("/app");
  const card = page.locator("li, div").filter({ hasText: "Original Name" }).last();
  await card.hover();
  await page.getByRole("button", { name: 'Rename "Original Name"' }).click();

  const renameInput = page.getByRole("textbox", { name: 'Rename "Original Name"' });
  await renameInput.fill("Renamed From Dashboard");
  await renameInput.press("Enter");

  await expect(page.getByText("Renamed From Dashboard")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Renamed From Dashboard")).toBeVisible();
});

test("renaming a project from the Workspace toolbar persists the new name", async ({ page }) => {
  await registerAndLogin(page, `rename-workspace-${Date.now()}@e2e.local`);
  await page.goto("/app");
  await page.getByPlaceholder("New project name").fill("Workspace Original");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/app\/projects\/[^/]+$/);

  await page.getByRole("button", { name: 'Rename "Workspace Original"' }).click();
  const renameInput = page.getByLabel("Project name");
  await renameInput.fill("Renamed From Workspace");
  await renameInput.press("Enter");

  await expect(page.getByRole("heading", { name: "Renamed From Workspace" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Renamed From Workspace" })).toBeVisible();
});
