import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/**
 * Load the repo-root .env FIRST, so the Prisma contract arm can find DATABASE_URL.
 *
 * ORDER IS LOAD-BEARING. `.env` also defines STORE_FILE, pointing at the REAL store.
 * It is loaded before the redirect below so the redirect always wins; if these were
 * swapped, .env would silently re-point the tests at production data. The assertion
 * further down is what makes that guarantee checkable rather than assumed.
 *
 * Parsed by hand rather than pulling in dotenv: it is a handful of KEY=value lines and
 * a test-only dependency is not worth it.
 */
const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  for (const line of fs.readFileSync(rootEnv, "utf-8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    // Existing env wins, so an explicit `DATABASE_URL=... vitest` override still works.
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sketch2ui-api-test-"));
const tempStore = path.join(tempDir, "store.json");

// Unconditional overwrite — this must beat whatever .env said.
process.env.STORE_FILE = tempStore;

// A harmless placeholder so auth.routes.test.ts's Google sign-in cases don't 501 on
// "not configured" — real verification (google-auth-library) is mocked in that file,
// so this value is never actually checked against Google, only used as the expected
// `audience` argument the mock asserts against.
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";

/**
 * Redirect Postgres tests to a DEDICATED test database.
 *
 * SECOND DATA-LOSS GUARD. The Prisma contract arm calls `project.deleteMany({})` in
 * beforeEach, and every other table cascades from projects. Pointed at the dev database
 * that would wipe all 445 migrated rows — silently, on an ordinary `npm test`.
 *
 * So: rewrite the database name in DATABASE_URL to `<name>_test` unless the caller has
 * already aimed at a *_test database. Skipping this rewrite is not an option worth
 * offering; a test suite that can destroy development data on invocation is a bug.
 */
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const rewritten = dbUrl.replace(/\/([^/?]+)(\?|$)/, (_m, name: string, tail: string) =>
    name.endsWith("_test") ? `/${name}${tail}` : `/${name}_test${tail}`
  );
  process.env.DATABASE_URL = rewritten;

  if (!/\/[^/?]*_test(\?|$)/.test(process.env.DATABASE_URL)) {
    throw new Error(
      "Test database isolation failed: DATABASE_URL does not target a *_test database. " +
        "Refusing to run destructive repository tests against it."
    );
  }
}

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
