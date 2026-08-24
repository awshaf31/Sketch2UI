import type { BBox } from "./detection.js";
import type { Split } from "./dataset-split.js";

// Approved training sample — plan section 8.8 (training_samples), FR-11 (§3.11),
// section 36 (training feedback loop), section 22.1 ("quality-check" before a dataset
// version).
//
// `approved` is an EXPLICIT human action, not inferred from data state. The whole point
// of section 22's quality-check step is that a person confirms a set of boxes is fit to
// train on before it becomes training data — the same discipline the annotation guide
// applies to hand labelling.

/** A frozen copy of one detection at approval time. */
export interface TrainingSampleBox {
  className: string;
  bbox: BBox;
  /** Where the box came from originally. Post-correction both are equally trustworthy
   *  ground truth, but the provenance is worth keeping for section 36 analysis. */
  source: "manual" | "model" | "imported";
  /** Present when a model version originally proposed this box. */
  modelVersionId?: string;
}

export interface TrainingSample {
  id: string;
  projectId: string;
  imageAssetId: string;
  /** The stored image this snapshot belongs to (section 8.8's annotation_asset_key). */
  storageKey: string;
  approved: boolean;
  approvedAt: string;
  datasetSplit: Split;
  /**
   * Boxes are SNAPSHOT at approval time rather than re-read from the live detections
   * table. Later edits to the project must not silently rewrite what a human already
   * signed off on — that would defeat the approval gate.
   */
  boxes: TrainingSampleBox[];
  imageWidth: number;
  imageHeight: number;
  createdAt: string;
}
