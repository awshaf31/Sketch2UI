import path from "node:path";
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// Dashboard "start with your sketch" hero — a direct product request to let a sketch
// be attached to a project at creation time, instead of requiring a trip into the
// (empty) project workspace first. See apps/web/src/pages/Dashboard.tsx's header
// comment for why this needed zero API contract changes: a project already gets a
// default page on creation, and the existing api.uploadAsset() is just called once
// more, before navigating.
//
// golden-path.spec.ts/inspector-overrides.spec.ts/multi-page.spec.ts all cover the
// "create with no file, upload later in the workspace" path already — this suite
// isolates the new "file staged on the Dashboard before the project exists" path.

const FIXTURE_SKETCH = path.join(__dirname, "fixtures", "sketch.png");

test("a sketch staged on the Dashboard lands on the new project's default page", async ({ page }) => {
  await registerAndLogin(page, `dashboard-upload-${Date.now()}@e2e.local`);

  await page.goto("/");

  // Stage the sketch before the project exists — the Dashboard's hero dropzone, not
  // the workspace's.
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_SKETCH);
  await expect(page.getByText("sketch.png")).toBeVisible();

  await page.getByPlaceholder("New project name").fill("E2E Dashboard Upload");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // The workspace should open with the sketch already attached to "Page 1" — the
  // Detect button (which only ever renders once an asset exists) should be visible
  // immediately, with no dropzone/upload step required.
  await expect(page.getByRole("button", { name: /^Detect/ })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test("creating a project with no sketch staged still shows the upload dropzone", async ({ page }) => {
  await registerAndLogin(page, `dashboard-no-upload-${Date.now()}@e2e.local`);

  await page.goto("/");
  await page.getByPlaceholder("New project name").fill("E2E Dashboard No Upload");
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  // The workspace's own upload input is present (though visually hidden behind the
  // styled "Choose file" label, same as the Dashboard's — see UploadDropzone.tsx) and
  // no Detect button renders, since there is no asset yet.
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Detect/ })).toHaveCount(0);
});
