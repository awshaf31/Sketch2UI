// Normalized bounding box: all values in [0, 1] relative to source image size.
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type DetectionSource = "model" | "manual" | "imported";
export type DetectionStatus = "active" | "deleted" | "rejected";

export interface Detection {
  id: string;
  projectId: string;
  sourceAssetId: string;
  className: string;
  confidence: number; // 1.0 for manual annotations
  bbox: BBox;
  status: DetectionStatus;
  source: DetectionSource;
  modelVersionId?: string;
  /**
   * The class the MODEL originally proposed, recorded when a human corrects a
   * model-sourced detection. Without this, section 36's "frequently corrected classes"
   * signal measures what boxes were corrected TO rather than what the model got wrong.
   */
  originalClassName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectionInput {
  className: string;
  bbox: BBox;
  source?: DetectionSource;
  confidence?: number;
}
