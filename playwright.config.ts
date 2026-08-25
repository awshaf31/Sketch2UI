import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Golden-path E2E suite — plan §24. Runs the whole stack (mock CV worker, API, web)
// against THROWAWAY storage, entirely isolated from real dev data:
//
//   - A fresh temp directory per run for the JSON store/uploads/exports (same isolation
//     pattern as apps/api/vitest.setup.ts, applied here instead of a Postgres rewrite
//     since PERSISTENCE_DRIVER is simply never set — the API defaults to JSON).
//   - Dedicated ports (4100/5273/8099) so this suite can run alongside a normal
//     `npm run dev` session without colliding with it.
//   - A mock CV worker (e2e/mock-cv-worker.ts) standing in for services/cv-worker, so
//     the suite is deterministic and does not depend on the real model being running.
//     Real CV inference is exercised separately (services/cv-worker's own pytest suite,
//     and the manual regression checklist) — see e2e/mock-cv-worker.ts's header comment.

const API_PORT = 4100;
const WEB_PORT = 5273;
const MOCK_CV_WORKER_PORT = 8099;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketch2ui-e2e-"));
const dataDir = path.join(tempDir, "data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
fs.mkdirSync(path.join(dataDir, "exports"), { recursive: true });

const apiEnv = {
  PORT: String(API_PORT),
  CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
  DATA_DIR: dataDir,
  UPLOADS_DIR: path.join(dataDir, "uploads"),
  EXPORTS_DIR: path.join(dataDir, "exports"),
  STORE_FILE: path.join(dataDir, "store.json"),
  CV_WORKER_URL: `http://127.0.0.1:${MOCK_CV_WORKER_PORT}`,
  // PERSISTENCE_DRIVER deliberately absent — defaults to "json", so this suite never
  // touches Postgres (dev or test) regardless of what the real .env says.
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Pinned to the system-installed Chrome rather than Playwright's own managed
      // chromium build: this environment's sandbox cannot resolve cdn.playwright.dev
      // (Playwright's browser-binary CDN) even though general internet access works,
      // so the "chrome-headless-shell" variant `headless: true` normally downloads on
      // demand is unobtainable here. `channel: "chrome"` uses whatever Chrome is
      // already on the machine instead — /Applications/Google Chrome.app on this box.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: [
    {
      command: "npx tsx e2e/mock-cv-worker.ts",
      cwd: __dirname,
      port: MOCK_CV_WORKER_PORT,
      env: { MOCK_CV_WORKER_PORT: String(MOCK_CV_WORKER_PORT) },
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: "npx tsx src/server.ts",
      cwd: path.join(__dirname, "apps/api"),
      port: API_PORT,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: path.join(__dirname, "apps/web"),
      port: WEB_PORT,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 20_000,
    },
  ],
});
