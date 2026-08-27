import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_CLASSES, splitForKey } from "@sketch2ui/shared-types";
import type { Split } from "@sketch2ui/shared-types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root is scripts/src -> ../.. */
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const DATASET_DIR = path.join(REPO_ROOT, "ml", "dataset");
export const UPLOADS_DIR = path.join(REPO_ROOT, "data", "uploads");
export const STORE_FILE = path.join(REPO_ROOT, "backend", "data", "store.json");

export const CLASSES_FILE = path.join(DATASET_DIR, "classes.txt");
export const DATA_YAML = path.join(DATASET_DIR, "data.yaml");

export { SPLITS } from "@sketch2ui/shared-types";
export type { Split } from "@sketch2ui/shared-types";
import { SPLITS } from "@sketch2ui/shared-types";

/**
 * The frozen class list. Index = YOLO class id, so this order IS the label-file
 * contract: reordering it silently invalidates every existing .txt label.
 * Derived from ALL_CLASSES so the taxonomy stays the single source of truth;
 * `verifyClassesFile` guards against the taxonomy being reordered underneath us.
 */
export const CLASS_LIST: readonly string[] = ALL_CLASSES;

export const CLASS_INDEX: ReadonlyMap<string, number> = new Map(
  CLASS_LIST.map((name, index) => [name, index])
);

/**
 * Deterministic split assignment — plan section 9.7.
 * Delegates to shared-types so the API's approval flow and this exporter cannot drift.
 */
export function splitForAsset(assetId: string): Split {
  return splitForKey(assetId);
}

export function imagesDir(split: Split): string {
  return path.join(DATASET_DIR, "images", split);
}

export function labelsDir(split: Split): string {
  return path.join(DATASET_DIR, "labels", split);
}

/**
 * Filename prefixes owned by import-external-datasets.ts. Manual exports carry no
 * prefix, so `export-yolo-dataset.ts --clean` uses this to avoid deleting imported
 * data it cannot regenerate.
 */
export const EXTERNAL_PREFIXES = ["hdwe_", "wf_"] as const;

/** Prefix for approved correction samples (section 36 feedback loop). Written by
 *  export-yolo-dataset.ts, kept distinct so all three sources stay separable. */
export const CORRECTION_PREFIX = "corr_";

export function isExternalFile(fileName: string): boolean {
  return EXTERNAL_PREFIXES.some((p) => fileName.startsWith(p));
}

export function isCorrectionFile(fileName: string): boolean {
  return fileName.startsWith(CORRECTION_PREFIX);
}

/**
 * Count every label file currently on disk, across all sources. Both scripts report
 * against this so their summaries describe the real merged dataset rather than only
 * the rows that run happened to write.
 */
export function tallyDatasetOnDisk(): {
  perClass: Map<string, number>;
  images: Record<Split, number>;
  labels: number;
} {
  const perClass = new Map<string, number>();
  const images: Record<Split, number> = { train: 0, val: 0, test: 0 };
  let labels = 0;

  for (const split of SPLITS) {
    const dir = labelsDir(split);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".txt")) continue;
      images[split] += 1;
      for (const line of fs.readFileSync(path.join(dir, entry), "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const name = CLASS_LIST[Number(trimmed.split(/\s+/)[0])];
        if (name) {
          perClass.set(name, (perClass.get(name) ?? 0) + 1);
          labels += 1;
        }
      }
    }
  }
  return { perClass, images, labels };
}
