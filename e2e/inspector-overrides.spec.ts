import path from "node:path";
import { expect, test } from "@playwright/test";
import { registerAndLogin } from "./auth.js";

// Targeted Inspector coverage — plan §24 (F19), items C (Geometry) and E (Content
// security). The golden path already proves the full pipeline end to end and the
// Detection-group class-change flow; these two tests isolate the two highest-risk
// Inspector behaviors it doesn't otherwise exercise: that an out-of-bounds/invalid
// geometry override actually moves the rendered box (not just the stored value), and
// that a content override can never smuggle a `<script>` into the live preview.
//
// Same mocked-detection, throwaway-storage setup as golden-path.spec.ts.

const FIXTURE_SKETCH = path.join(__dirname, "fixtures", "sketch.png");

async function createProjectAndDetect(page: import("@playwright/test").Page, name: string) {
  await registerAndLogin(page, `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}@e2e.local`);

  await page.goto("/");
  await page.getByPlaceholder("New project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.waitForURL(/\/projects\/[^/]+$/);

  await page.locator('input[type="file"]').setInputFiles(FIXTURE_SKETCH);
  const detectButton = page.getByRole("button", { name: /^Detect/ });
  await expect(detectButton).toBeVisible();
  await detectButton.click();
  await expect(page.getByText(/1 box from the detector/)).toBeVisible({ timeout: 15_000 });

  const treeNode = page.locator("ul.p-2 > li > button").first();
  await treeNode.click();
}

test("geometry override moves the box in the canvas and Reset reverts it", async ({ page }) => {
  await createProjectAndDetect(page, "E2E Geometry Override");

  // The single detection's own rect is always the first <rect> inside its <g> — the
  // 4 resize handles (also <rect>s) only appear after it, once selected.
  const boxRect = page.locator("svg g rect").first();
  const readWidth = async () => parseFloat((await boxRect.getAttribute("width")) ?? "0");
  const initialWidth = await readWidth();
  expect(initialWidth).toBeGreaterThan(0);

  // Geometry is a collapsed-by-default accordion section (Phase 2G) — expand it
  // before its fields are interactable, the same step a real user takes.
  await page.getByRole("button", { name: "Geometry", exact: true }).click();
  await page.locator("#geo-width").fill("0.6");
  const applyGeometry = page.locator(
    'button[title="Save this position/size and regenerate the code"]'
  );
  await expect(applyGeometry).toBeEnabled();
  await applyGeometry.click();
  // Apply/Reset flip `disabled` synchronously on click (before the persist+regenerate
  // round trip resolves), so it's not a safe signal that the change has landed — poll
  // the actual rendered box instead of trusting button state as a completion proxy.
  await expect.poll(readWidth, { timeout: 10_000 }).toBeGreaterThan(initialWidth * 1.5);

  const resetGeometry = page.locator(
    'button[title="Clear this component\'s geometry override and revert to the raw detection bbox"]'
  );
  await expect(resetGeometry).toBeEnabled();
  await resetGeometry.click();
  await expect
    .poll(async () => Math.abs((await readWidth()) - initialWidth), { timeout: 10_000 })
    .toBeLessThan(1);
});

test("content override rejects <script> and a valid edit reaches the preview verbatim", async ({
  page,
}) => {
  await createProjectAndDetect(page, "E2E Content Security");

  // The mocked detection is class "button", which has no applicable content fields
  // (Appendix P) — reclass to "text" first, same PATCH path golden-path.spec.ts uses.
  await page.locator("#detection-class").selectOption("text");
  await page.locator('button[title="Save this class and regenerate the code"]').click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // Content is a collapsed-by-default accordion section (Phase 2G) — expand it
  // before its fields are interactable, the same step a real user takes.
  await page.getByRole("button", { name: "Content", exact: true }).click();
  const contentText = page.locator("#content-text");
  const applyContent = page.locator('button[title="Save this content and regenerate the code"]');

  // Malicious input: the API must reject it (400), and it must never reach the
  // sandboxed preview iframe in any form — not as a script, not as raw markup.
  await contentText.fill("<script>alert(1)</script>");
  await applyContent.click();
  await expect(page.getByText(/may not contain/i)).toBeVisible({ timeout: 10_000 });

  const previewFrame = page.frameLocator('iframe[title="Live preview"]');
  await expect(previewFrame.locator("script")).toHaveCount(0);

  // A valid edit succeeds and appears as plain text in the preview.
  await contentText.fill("Hello world");
  await applyContent.click();
  await expect(applyContent).toBeDisabled({ timeout: 10_000 });
  await expect(previewFrame.getByText("Hello world")).toBeVisible();
});
