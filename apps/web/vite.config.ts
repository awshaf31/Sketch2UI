import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// DEF-013 — route-level code splitting is driven entirely by the React.lazy() calls in
// App.tsx; Rollup derives the chunk graph from those dynamic imports.
//
// Deliberately no manualChunks here. Grouping the pages into five named chunks was
// tried and rejected: a manual chunk absorbs its whole dependency subtree, so the
// first group to be assigned swallowed React and the shared components, and the entry
// chunk then had to statically import that group — putting ~190 kB back on every
// route. Rollup's default algorithm gets this right on its own.
//
// experimentalMinChunkSize only cleans up after it: shared UI primitives (Card, Badge,
// Input…) are a few hundred bytes each and would otherwise each become their own
// request. The threshold is deliberately below the size of the smallest page chunk —
// at a larger value Rollup starts merging by size alone and happily folded Account in
// with the admin pages, which is exactly the cross-surface leak this defect is about.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 1_000,
      },
    },
  },
});
