import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// Phase D3 — Minimum Viable Multi-Page. Proves the one thing golden-path.spec.ts and
// inspector-overrides.spec.ts can't (both only ever touch a project's single default
// page): that a second page has its own independent asset/detections/code, and that
// exporting bundles every page into one ZIP (index.html + page-N.html + one shared
// styles.css) — see docs/execution/d3-multipage-handoff.md step 5.

const FIXTURE_SKETCH = path.join(__dirname, "fixtures", "sketch.png");

async function uploadDetectAndSave(page: import("@playwright/test").Page) {
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_SKETCH);
  const detectButton = page.getByRole("button", { name: /^Detect/ });
  await expect(detectButton).toBeVisible();
  await detectButton.click();
  await expect(page.getByText(/1 box from the detector/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("button", { name: "Save version" })).toBeEnabled({ timeout: 10_000 });
}

test("a second page has independent content and both pages export together", async ({ page }) => {
  await registerAndLogin(page, `multi-page-${Date.now()}@e2e.local`);

  await page.goto("/app");
  await page.getByPlaceholder("New project name").fill("E2E Multi Page");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/app\/projects\/[^/]+$/);

  // Page 1: upload, detect, generate — same flow as golden-path.spec.ts.
  await expect(page.getByRole("button", { name: "Page 1", exact: true })).toBeVisible();
  await uploadDetectAndSave(page);

  // docs/design/FINAL_SAAS_DESIGN_DIRECTION.md §6 — deliberate e2e-breaking change,
  // updated in the same change that introduces it (same discipline as the Save
  // version rename in project-rename.spec.ts): once an asset exists, page management
  // lives in the Navigator's "Pages" tab, not a top strip. The Navigator defaults to
  // "Layers" so the detect/correct loop stays reachable without an extra click.
  await page.getByRole("tab", { name: "Pages" }).click();
  await page.getByRole("button", { name: /Add page/ }).click();
  await expect(page.getByRole("button", { name: "Page 2", exact: true })).toBeVisible();

  // Page 2 gets its own upload/detect/generate cycle, isolated from Page 1's.
  await uploadDetectAndSave(page);

  // Switching back to Page 1 must still show Page 1's own state, not Page 2's —
  // proven by the tree/canvas already having a detection without re-running Detect.
  // The Navigator remounted fresh (WorkspaceBody unmounts between pages while a page
  // has no asset yet) and defaults back to "Layers", so "Pages" needs reselecting.
  await page.getByRole("tab", { name: "Pages" }).click();
  await page.getByRole("button", { name: "Page 1", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Detect/ })).toBeVisible();
  await expect(page.locator("svg g rect").first()).toBeVisible();

  // Cross-page links need no new mechanism (docs/execution/d3-multipage-handoff.md
  // step 7's explicit call-out): set this page's detection to link to Page 2 via the
  // existing Content Inspector, and confirm the export carries the relative href
  // through unchanged.
  const treeNode = page.locator("ul.p-2 > li > button").first();
  await treeNode.click();
  await page.locator("#detection-class").selectOption("link");
  await page.locator('button[title="Save this class and regenerate the code"]').click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Content", exact: true }).click();
  await page.locator("#content-href").fill("./page-2.html");
  const applyContent = page.locator('button[title="Save this content and regenerate the code"]');
  await applyContent.click();
  await expect(applyContent).toBeDisabled({ timeout: 10_000 });

  await page.getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("button", { name: "Save version" })).toBeEnabled({ timeout: 10_000 });

  // Export bundles every page into one ZIP.
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    page.getByRole("button", { name: "Export ZIP" }).click(),
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const listing = execFileSync("unzip", ["-l", downloadPath!]).toString();
  expect(listing).toMatch(/index\.html/);
  expect(listing).toMatch(/page-2\.html/);
  expect(listing.match(/styles\.css/g)?.length).toBe(1);
  // Each page's own original sketch is bundled separately, proving the crops/
  // source-sketch bundling is genuinely per-page, not just the home page's.
  expect(listing).toMatch(/source-sketch-index\./);
  expect(listing).toMatch(/source-sketch-page-2\./);

  const indexHtml = execFileSync("unzip", ["-p", downloadPath!, "index.html"]).toString();
  expect(indexHtml).toContain('href="./page-2.html"');
});
