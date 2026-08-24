import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Test isolation guard — runs before any test module is imported.
 *
 * THIS FILE EXISTS TO PREVENT DATA LOSS. `db.reset()` in jsonStore.ts calls `persist()`,
 * which writes to `env.storeFile`. `env.storeFile` defaults to
 * `apps/api/data/store.json` — the REAL store holding 15 projects and 393 detections.
 * A repository test that resets the store without redirecting that path first would
 * silently destroy it.
 *
 * So: point STORE_FILE at a throwaway file, then assert the redirect actually took.
 * The assertion is the important half — a silently-ignored env var would leave the
 * tests looking fine while pointed at real data.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketch2ui-api-test-"));
const tempStore = path.join(tempDir, "store.json");

process.env.STORE_FILE = tempStore;

// Belt and braces: refuse to run if anything still resolves to a real-looking store.
const resolved = process.env.STORE_FILE;
if (!resolved || !resolved.includes("sketch2ui-api-test-")) {
  throw new Error(
    `Test store isolation failed: STORE_FILE is "${resolved}". Refusing to run tests ` +
      "against a store that is not a throwaway temp file."
  );
}
if (resolved.includes(path.join("apps", "api", "data"))) {
  throw new Error("Test store isolation failed: STORE_FILE points at the real data dir.");
}

fs.writeFileSync(tempStore, JSON.stringify({}), "utf-8");
