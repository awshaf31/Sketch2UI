import { v4 as uuid } from "uuid";
import type { CorrectionRecord } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CorrectionRepository } from "../types.js";

/**
 * JSON-backed CorrectionRepository — Phase 8 compatibility adapter.
 *
 * This is the only repository in the append-only correction-history domain: no
 * update, no delete. `source` is always "user" today (see CorrectionRecord's doc
 * comment) and is set here rather than trusted from the caller.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonCorrectionRepository implements CorrectionRepository {
  async list(projectId: string, detectionId?: string): Promise<CorrectionRecord[]> {
    return db.state.correctionRecords
      .filter((r) => r.projectId === projectId && (!detectionId || r.detectionId === detectionId))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(detach);
  }

  async listByPage(pageId: string, detectionId?: string): Promise<CorrectionRecord[]> {
    return db.state.correctionRecords
      .filter((r) => r.pageId === pageId && (!detectionId || r.detectionId === detectionId))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map(detach);
  }

  async append(
    record: Omit<CorrectionRecord, "id" | "timestamp" | "source">
  ): Promise<CorrectionRecord> {
    const full: CorrectionRecord = {
      id: uuid(),
      source: "user",
      timestamp: new Date().toISOString(),
      ...record,
    };
    db.state.correctionRecords.push(full);
    db.save();
    return detach(full);
  }
}
