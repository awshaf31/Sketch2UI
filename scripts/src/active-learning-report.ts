/**
 * Active-learning priority report — plan section 36.
 *
 * §36 says annotation effort should go to difficult cases rather than randomly labelling
 * more easy samples, and lists what to prioritise:
 *   - low-confidence detections
 *   - frequently corrected classes
 *   - images with many false positives
 *   - images with no detections
 *   - unusual drawing styles      <- NOT scored; see the note at the bottom
 *
 * Usage:
 *   npm run model:active-learning
 *   npm run model:active-learning -- --json
 */

import fs from "node:fs";
import type { Detection, ProjectAsset, TrainingSample } from "@sketch2ui/shared-types";
import { STORE_FILE } from "./dataset-layout.js";

const JSON_OUT = new Set(process.argv.slice(2)).has("--json");

interface Store {
  projects: { id: string; name: string }[];
  assets: ProjectAsset[];
  detections: Detection[];
  trainingSamples: TrainingSample[];
}

/** Low-confidence band: above the worker's 0.5 accept threshold but still shaky. */
const LOW_CONFIDENCE_MAX = 0.75;

/**
 * Classes the frozen model is known-weak on, from its own held-out evaluation
 * (ml/models/ui-detector/v1.0.0/metrics.json — test AP@0.5 0.36-0.54).
 *
 * These are NOT inferred from correction rate: with a handful of corrections in the
 * store, that signal is far too noisy to identify them, and it would rank a class as
 * fine simply because nobody has gotten around to correcting it yet. The evaluation is
 * the authority. Update this list when a new model version is frozen.
 */
const KNOWN_WEAK_CLASSES = new Set(["select", "radio_button", "carousel"]);

interface AssetScore {
  assetId: string;
  projectName: string;
  storageKey: string;
  total: number;
  lowConfidence: number;
  corrected: number;
  rejected: number;
  approved: boolean;
  score: number;
  reasons: string[];
  weakClasses: string[];
  weakClassCounts: Record<string, number>;
}

function readStore(): Store {
  if (!fs.existsSync(STORE_FILE)) {
    console.error(`No store at ${STORE_FILE}.`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8"));
  return {
    projects: raw.projects ?? [],
    assets: raw.assets ?? [],
    detections: raw.detections ?? [],
    trainingSamples: raw.trainingSamples ?? [],
  };
}

function main(): void {
  const store = readStore();
  const projectName = new Map(store.projects.map((p) => [p.id, p.name]));
  const approvedAssets = new Set(
    store.trainingSamples.filter((s) => s.approved).map((s) => s.imageAssetId)
  );

  // --- Corpus-level signal: which classes get corrected most (section 36) ---------
  // A model-proposed box that a human edited flips to source "manual" while keeping
  // modelVersionId (see detections.routes.ts). That combination IS the correction
  // record, so class-level correction counts are directly recoverable.
  const correctedByClass = new Map<string, number>();
  const proposedByClass = new Map<string, number>();
  for (const d of store.detections) {
    if (!d.modelVersionId) continue;
    // Attribute to what the MODEL proposed. originalClassName is set when a class was
    // corrected; otherwise the current className is still the model's own answer.
    const proposedClass = d.originalClassName ?? d.className;
    proposedByClass.set(proposedClass, (proposedByClass.get(proposedClass) ?? 0) + 1);
    if (d.source === "manual") {
      correctedByClass.set(proposedClass, (correctedByClass.get(proposedClass) ?? 0) + 1);
    }
  }

  const correctionRate = [...proposedByClass.entries()]
    .map(([className, proposed]) => ({
      className,
      proposed,
      corrected: correctedByClass.get(className) ?? 0,
      rate: (correctedByClass.get(className) ?? 0) / proposed,
    }))
    .sort((a, b) => b.rate - a.rate || b.corrected - a.corrected);

  const highCorrectionClasses = new Set(
    correctionRate.filter((c) => c.rate >= 0.5 && c.proposed >= 2).map((c) => c.className)
  );

  // --- Per-asset scoring ----------------------------------------------------------
  const scores: AssetScore[] = [];

  for (const asset of store.assets) {
    const mine = store.detections.filter((d) => d.sourceAssetId === asset.id);
    const active = mine.filter((d) => d.status === "active");
    const rejected = mine.filter((d) => d.status === "rejected");

    const lowConfidence = active.filter(
      (d) => d.source === "model" && d.confidence < LOW_CONFIDENCE_MAX
    );
    const corrected = mine.filter((d) => d.modelVersionId && d.source === "manual");

    // Two independent signals of "this asset is worth annotating for a weak class":
    // the corpus-measured correction rate, and the model's own evaluated weak classes.
    const weak = [...new Set(active.map((d) => d.className))].filter(
      (c) => highCorrectionClasses.has(c) || KNOWN_WEAK_CLASSES.has(c)
    );
    const weakInstances = active.filter((d) => KNOWN_WEAK_CLASSES.has(d.className));
    const weakLowConfidence = weakInstances.filter(
      (d) => d.source === "model" && d.confidence < LOW_CONFIDENCE_MAX
    );

    let score = 0;
    const reasons: string[] = [];

    // Images with NO detections are the strongest signal: the model saw nothing at all,
    // so a human has to start from scratch and the result is maximally informative.
    if (active.length === 0) {
      score += 100;
      reasons.push("no detections at all");
    }

    if (lowConfidence.length > 0) {
      score += lowConfidence.length * 4;
      reasons.push(`${lowConfidence.length} low-confidence (<${LOW_CONFIDENCE_MAX})`);
    }

    if (corrected.length > 0) {
      score += corrected.length * 6;
      reasons.push(`${corrected.length} already corrected by hand`);
    }

    // Boundary-rejected boxes are the closest proxy this system has for a false
    // positive: the model fired on something outside the drawn page.
    if (rejected.length > 0) {
      score += rejected.length * 5;
      reasons.push(`${rejected.length} rejected outside page`);
    }

    if (weak.length > 0) {
      score += weak.length * 8;
      reasons.push(`contains weak/often-corrected class(es): ${weak.join(", ")}`);
    }

    // A low-confidence instance of a known-weak class is the single most valuable thing
    // to annotate: it targets the model's measured failure mode directly.
    if (weakLowConfidence.length > 0) {
      score += weakLowConfidence.length * 10;
      reasons.push(
        `${weakLowConfidence.length} low-confidence instance(s) of known-weak classes`
      );
    }

    // Already-approved images are settled; deprioritise without hiding them.
    if (approvedAssets.has(asset.id)) {
      score = Math.round(score * 0.25);
      reasons.push("already approved for training");
    }

    scores.push({
      assetId: asset.id,
      projectName: projectName.get(asset.projectId) ?? "(unknown)",
      storageKey: asset.storageKey,
      total: active.length,
      lowConfidence: lowConfidence.length,
      corrected: corrected.length,
      rejected: rejected.length,
      approved: approvedAssets.has(asset.id),
      score,
      reasons,
      weakClasses: weak,
      weakClassCounts: Object.fromEntries(
        [...KNOWN_WEAK_CLASSES].map((c) => [c, weakInstances.filter((d) => d.className === c).length])
      ),
    });
  }

  scores.sort((a, b) => b.score - a.score);

  if (JSON_OUT) {
    console.log(JSON.stringify({ correctionRate, assets: scores }, null, 2));
    return;
  }

  console.log("Active-learning priorities — plan section 36\n");
  console.log("Which sketches most need human annotation attention next.\n");

  console.log("─── Classes by correction rate ───\n");
  if (correctionRate.length === 0) {
    console.log("  (no model-proposed detections yet)\n");
  } else {
    console.log(`  ${"class".padEnd(16)} ${"proposed".padStart(8)} ${"corrected".padStart(9)} ${"rate".padStart(6)}`);
    for (const c of correctionRate.slice(0, 12)) {
      const flag = highCorrectionClasses.has(c.className) ? "  <- prioritised" : "";
      console.log(
        `  ${c.className.padEnd(16)} ${String(c.proposed).padStart(8)} ${String(c.corrected).padStart(9)} ${(c.rate * 100).toFixed(0).padStart(5)}%${flag}`
      );
    }
    console.log("");
  }

  // Dedicated section: the assets a human should annotate NEXT if the goal is fixing
  // the model's known-weak classes, rather than general coverage.
  console.log("─── Assets containing known-weak classes ───\n");
  console.log(`  Known weak (from v1.0.0 evaluation): ${[...KNOWN_WEAK_CLASSES].join(", ")}\n`);
  const weakAssets = scores.filter((s) =>
    Object.values(s.weakClassCounts).some((n) => n > 0)
  );
  if (weakAssets.length === 0) {
    console.log("  NONE. No asset in the store contains any of these classes —");
    console.log("  new sketches drawn to include them are the only way forward.\n");
  } else {
    for (const s of weakAssets) {
      const parts = Object.entries(s.weakClassCounts)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `${c}=${n}`)
        .join("  ");
      console.log(`  [${String(s.score).padStart(4)}] ${s.projectName.padEnd(20)} asset ${s.assetId}`);
      console.log(`         ${parts}`);
      console.log(`         image: data/uploads/${s.storageKey}`);
      if (s.approved) console.log("         (already approved for training)");
    }
    console.log("");
  }

  console.log("─── Assets by priority ───\n");
  for (const s of scores.slice(0, 15)) {
    console.log(
      `  [${String(s.score).padStart(4)}] ${s.projectName.padEnd(20)} ${s.storageKey.slice(0, 12)}…  (${s.total} active)`
    );
    for (const r of s.reasons) console.log(`         · ${r}`);
  }

  const zero = scores.filter((s) => s.total === 0).length;
  console.log(`\n${scores.length} asset(s) scored; ${zero} with no detections.`);
  console.log(
    "\nNot scored: section 36's \"unusual drawing styles\". That needs a style/embedding"
  );
  console.log(
    "similarity measure over the corpus, which does not exist yet — omitted rather than"
  );
  console.log("approximated with a proxy that would not mean what the name implies.\n");
}

main();
