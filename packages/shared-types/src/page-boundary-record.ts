import type { PageBoundary, PageBoundaryMethod } from "./page-boundary.js";

// Persisted page boundary — plan §10.6 (Strategy C manual override), §8 storage.
//
// STICKY-CORRECTION PRINCIPLE (same rule Step 9 established for detections):
// once a human adjusts a boundary, a later auto-detection run must NOT overwrite it.
// Detections already work this way — a corrected model box flips to source "manual" so
// re-detect cannot clobber it. Boundaries follow the identical rule via `source`.

export type PageBoundarySource = "auto" | "manual";

export interface PageBoundaryRecord {
  id: string;
  projectId: string;
  pageId: string;
  /** One boundary per asset — this is the key. */
  assetId: string;
  polygon: PageBoundary["polygon"];
  confidence: number;
  method: PageBoundaryMethod;
  areaFraction: number;
  applied: boolean;
  overlapThreshold?: number;
  /**
   * "manual" marks a user adjustment. Auto-detection refuses to overwrite a manual
   * record — the sticky-correction rule above.
   */
  source: PageBoundarySource;
  createdAt: string;
  updatedAt: string;
}
