import path from "node:path";
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// Golden-path E2E — plan §24: Sketch → Detect → Correct → Generate → Preview → Export.
//
// Detection is MOCKED (see mock-cv-worker.ts / playwright.config.ts) so this suite is
// deterministic and fast, and does not depend on the real model being installed or
// running. Real CV inference has its own coverage: services/cv-worker's pytest suite,
// and the manual regression checklist against a live worker.

const FIXTURE_SKETCH = path.join(__dirname, "fixtures", "sketch.png");

test("sketch to export golden path", async ({ page }) => {
  await registerAndLogin(page, `golden-path-${Date.now()}@e2e.local`);

  // 1. Create project
  await page.goto("/");
  await page.getByPlaceholder("New project name").fill("E2E Golden Path");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // 2. Upload the deterministic sketch fixture
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_SKETCH);
  const detectButton = page.getByRole("button", { name: /^Detect/ });
  await expect(detectButton).toBeVisible();

  // 3. Detect (mocked worker returns exactly one "button" detection)
  await detectButton.click();
  await expect(page.getByText(/1 box from the detector/)).toBeVisible({ timeout: 15_000 });

  // 4. Correct: select the (only) tree node and change its class
  const treeNode = page.locator("ul.p-2 > li > button").first();
  await treeNode.click();

  const classSelect = page.locator("#detection-class");
  await expect(classSelect).toHaveValue("button");
  await classSelect.selectOption("link");

  const applyClassButton = page.locator('button[title="Save this class and regenerate the code"]');
  await expect(applyClassButton).toBeEnabled();
  await applyClassButton.click();
  // Applying a class change regenerates code; wait for the busy indicator to clear.
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // 5. Generate: explicit "Save version" also regenerates and records a version.
  // Renamed from "Save code version" in docs/frontend design Phase 2D — see
  // docs/frontend/design-to-code-mapping.md's e2e-selector table for why this is a
  // deliberate, tracked change rather than a silent rename.
  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("button", { name: "Save version" })).toBeEnabled({ timeout: 10_000 });

  // 6. Preview: the live-preview iframe reflects the generated, corrected page
  const previewFrame = page.frameLocator('iframe[title="Live preview"]');
  await expect(previewFrame.locator("html")).toBeVisible();
  await expect(previewFrame.locator("body")).not.toBeEmpty();

  // 7. Export ZIP — a real file download (window.location.href to a Content-Disposition
  // response), not a synthetic anchor click.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.getByRole("button", { name: "Export ZIP" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
});
