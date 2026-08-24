// Deterministic dataset split — plan section 9.7.
//
// This lives in shared-types because BOTH the API (when approving a training sample)
// and the export scripts need it, and they must agree exactly. Two implementations
// would eventually drift and silently leak an image between splits.

export const SPLITS = ["train", "val", "test"] as const;
export type Split = (typeof SPLITS)[number];

/**
 * Assign a split from a stable key (asset id, or a prefixed filename).
 *
 * Hashing rather than shuffling means re-running an export never moves an image
 * between splits, so a sketch cannot leak from train into test on a later run.
 *
 * Buckets: 0-74 train (75%), 75-89 val (15%), 90-99 test (10%) — the section 9.7
 * recommendation of train 70-80 / val 10-20 / test 10-15.
 */
export function splitForKey(key: string): Split {
  // FNV-1a, 32-bit. Small, stable, dependency-free; we need reproducibility, not
  // cryptographic strength.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  const bucket = hash % 100;
  if (bucket < 75) return "train";
  if (bucket < 90) return "val";
  return "test";
}
