/**
 * Derive the v1 training subset from the full 41-class dataset.
 *
 * Plan references: section 9.3 (fewer classes help when data is thin),
 * section 9.7 (split policy), section 9.8 step 1 (prepare dataset), section 51 step 8.
 *
 * ml/dataset stays the full-taxonomy source of truth. This writes a SEPARATE derived
 * view under ml/dataset/v1/ containing only the eligible classes, with its own
 * contiguous class numbering (YOLO requires ids 0..nc-1 with no gaps).
 *
 * Nothing here mutates ml/dataset/{classes.txt,data.yaml,images,labels} or taxonomy.ts.
 *
 * Usage:
 *   npm run build:v1
 *   npm run build:v1 -- --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import {
  CLASSES_FILE,
  CLASS_LIST,
  DATASET_DIR,
  SPLITS,
  imagesDir,
  labelsDir,
  type Split,
} from "./dataset-layout.js";

const DRY_RUN = new Set(process.argv.slice(2)).has("--dry-run");

const V1_DIR = path.join(DATASET_DIR, "v1");
const V1_CLASSES_FILE = path.join(DATASET_DIR, "v1-classes.txt");
const V1_SCOPE_DOC = path.join(DATASET_DIR, "v1-training-scope.md");

interface ClassStats {
  name: string;
  fullId: number;
  train: number;
  val: number;
  test: number;
  total: number;
}

/**
 * Eligibility rule for v1 — see ml/dataset/v1-training-scope.md for the reasoning.
 *
 * A class is eligible iff it has at least one instance in BOTH val and test, so its
 * AP is actually computable on held-out data. A raw total-instance floor is the wrong
 * test: `card` has 20 instances but all 20 sit in train, so it would pass a
 * "20 instances" bar while remaining impossible to evaluate.
 */
function isEligible(s: ClassStats): boolean {
  return s.val >= 1 && s.test >= 1;
}

function collectStats(): ClassStats[] {
  const stats = new Map<string, ClassStats>();
  CLASS_LIST.forEach((name, fullId) => {
    stats.set(name, { name, fullId, train: 0, val: 0, test: 0, total: 0 });
  });

  for (const split of SPLITS) {
    const dir = labelsDir(split);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith(".txt")) continue;
      for (const line of fs.readFileSync(path.join(dir, entry), "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const name = CLASS_LIST[Number(trimmed.split(/\s+/)[0])];
        if (!name) continue;
        const s = stats.get(name)!;
        s[split] += 1;
        s.total += 1;
      }
    }
  }
  return [...stats.values()];
}

function main(): void {
  console.log(DRY_RUN ? "Building v1 training subset (dry run)\n" : "Building v1 training subset\n");

  if (!fs.existsSync(CLASSES_FILE)) {
    console.error(`Missing ${CLASSES_FILE}. Run \`npm run export:dataset\` first.`);
    process.exit(1);
  }
  const onDisk = fs.readFileSync(CLASSES_FILE, "utf-8");
  if (onDisk !== CLASS_LIST.join("\n") + "\n") {
    console.error("classes.txt does not match taxonomy.ts — run `npm run export:dataset` first.");
    process.exit(1);
  }

  const stats = collectStats();
  const eligible = stats.filter(isEligible).sort((a, b) => a.fullId - b.fullId);
  const excluded = stats.filter((s) => !isEligible(s)).sort((a, b) => b.total - a.total);

  if (eligible.length === 0) {
    console.error("No class meets the v1 eligibility rule — nothing to train on.");
    process.exit(1);
  }

  // v1 ids are contiguous 0..n-1 in full-taxonomy order. This numbering is INDEPENDENT
  // of the 41-class ids and is frozen by v1-classes.txt for this model version.
  const v1Index = new Map(eligible.map((s, i) => [s.name, i]));
  const fullIdToV1 = new Map(eligible.map((s, i) => [s.fullId, i]));

  console.log(`Eligible: ${eligible.length} / ${CLASS_LIST.length} classes`);
  console.log(`  minimum total among eligible : ${Math.min(...eligible.map((s) => s.total))}`);
  console.log(`  maximum total among excluded : ${Math.max(...excluded.map((s) => s.total))}\n`);

  // Filter labels; drop images left with no boxes.
  const kept: Record<Split, number> = { train: 0, val: 0, test: 0 };
  const droppedImages: Record<Split, number> = { train: 0, val: 0, test: 0 };
  const keptLabels: Record<Split, number> = { train: 0, val: 0, test: 0 };
  let droppedLabelLines = 0;

  if (!DRY_RUN) {
    fs.rmSync(V1_DIR, { recursive: true, force: true });
    for (const split of SPLITS) {
      fs.mkdirSync(path.join(V1_DIR, "images", split), { recursive: true });
      fs.mkdirSync(path.join(V1_DIR, "labels", split), { recursive: true });
    }
  }

  for (const split of SPLITS) {
    const lblDir = labelsDir(split);
    const imgDir = imagesDir(split);
    if (!fs.existsSync(lblDir)) continue;

    const imagesByStem = new Map<string, string>();
    if (fs.existsSync(imgDir)) {
      for (const entry of fs.readdirSync(imgDir)) {
        if (entry === ".gitkeep") continue;
        imagesByStem.set(path.parse(entry).name, entry);
      }
    }

    for (const entry of fs.readdirSync(lblDir)) {
      if (!entry.endsWith(".txt")) continue;
      const stem = path.parse(entry).name;

      const lines: string[] = [];
      for (const line of fs.readFileSync(path.join(lblDir, entry), "utf-8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const v1Id = fullIdToV1.get(Number(parts[0]));
        if (v1Id === undefined) {
          droppedLabelLines += 1;
          continue;
        }
        lines.push([v1Id, ...parts.slice(1, 5)].join(" "));
      }

      // An image with no surviving boxes is dropped, not written as an empty label.
      // Empty label files are background/negative supervision (section 9.5) and are a
      // deliberate future step — silently creating them here would train the model that
      // real UI components are background.
      if (lines.length === 0) {
        droppedImages[split] += 1;
        continue;
      }

      const imageFile = imagesByStem.get(stem);
      if (!imageFile) {
        droppedImages[split] += 1;
        continue;
      }

      if (!DRY_RUN) {
        fs.copyFileSync(
          path.join(imgDir, imageFile),
          path.join(V1_DIR, "images", split, imageFile)
        );
        fs.writeFileSync(
          path.join(V1_DIR, "labels", split, entry),
          lines.join("\n") + "\n"
        );
      }
      kept[split] += 1;
      keptLabels[split] += lines.length;
    }
  }

  const v1ClassesContent = eligible.map((s) => s.name).join("\n") + "\n";
  const dataYaml = `# Sketch2UI v1 TRAINING SUBSET — generated by scripts/src/build-v1-subset.ts
# DERIVED VIEW. The full ${CLASS_LIST.length}-class dataset in ../ is the source of truth.
# These ids are v1-subset ids and do NOT match ml/dataset/classes.txt.

path: ${V1_DIR}
train: images/train
val: images/val
test: images/test

nc: ${eligible.length}
names:
${eligible.map((s, i) => `  ${i}: ${s.name}`).join("\n")}
`;

  if (!DRY_RUN) {
    fs.writeFileSync(V1_CLASSES_FILE, v1ClassesContent);
    fs.writeFileSync(path.join(V1_DIR, "data.yaml"), dataYaml);
    fs.writeFileSync(V1_SCOPE_DOC, renderScopeDoc(eligible, excluded, kept, droppedImages));
  }

  console.log("Images kept (v1 subset):");
  for (const split of SPLITS) {
    console.log(
      `  ${split.padEnd(6)} ${String(kept[split]).padStart(4)} kept, ${droppedImages[split]} dropped (no eligible boxes)`
    );
  }
  const totalKept = SPLITS.reduce((a, s) => a + kept[s], 0);
  const totalLabels = SPLITS.reduce((a, s) => a + keptLabels[s], 0);
  console.log(`\nTotal: ${totalKept} images, ${totalLabels} labels`);
  console.log(`Dropped ${droppedLabelLines} label line(s) from excluded classes.`);

  console.log(`\nExcluded ${excluded.length} class(es) (insufficient data, NOT a taxonomy change):`);
  for (const s of excluded) {
    console.log(`  ${s.name.padEnd(20)} total ${String(s.total).padStart(3)}  (train ${s.train}, val ${s.val}, test ${s.test})`);
  }

  if (!DRY_RUN) {
    console.log(`\nWrote:`);
    console.log(`  ${path.relative(process.cwd(), V1_CLASSES_FILE)}`);
    console.log(`  ${path.relative(process.cwd(), V1_SCOPE_DOC)}`);
    console.log(`  ${path.relative(process.cwd(), path.join(V1_DIR, "data.yaml"))}`);
  } else {
    console.log("\n(dry run — nothing written)");
  }
  console.log("");
}

function renderScopeDoc(
  eligible: ClassStats[],
  excluded: ClassStats[],
  kept: Record<Split, number>,
  dropped: Record<Split, number>
): string {
  const totalKept = SPLITS.reduce((a, s) => a + kept[s], 0);
  const minEligible = Math.min(...eligible.map((s) => s.total));
  const maxExcluded = Math.max(...excluded.map((s) => s.total));

  return `# v1 training scope

Generated by \`scripts/src/build-v1-subset.ts\` — do not hand-edit.

Plan references: §9.3 (fewer classes help when data is thin), §9.7 (split policy),
§9.8 (training process), §51 step 8.

## What this is

The full taxonomy has **${CLASS_LIST.length} classes** (\`ml/dataset/classes.txt\`,
generated from \`packages/shared-types/src/taxonomy.ts\`). The v1 detector trains on a
**${eligible.length}-class subset** of it.

This is a **temporary data limitation, not a taxonomy change.** The excluded classes are
still first-class members of the taxonomy, still labelled by annotators per
\`docs/ml/annotation-guide.md\`, and still present in \`ml/dataset\`. They are held out of
*this training run only* because there is not yet enough of them to learn or to measure.
§9.3 is explicit that the class vocabulary should be expanded only once the first
detector is stable — this is that staging, applied in reverse.

\`ml/dataset\` remains the full ${CLASS_LIST.length}-class source of truth. The subset
lives in \`ml/dataset/v1/\` as a derived view and is regenerated, never hand-maintained.

⚠ **v1 class ids are NOT full-taxonomy class ids.** YOLO requires contiguous ids
\`0..nc-1\`, so the subset is renumbered. \`ml/dataset/v1-classes.txt\` is the frozen
mapping for this model version; anything consuming the model's output must translate
back through it. Never mix the two numbering schemes.

## Eligibility rule

> A class is eligible for v1 iff it has **at least one instance in both the val and the
> test split**.

The reasoning, from the actual distribution on disk:

A raw total-instance floor is the wrong test. The obvious candidate — "at least 20
instances" — would admit \`card\` (${excluded.find((s) => s.name === "card")?.total ?? "?"} instances), but every one of those sits in
\`train\`: it has 0 in val and 0 in test. Such a class cannot be evaluated at all. Its AP
is undefined, and including it either silently distorts mAP or forces the metric to skip
it — the exact "looks trained but isn't measurable" failure that makes a first detector
untrustworthy.

Requiring presence in val *and* test tests the thing that actually matters: can this
class be scored on held-out data?

The distribution makes this robust rather than a judgement call. There is a clean gap
with **nothing in between**:

- smallest **eligible** class: **${minEligible}** instances
- largest **excluded** class: **${maxExcluded}** instances
- every excluded class has **exactly 0** in val and 0 in test

So no borderline class sits near the boundary, and the rule is not tuned to include or
exclude any particular class. Any total-count threshold between ${maxExcluded + 1} and
${minEligible} produces the identical ${eligible.length}-class result.

The underlying cause of the gap: every low-count class comes exclusively from the five
hand-annotated sketches, and all five hashed into \`train\` (see \`ml/dataset/README.md\`
on the deterministic split). The external datasets supplied the high-count classes
across all three splits.

## Included (${eligible.length} classes)

| v1 id | full id | class | total | train | val | test |
|---:|---:|---|---:|---:|---:|---:|
${eligible
  .map((s, i) => `| ${i} | ${s.fullId} | \`${s.name}\` | ${s.total} | ${s.train} | ${s.val} | ${s.test} |`)
  .join("\n")}

## Excluded (${excluded.length} classes)

Excluded for **insufficient data**, not because they are unimportant. Several are
central to the product — \`page\` drives §10's page-boundary filtering, and \`card\` /
\`card_title\` / \`card_button\` drive the card-grid layout inference in
\`packages/codegen/src/layout.ts\`.

| class | total | train | val | test |
|---|---:|---:|---:|---:|
${excluded
  .map((s) => `| \`${s.name}\` | ${s.total} | ${s.train} | ${s.val} | ${s.test} |`)
  .join("\n")}

## Images

Filtering drops label lines for excluded classes. An image left with **zero** remaining
boxes is dropped from the subset entirely rather than written as an empty label file:
an empty label is background/negative supervision (§9.5), which is a deliberate future
step. Emitting one here would teach the model that real, visible UI components are
background.

| split | kept | dropped |
|---|---:|---:|
${SPLITS.map((s) => `| ${s} | ${kept[s]} | ${dropped[s]} |`).join("\n")}

Total: **${totalKept} images**.

## Getting the excluded classes back

Collect and annotate more sketches containing them, re-run
\`npm run export:dataset && npm run import:external\`, then re-run
\`npm run build:v1\`. Classes cross the eligibility line automatically as soon as the
split puts them in val and test. A class needs roughly ${minEligible}+ instances before
the ~78/12/11 split reliably does that.
`;
}

main();
