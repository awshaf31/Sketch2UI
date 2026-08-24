import { v4 as uuid } from "uuid";
import type { PageBoundary, PageBoundaryRecord, PageBoundarySource } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";

// Persisted page boundaries — plan §10.6.
//
// STICKY-CORRECTION RULE. This is the same rule Step 9 established for detections, and
// it exists because this codebase already shipped the opposite bug once: a re-detect
// silently clobbered the user's corrected boxes. A manual boundary must survive a later
// auto-detection run for exactly the same reason.
//
//   auto   result -> written only if no MANUAL record exists for the asset
//   manual result -> always written, and marks the asset user-owned from then on

export function getBoundary(assetId: string): PageBoundaryRecord | undefined {
  return db.state.pageBoundaries.find((b) => b.assetId === assetId);
}

export function isManuallyAdjusted(assetId: string): boolean {
  return getBoundary(assetId)?.source === "manual";
}

/**
 * Persist a boundary for an asset.
 *
 * Returns the record actually in force afterwards — which, for an `auto` write against a
 * manually-adjusted asset, is the PRE-EXISTING manual record, not the new one.
 */
export function saveBoundary(
  projectId: string,
  assetId: string,
  boundary: PageBoundary,
  source: PageBoundarySource
): { record: PageBoundaryRecord; preservedManual: boolean } {
  const existing = getBoundary(assetId);

  if (source === "auto" && existing?.source === "manual") {
    // The whole point of the rule: auto-detection does not get to overwrite a human.
    return { record: existing, preservedManual: true };
  }

  const now = new Date().toISOString();

  if (existing) {
    Object.assign(existing, {
      polygon: boundary.polygon,
      confidence: boundary.confidence,
      method: boundary.method,
      areaFraction: boundary.areaFraction,
      applied: boundary.applied,
      overlapThreshold: boundary.overlapThreshold,
      source,
      updatedAt: now,
    });
    db.save();
    return { record: existing, preservedManual: false };
  }

  const record: PageBoundaryRecord = {
    id: uuid(),
    projectId,
    assetId,
    polygon: boundary.polygon,
    confidence: boundary.confidence,
    method: boundary.method,
    areaFraction: boundary.areaFraction,
    applied: boundary.applied,
    overlapThreshold: boundary.overlapThreshold,
    source,
    createdAt: now,
    updatedAt: now,
  };
  db.state.pageBoundaries.push(record);
  db.save();
  return { record, preservedManual: false };
}

export function toPageBoundary(record: PageBoundaryRecord): PageBoundary {
  return {
    polygon: record.polygon,
    confidence: record.confidence,
    method: record.method,
    areaFraction: record.areaFraction,
    applied: record.applied,
    overlapThreshold: record.overlapThreshold,
  };
}
