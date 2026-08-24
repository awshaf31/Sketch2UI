/**
 * Merge external CC BY 4.0 wireframe datasets into ml/dataset, remapping their class
 * vocabularies onto our taxonomy.
 *
 * Plan references: section 9.4 (dataset variety), section 9.7 (split policy),
 * section 22.6 (dataset versioning / recording sources), section 51 step 7.
 *
 * Both sources are CC BY 4.0 from Roboflow Universe — see the attribution section of
 * ml/dataset/README.md. Their zips are downloaded to a scratch dir and never committed.
 *
 * Like export-yolo-dataset.ts this is a standalone build-time tool: it touches only the
 * filesystem, never apps/api's request path or services/cv-worker.
 *
 * Usage:
 *   npm run import:external              # download (if needed), remap, write
 *   npm run import:external -- --dry-run # report only, write nothing
 *   npm run import:external -- --redownload
 *
 * Run `npm run export:dataset` FIRST — it regenerates classes.txt from the taxonomy and
 * rewrites the manual labels. This script reads that classes.txt as its target vocabulary.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  CLASSES_FILE,
  CLASS_INDEX,
  CLASS_LIST,
  SPLITS,
  imagesDir,
  labelsDir,
  splitForAsset,
  tallyDatasetOnDisk,
  type Split,
} from "./dataset-layout.js";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const REDOWNLOAD = args.has("--redownload");

const SCRATCH = path.join(os.tmpdir(), "sketch2ui-external-datasets");

/** `null` target = deliberately dropped. Any source class absent from a table is an
 *  unmapped surprise and is reported separately — never silently guessed at. */
type RemapTable = Record<string, string | null>;

interface SourceDataset {
  key: string;
  label: string;
  /** Filename prefix, keeping these from colliding with each other or with the
   *  manually-annotated exports. */
  prefix: string;
  url: string;
  zipName: string;
  remap: RemapTable;
  /** Mappings we are not confident in; surfaced loudly so a human eyeballs them. */
  tentative: Record<string, string>;
  attribution: string;
}

const SOURCES: SourceDataset[] = [
  {
    key: "hdwe",
    label: "Hand Drawn Web Element",
    prefix: "hdwe_",
    url: "https://app.roboflow.com/ds/IWktU7uXpF?key=G34K8pcfgH",
    zipName: "hdwe.zip",
    remap: {
      Subheading: "heading",
      Link: "link",
      Paragraph: "text",
      Form: "form",
      Heading: "heading",
      Image: "image",
      Textarea: "textarea",
      "Check Box": "checkbox",
      Button: "button",
      "Radio Button": "radio_button",
      Textbox: "input",
      "Password box": "input",
      Table: "table",
      Carousel: "carousel",
      Label: "text",
      Select: "select",
      // Dropped: redundant sub-boxes of the same Table region. Keeping them would
      // stack differently-classed detections over the same pixels.
      Pagination: null,
      "Table head": null,
      "Table row": null,
      "Table data": null,
    },
    tentative: {},
    attribution: "Roboflow Universe, CC BY 4.0",
  },
  {
    key: "wf",
    label: "wireframe",
    prefix: "wf_",
    url: "https://app.roboflow.com/ds/hn6NT7k4v9?key=WZGg2yePLe",
    zipName: "wf.zip",
    remap: {
      button: "button",
      input: "input",
      nav: "navbar",
      heading: "heading",
      footer: "footer",
      checkbox: "checkbox",
      text: "text",
      container: "section",
      // `frame` was initially mapped to `page`; spot-checking wf_0 / wf_11 / wf_12
      // disproved that — wf_12 carries TWO `frame` boxes, each landing exactly on a
      // crossed-out image placeholder, and a page boundary is unique per sketch.
      // `frame` means image placeholder in this dataset.
      frame: "image",
    },
    tentative: {
      // Verified against wf_0 / wf_11 / wf_12 (3 of 100). `container` is the main
      // content rectangle — the navbar and footer sit OUTSIDE it, so it is not the
      // page boundary; `section` is right. Re-check if more of the set is reviewed.
      container: "section",
      frame: "image",
    },
    attribution: "Roboflow Universe, CC BY 4.0",
  },
];

interface SourceStats {
  images: number;
  labelsWritten: number;
  perSourceClass: Map<string, number>;
  dropped: Map<string, number>;
  unmapped: Map<string, number>;
  invalid: number;
  tentativeSamples: Map<string, string[]>;
  splitCounts: Record<Split, number>;
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function ensureClassesFile(): void {
  if (fs.existsSync(CLASSES_FILE)) return;
  console.error(`\nMissing ${CLASSES_FILE}.`);
  console.error("Run `npm run export:dataset` first — it generates classes.txt from the");
  console.error("taxonomy and rewrites the manual labels to match.\n");
  process.exit(1);
}

/** classes.txt on disk is the target vocabulary; if it disagrees with the taxonomy the
 *  manual labels have not been re-exported yet and merging now would mix numbering. */
function verifyClassesFileCurrent(): void {
  const actual = fs.readFileSync(CLASSES_FILE, "utf-8");
  if (actual === CLASS_LIST.join("\n") + "\n") return;
  console.error("\nclasses.txt does not match ALL_CLASSES in taxonomy.ts.");
  console.error("Run `npm run export:dataset -- --clean` first so every label file uses");
  console.error("the current numbering, then re-run this import.\n");
  process.exit(1);
}

function download(source: SourceDataset): string {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const zipPath = path.join(SCRATCH, source.zipName);

  if (fs.existsSync(zipPath) && !REDOWNLOAD) {
    console.log(`  ${source.label}: using cached ${source.zipName}`);
  } else {
    console.log(`  ${source.label}: downloading…`);
    execFileSync("curl", ["-sSL", "-o", zipPath, source.url], { stdio: "inherit" });
  }

  const extractDir = path.join(SCRATCH, source.key);
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("unzip", ["-qo", zipPath, "-d", extractDir], { stdio: "inherit" });
  return extractDir;
}

/**
 * Read the source dataset's own class order from its data.yaml. Roboflow writes
 * `names: ['a', 'b', ...]` (flow list) or a block list; handle both rather than
 * assuming the order matches ours.
 */
function readSourceClasses(extractDir: string): string[] {
  const yamlPath = path.join(extractDir, "data.yaml");
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`no data.yaml in ${extractDir}`);
  }
  const text = fs.readFileSync(yamlPath, "utf-8");

  const flow = text.match(/^names:\s*\[(.*)\]\s*$/m);
  if (flow) {
    return flow[1]
      .split(",")
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
      .filter((s) => s.length > 0);
  }

  const blockStart = text.match(/^names:\s*$/m);
  if (blockStart) {
    const after = text.slice(blockStart.index! + blockStart[0].length);
    const names: string[] = [];
    for (const line of after.split("\n")) {
      const item = line.match(/^\s*-\s*(.+?)\s*$/);
      const keyed = line.match(/^\s*\d+:\s*(.+?)\s*$/);
      const m = item ?? keyed;
      if (m) names.push(m[1].replace(/^['"]|['"]$/g, ""));
      else if (line.trim() && !/^\s/.test(line)) break;
    }
    if (names.length > 0) return names;
  }

  throw new Error(`could not parse names: from ${yamlPath}`);
}

function findPairs(extractDir: string): Array<{ image: string; label: string; stem: string }> {
  const pairs: Array<{ image: string; label: string; stem: string }> = [];

  // Roboflow exports use train/valid/test, but we re-split with our own hash, so the
  // source's split assignment is intentionally ignored — just collect everything.
  for (const split of ["train", "valid", "test"]) {
    const imgDir = path.join(extractDir, split, "images");
    const lblDir = path.join(extractDir, split, "labels");
    if (!fs.existsSync(imgDir)) continue;

    for (const entry of fs.readdirSync(imgDir)) {
      if (entry.startsWith(".")) continue;
      const stem = path.parse(entry).name;
      const labelPath = path.join(lblDir, `${stem}.txt`);
      pairs.push({
        image: path.join(imgDir, entry),
        label: fs.existsSync(labelPath) ? labelPath : "",
        stem,
      });
    }
  }
  return pairs;
}

function processSource(source: SourceDataset): SourceStats {
  const stats: SourceStats = {
    images: 0,
    labelsWritten: 0,
    perSourceClass: new Map(),
    dropped: new Map(),
    unmapped: new Map(),
    invalid: 0,
    tentativeSamples: new Map(),
    splitCounts: { train: 0, val: 0, test: 0 },
  };

  const extractDir = download(source);
  const sourceClasses = readSourceClasses(extractDir);
  console.log(`  ${source.label}: ${sourceClasses.length} source classes from its data.yaml`);

  // Surface source classes the remap table never mentions — a silent gap would
  // otherwise drop real data without anyone noticing.
  for (const name of sourceClasses) {
    if (!(name in source.remap)) bump(stats.unmapped, name, 0);
  }

  const pairs = findPairs(extractDir);

  for (const pair of pairs) {
    const outName = `${source.prefix}${pair.stem}`;
    // Hash the prefixed name so the split is stable and derived the same way as the
    // manual exports (section 9.7), ignoring Roboflow's own split.
    const split = splitForAsset(outName);

    const lines: string[] = [];
    if (pair.label) {
      const raw = fs.readFileSync(pair.label, "utf-8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 5) {
          stats.invalid += 1;
          continue;
        }

        const sourceId = Number(parts[0]);
        const sourceName = sourceClasses[sourceId];
        if (sourceName === undefined) {
          stats.invalid += 1;
          continue;
        }

        bump(stats.perSourceClass, sourceName);

        if (!(sourceName in source.remap)) {
          bump(stats.unmapped, sourceName);
          continue;
        }

        const target = source.remap[sourceName];
        if (target === null) {
          bump(stats.dropped, sourceName);
          continue;
        }

        const targetId = CLASS_INDEX.get(target);
        if (targetId === undefined) {
          throw new Error(
            `remap target "${target}" for "${sourceName}" is not in the taxonomy`
          );
        }

        // Geometry is already YOLO center-x/y/w/h normalized in both source and
        // target, so only the class id changes.
        const geom = parts.slice(1, 5).map(Number);
        if (geom.some((v) => !Number.isFinite(v)) || geom[2] <= 0 || geom[3] <= 0) {
          stats.invalid += 1;
          continue;
        }
        const clamp = (v: number) => Math.min(Math.max(v, 0), 1);

        lines.push(`${targetId} ${geom.map((v) => clamp(v).toFixed(6)).join(" ")}`);
        stats.labelsWritten += 1;

        if (sourceName in source.tentative) {
          const samples = stats.tentativeSamples.get(sourceName) ?? [];
          const imageName = `${outName}${path.parse(pair.image).ext}`;
          if (samples.length < 5 && !samples.includes(imageName)) {
            samples.push(imageName);
            stats.tentativeSamples.set(sourceName, samples);
          }
        }
      }
    }

    if (!DRY_RUN) {
      const ext = path.parse(pair.image).ext;
      fs.copyFileSync(pair.image, path.join(imagesDir(split), `${outName}${ext}`));
      fs.writeFileSync(
        path.join(labelsDir(split), `${outName}.txt`),
        lines.length > 0 ? lines.join("\n") + "\n" : ""
      );
    }

    stats.images += 1;
    stats.splitCounts[split] += 1;
  }

  return stats;
}

function main(): void {
  console.log(DRY_RUN ? "External dataset import (dry run)\n" : "External dataset import\n");

  ensureClassesFile();
  verifyClassesFileCurrent();

  if (!DRY_RUN) {
    for (const split of SPLITS) {
      fs.mkdirSync(imagesDir(split), { recursive: true });
      fs.mkdirSync(labelsDir(split), { recursive: true });
    }
  }

  const results: Array<{ source: SourceDataset; stats: SourceStats }> = [];
  for (const source of SOURCES) {
    console.log(`\n${source.label}`);
    results.push({ source, stats: processSource(source) });
  }

  report(results);
}

function report(results: Array<{ source: SourceDataset; stats: SourceStats }>): void {
  console.log("\n─── Per-source import ───");

  for (const { source, stats } of results) {
    console.log(`\n${source.label}  (prefix ${source.prefix})`);
    console.log(`  images added : ${stats.images}`);
    console.log(`  labels written: ${stats.labelsWritten}`);
    console.log(
      `  split        : train ${stats.splitCounts.train}  val ${stats.splitCounts.val}  test ${stats.splitCounts.test}`
    );

    if (stats.dropped.size > 0) {
      const total = [...stats.dropped.values()].reduce((a, b) => a + b, 0);
      console.log(`  dropped      : ${total} instance(s) under source class:`);
      for (const [name, count] of [...stats.dropped].sort((a, b) => b[1] - a[1])) {
        console.log(`      ${name.padEnd(16)} ${count}`);
      }
    }

    const realUnmapped = [...stats.unmapped].filter(([, c]) => c > 0);
    const unusedInRemap = [...stats.unmapped].filter(([, c]) => c === 0);
    if (realUnmapped.length > 0) {
      console.log("  ⚠ UNMAPPED source classes (instances lost, not in remap table):");
      for (const [name, count] of realUnmapped) console.log(`      ${name.padEnd(16)} ${count}`);
    }
    if (unusedInRemap.length > 0) {
      console.log(
        `  note: source classes with no instances: ${unusedInRemap.map(([n]) => n).join(", ")}`
      );
    }
    if (stats.invalid > 0) {
      console.log(`  ⚠ ${stats.invalid} malformed label line(s) skipped`);
    }
  }

  // Tentative mappings get their own loud block — these are the judgement calls.
  const tentativeBlocks = results.filter(({ source }) => Object.keys(source.tentative).length > 0);
  if (tentativeBlocks.length > 0) {
    console.log("\n\n╔══════════════════════════════════════════════════════════════╗");
    console.log("║  JUDGEMENT-CALL MAPPINGS — RE-VERIFY IF YOU EXTEND THE SET   ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("\n  Spot-checked against wf_0 / wf_11 / wf_12 (3 of 100 images).");
    console.log("  This check already corrected `frame`: it was mapped to `page`, but");
    console.log("  wf_12 has two `frame` boxes on two image placeholders, and a page");
    console.log("  boundary is unique per sketch. It now maps to `image`.");
    for (const { source, stats } of tentativeBlocks) {
      for (const [sourceName, target] of Object.entries(source.tentative)) {
        const count = stats.perSourceClass.get(sourceName) ?? 0;
        console.log(`\n  ${source.label}:  "${sourceName}" -> ${target}   (${count} instances)`);
        const samples = stats.tentativeSamples.get(sourceName) ?? [];
        if (samples.length > 0) {
          console.log("    spot-check these images:");
          for (const s of samples) console.log(`      ml/dataset/images/*/${s}`);
        }
      }
    }
    console.log("\n  Open each against the annotation guide's definition of the target");
    console.log("  class. If the mapping is wrong, fix the remap table in");
    console.log("  scripts/src/import-external-datasets.ts and re-run.\n");
  }

  const merged = tallyDatasetOnDisk();
  const totalImages = SPLITS.reduce((s, k) => s + merged.images[k], 0);

  console.log("\n─── Merged dataset (manual + external) ───\n");
  console.log(`Images: ${totalImages}`);
  for (const split of SPLITS) {
    const n = merged.images[split];
    const pct = totalImages > 0 ? ((n / totalImages) * 100).toFixed(0) : "0";
    console.log(`  ${split.padEnd(6)} ${String(n).padStart(4)}  (${pct}%)`);
  }

  const emptySplits = SPLITS.filter((s) => merged.images[s] === 0);
  if (emptySplits.length > 0) {
    console.log(`\n⚠ Empty split(s): ${emptySplits.join(", ")} — training needs a non-empty val set.`);
  }

  const totalLabels = [...merged.perClass.values()].reduce((a, b) => a + b, 0);
  console.log(`\nLabels: ${totalLabels}`);

  console.log("\n─── Per-class label counts (merged) ───\n");
  const counted = CLASS_LIST.map((name, id) => ({ id, name, count: merged.perClass.get(name) ?? 0 }));
  const present = counted.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
  const absent = counted.filter((c) => c.count === 0);

  for (const { id, name, count } of present) {
    const flag = count === 1 ? "  ⚠ only 1 example" : count < 5 ? "  ⚠ very few" : "";
    console.log(`  ${String(id).padStart(2)}  ${name.padEnd(20)} ${String(count).padStart(5)}${flag}`);
  }

  if (absent.length > 0) {
    console.log(`\n  ${absent.length} class(es) still with NO examples:`);
    console.log(`    ${absent.map((c) => c.name).join(", ")}`);
  }

  if (DRY_RUN) console.log("\n(dry run — nothing written)");
  console.log("");
}

main();
