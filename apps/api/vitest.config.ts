import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Runs before any test module loads, so STORE_FILE is redirected away from the real
    // store before jsonStore.ts reads it. See vitest.setup.ts for why this matters.
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // dist/ carries compiled copies of these same tests after `npm run build`; without
    // this they would be collected twice and every count would double (the exact
    // artefact noted in the Phase 2 report for packages/shared-types).
    exclude: ["**/node_modules/**", "**/dist/**"],

    /**
     * Run test FILES sequentially.
     *
     * The Prisma contract arms share ONE test database and each clears it in
     * `beforeEach` (`project.deleteMany({})`, which cascades). Run in parallel — vitest's
     * default — the Project suite's reset deletes the parent project the Asset suite is
     * mid-way through using, producing foreign-key violations that look like adapter
     * bugs but are pure test-harness interference. It surfaced the moment a second
     * database-backed suite existed.
     *
     * The principled alternative is a schema (or database) per worker. That is worth
     * doing if the suite grows enough for wall-clock time to matter; today the whole
     * run is well under a second, so paying for isolation with complexity would be a
     * bad trade.
     */
    fileParallelism: false,
  },
});
