import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./admin-seed.js";
import { login, registerAndLogin } from "./auth.js";

// SaaS phase S12 — the full admin journey (brief Phase 21): "Login as admin → Admin
// dashboard → Users → Projects → Jobs → Models → Audit logs." The seeded admin
// account (playwright.config.ts) exists specifically so this can log in as a real
// admin without a test-only backdoor route — see that file's header comment.
//
// Registers a normal user first so every admin screen has real data to show, not an empty
// state — the point of this suite is proving the admin UI renders genuine cross-account
// data end-to-end, the same thing the manual browser verification of phases S6–S10 already
// confirmed, now as a repeatable automated check.

test("admin can log in and walk every admin screen, seeing real cross-account data", async ({ page }) => {
  const subjectEmail = `admin-journey-subject-${Date.now()}@e2e.local`;
  await registerAndLogin(page, subjectEmail);
  await page.getByPlaceholder("New project name").fill("Admin Journey Project");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/app\/projects\/[^/]+$/);

  // ProjectWorkspace has its own toolbar, not AppHeader — no "Log out" button there.
  await page.goto("/app");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login$/);

  await login(page, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Total Users")).toBeVisible();

  await page.getByRole("link", { name: "Users", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByText(subjectEmail)).toBeVisible();

  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
  const projectLink = page.getByRole("link", { name: "Admin Journey Project" });
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page).toHaveURL(/\/admin\/projects\/[^/]+$/);
  await expect(page.getByText(subjectEmail)).toBeVisible();

  await page.getByRole("link", { name: "Jobs", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/jobs$/);
  await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();

  await page.getByRole("link", { name: "Models", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/models$/);
  // The real, checked-in model registry (ml/models/) — not e2e-isolated data, since
  // models.service.ts reads the actual repo path regardless of the throwaway store.
  await expect(page.getByText("ui-detector v1.0.0")).toBeVisible();

  await page.getByRole("link", { name: "Training Data", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/training$/);
  await expect(page.getByRole("heading", { name: "Training Data" })).toBeVisible();

  await page.getByRole("link", { name: "Audit Logs", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/audit-logs$/);
  // Real events from this exact test run: the subject registering, creating their
  // project, and this admin's own login. Filtered by this test's own unique email/
  // project name, not just the event type — the audit log is global and persistent
  // across the whole Playwright run (one shared server for every spec file), so other
  // specs' own project-creations/registrations show up here too.
  const rows = page.locator("tbody tr");
  await expect(rows.filter({ hasText: "PROJECT CREATED" }).filter({ hasText: "Admin Journey Project" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "USER REGISTERED" }).filter({ hasText: subjectEmail })).toHaveCount(1);
  await expect(rows.filter({ hasText: "USER LOGIN" }).filter({ hasText: E2E_ADMIN_EMAIL })).toHaveCount(1);
});

test("a non-admin user is refused entry to the admin area, in the browser, not just at the API", async ({ page }) => {
  await registerAndLogin(page, `not-an-admin-${Date.now()}@e2e.local`);
  await page.goto("/admin");
  await expect(page.getByText("This page is only available to administrators.")).toBeVisible();
});
