/**
 * Dataset quality report — execution plan Phase 5 (§5.2, §5.4).
 *
 * Read-only. Never writes to ml/dataset/, apps/api/data/store.json, or anywhere else —
 * this is a diagnostic tool, not an export/mutation script (compare
 * export-yolo-dataset.ts, which does write). Reports directly against whatever is
 * currently on disk under ml/dataset/{images,labels}/{train,val,test}/, i.e. the FULL
 * taxonomy corpus, not the derived 16-class ml/dataset/v1/ subset.
 *
 * Checks (plan §5.4):
 *   - per-class / per-split instance counts (§5.2's matrix columns)
 *   - zero-area boxes, non-finite coordinates, out-of-bounds boxes
 *   - empty label files (flagged, not treated as an error — could be a deliberate
 *     §9.5 background/negative, but usually is not; see the printed caveat)
 *   - cross-split filename collisions (leakage by stem)
 *   - exact byte-identical duplicate images (MD5), which the filename check above
 *     cannot catch since re-uploads get a fresh asset UUID / filename
 *
 * Usage:
 *   npm run report:dataset-quality
 *   npm run report:dataset-quality -- --json
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CLASS_LIST, SPLITS, imagesDir, labelsDir, type Split } from "./dataset-layout.js";

const JSON_OUT = new Set(process.argv.slice(2)).has("--json");

interface PerClassRow {
  className: string;
  train: number;
  val: number;
  test: number;
  total: number;
}

interface DuplicateGroup {
  md5: string;
  files: string[]; // "split/filename"
}

interface QualityReport {
  imagesPerSplit: Record<Split, number>;
  labelsPerSplit: Record<Split, number>;
  perClass: PerClassRow[];
  zeroInstanceClasses: string[];
  zeroAreaBoxes: string[];
  nonFiniteBoxes: string[];
  outOfBoundsBoxes: string[];
  emptyLabelFiles: string[];
  crossSplitStemCollisions: Array<{ stem: string; splits: Split[] }>;
  duplicateImageGroups: DuplicateGroup[];
  duplicateExtraImageCount: number;
}

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f !== ".gitkeep");
}

function buildReport(): QualityReport {
  const perClassBySplit = new Map<string, Record<Split, number>>(
    CLASS_LIST.map((c) => [c, { train: 0, val: 0, test: 0 }])
  );

  const imagesPerSplit = { train: 0, val: 0, test: 0 } as Record<Split, number>;
  const labelsPerSplit = { train: 0, val: 0, test: 0 } as Record<Split, number>;
  const zeroAreaBoxes: string[] = [];
  const nonFiniteBoxes: string[] = [];
  const outOfBoundsBoxes: string[] = [];
  const emptyLabelFiles: string[] = [];
  const stemsBySplit: Record<Split, Set<string>> = { train: new Set(), val: new Set(), test: new Set() };
  const hashes = new Map<string, string[]>(); // md5 -> ["split/file", ...]

  for (const split of SPLITS) {
    const images = listFiles(imagesDir(split));
    const labels = listFiles(labelsDir(split));
    imagesPerSplit[split] = images.length;
    labelsPerSplit[split] = labels.length;

    for (const file of images) {
      stemsBySplit[split].add(path.parse(file).name);
      const buf = fs.readFileSync(path.join(imagesDir(split), file));
      const md5 = crypto.createHash("md5").update(buf).digest("hex");
      const key = `${split}/${file}`;
      const existing = hashes.get(md5);
      if (existing) existing.push(key);
      else hashes.set(md5, [key]);
    }

    for (const labelFile of labels) {
      const full = path.join(labelsDir(split), labelFile);
      const content = fs.readFileSync(full, "utf-8").trim();
      if (content === "") {
        emptyLabelFiles.push(`${split}/${labelFile}`);
        continue;
      }
      for (const line of content.split("\n")) {
        const parts = line.trim().split(/\s+/).map(Number);
        if (parts.length !== 5) continue;
        const [classId, cx, cy, w, h] = parts;
        const className = CLASS_LIST[classId];
        const tag = `${split}/${labelFile}: ${line.trim()}`;

        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(w) || !Number.isFinite(h)) {
          nonFiniteBoxes.push(tag);
          continue;
        }
        if (w <= 0 || h <= 0) zeroAreaBoxes.push(tag);

        const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
        const TOLERANCE = 0.001;
        if (x0 < -TOLERANCE || x1 > 1 + TOLERANCE || y0 < -TOLERANCE || y1 > 1 + TOLERANCE) {
          outOfBoundsBoxes.push(tag);
        }

        if (className) {
          const row = perClassBySplit.get(className)!;
          row[split] += 1;
        }
      }
    }
  }

  const perClass: PerClassRow[] = CLASS_LIST.map((className) => {
    const row = perClassBySplit.get(className)!;
    return { className, ...row, total: row.train + row.val + row.test };
  }).sort((a, b) => b.total - a.total);

  const zeroInstanceClasses = perClass.filter((r) => r.total === 0).map((r) => r.className);

  const crossSplitStemCollisions: Array<{ stem: string; splits: Split[] }> = [];
  const stemSplitMap = new Map<string, Split[]>();
  for (const split of SPLITS) {
    for (const stem of stemsBySplit[split]) {
      const list = stemSplitMap.get(stem) ?? [];
      list.push(split);
      stemSplitMap.set(stem, list);
    }
  }
  for (const [stem, splits] of stemSplitMap) {
    if (splits.length > 1) crossSplitStemCollisions.push({ stem, splits });
  }

  const duplicateImageGroups: DuplicateGroup[] = [...hashes.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([md5, files]) => ({ md5, files }));
  const duplicateExtraImageCount = duplicateImageGroups.reduce(
    (sum, g) => sum + (g.files.length - 1),
    0
  );

  return {
    imagesPerSplit,
    labelsPerSplit,
    perClass,
    zeroInstanceClasses,
    zeroAreaBoxes,
    nonFiniteBoxes,
    outOfBoundsBoxes,
    emptyLabelFiles,
    crossSplitStemCollisions,
    duplicateImageGroups,
    duplicateExtraImageCount,
  };
}

function printReport(r: QualityReport): void {
  const totalImages = SPLITS.reduce((sum, s) => sum + r.imagesPerSplit[s], 0);
  const totalLabels = r.perClass.reduce((sum, row) => sum + row.total, 0);

  console.log("Dataset quality report — execution plan Phase 5 (§5.2, §5.4)\n");
  console.log("Read-only: this script never writes to ml/dataset/ or the store.\n");

  console.log("─── Images per split ───\n");
  for (const s of SPLITS) {
    console.log(`  ${s.padEnd(6)} images=${String(r.imagesPerSplit[s]).padStart(4)}  labels=${String(r.labelsPerSplit[s]).padStart(4)}`);
  }
  console.log(`  TOTAL  images=${totalImages}  labels=${totalLabels} instances\n`);

  console.log("─── Per-class instance counts (train/val/test/total) ───\n");
  for (const row of r.perClass) {
    if (row.total === 0) continue;
    const evaluable = row.val > 0 && row.test > 0 ? "" : "  ⚠ not evaluable (0 in val or test)";
    console.log(
      `  ${row.className.padEnd(20)} train=${String(row.train).padStart(4)} val=${String(row.val).padStart(3)} test=${String(row.test).padStart(3)}  total=${String(row.total).padStart(4)}${evaluable}`
    );
  }
  if (r.zeroInstanceClasses.length > 0) {
    console.log(`\n  ${r.zeroInstanceClasses.length} class(es) with ZERO instances anywhere:`);
    console.log(`    ${r.zeroInstanceClasses.join(", ")}`);
  }

  console.log("\n─── Label geometry checks ───\n");
  console.log(`  Zero-area boxes:    ${r.zeroAreaBoxes.length}`);
  console.log(`  Non-finite boxes:   ${r.nonFiniteBoxes.length}`);
  console.log(`  Out-of-bounds boxes: ${r.outOfBoundsBoxes.length}`);
  for (const tag of [...r.zeroAreaBoxes, ...r.nonFiniteBoxes, ...r.outOfBoundsBoxes].slice(0, 10)) {
    console.log(`    ${tag}`);
  }

  console.log("\n─── Empty label files ───\n");
  if (r.emptyLabelFiles.length === 0) {
    console.log("  None.");
  } else {
    console.log(`  ${r.emptyLabelFiles.length} file(s) — verify these are deliberate §9.5 background/`);
    console.log("  negative examples, not simply un-annotated uploads:");
    for (const f of r.emptyLabelFiles) console.log(`    ${f}`);
  }

  console.log("\n─── Cross-split leakage (same filename stem in >1 split) ───\n");
  console.log(
    r.crossSplitStemCollisions.length === 0
      ? "  None."
      : `  ${r.crossSplitStemCollisions.length} collision(s):`
  );
  for (const c of r.crossSplitStemCollisions) {
    console.log(`    ${c.stem}: ${c.splits.join(", ")}`);
  }

  console.log("\n─── Duplicate images (exact byte match, MD5) ───\n");
  if (r.duplicateImageGroups.length === 0) {
    console.log("  None.");
  } else {
    console.log(
      `  ${r.duplicateImageGroups.length} group(s), ${r.duplicateExtraImageCount} extra ` +
        "copy/copies beyond the first in each group:"
    );
    for (const g of r.duplicateImageGroups) {
      console.log(`    ${g.md5.slice(0, 10)}...  ${g.files.join(" | ")}`);
    }
    const crossSplit = r.duplicateImageGroups.filter(
      (g) => new Set(g.files.map((f) => f.split("/")[0])).size > 1
    );
    if (crossSplit.length > 0) {
      console.log(
        `\n  ⚠ ${crossSplit.length} duplicate group(s) span MORE THAN ONE SPLIT — this IS train/test leakage.`
      );
    } else {
      console.log("\n  All duplicate groups stay within a single split — no train/test leakage from these,");
      console.log("  but they still inflate per-class counts without adding real diversity (see report).");
    }
  }

  console.log("");
}

function main(): void {
  const report = buildReport();
  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  printReport(report);
}

main();
