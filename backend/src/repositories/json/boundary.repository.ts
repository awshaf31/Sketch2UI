import { v4 as uuid } from "uuid";
import type { PageBoundary, PageBoundaryRecord, PageBoundarySource } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { BoundaryRepository } from "../types.js";

/**
 * JSON-backed BoundaryRepository — Phase 8 compatibility adapter.
 *
 * Same detached-read discipline as the other JSON adapters (see project.repository.ts's
 * doc comment). `saveRespectingManual` carries forward the sticky-correction rule
 * unchanged from boundaries.service.ts's `saveBoundary`: an `auto` write is refused
 * once a `manual` record exists for the asset, and the pre-existing manual record is
 * returned instead — one domain operation rather than a read-then-write the caller
 * could get wrong.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonBoundaryRepository implements BoundaryRepository {
  async findByAsset(assetId: string): Promise<PageBoundaryRecord | null> {
    const found = db.state.pageBoundaries.find((b) => b.assetId === assetId);
    return found ? detach(found) : null;
  }

  async saveRespectingManual(
    projectId: string,
    pageId: string,
    assetId: string,
    boundary: PageBoundary,
    source: PageBoundarySource
  ): Promise<{ record: PageBoundaryRecord; preservedManual: boolean }> {
    const existing = db.state.pageBoundaries.find((b) => b.assetId === assetId);

    if (source === "auto" && existing?.source === "manual") {
      // The whole point of the rule: auto-detection does not get to overwrite a human.
      return { record: detach(existing), preservedManual: true };
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
      return { record: detach(existing), preservedManual: false };
    }

    const record: PageBoundaryRecord = {
      id: uuid(),
      projectId,
      pageId,
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
    return { record: detach(record), preservedManual: false };
  }
}
