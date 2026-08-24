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
  },
});
