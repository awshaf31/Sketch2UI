import type { TrainingSample } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { TrainingRepository } from "../types.js";

/**
 * JSON-backed TrainingRepository — Phase 8 compatibility adapter.
 *
 * `upsertApproval` takes a FULLY-BUILT TrainingSample (the caller mints the id and
 * timestamps) and supersedes whatever snapshot already exists for that asset — a
 * re-approval replaces the whole row, including its id, rather than patching fields
 * on the old one. The exporter would otherwise emit the same image twice if this
 * were additive.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonTrainingRepository implements TrainingRepository {
  async findByAsset(assetId: string): Promise<TrainingSample | null> {
    const found = db.state.trainingSamples.find((s) => s.imageAssetId === assetId);
    return found ? detach(found) : null;
  }

  async upsertApproval(
    sample: TrainingSample
  ): Promise<{ sample: TrainingSample; replacedPrevious: boolean }> {
    const existingIndex = db.state.trainingSamples.findIndex(
      (s) => s.imageAssetId === sample.imageAssetId
    );
    const replacedPrevious = existingIndex >= 0;
    if (replacedPrevious) db.state.trainingSamples.splice(existingIndex, 1);
    db.state.trainingSamples.push(detach(sample));
    db.save();
    return { sample: detach(sample), replacedPrevious };
  }

  async listAll(): Promise<TrainingSample[]> {
    return db.state.trainingSamples.map(detach);
  }
}
