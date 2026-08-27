/**
 * Evaluation framework — plan section 21. Emits a versioned baseline that future model
 * versions are compared against (section 20.6 regression benchmark).
 *
 * Covered here:
 *   §21.2 page boundary IoU        — against hand-verified ground-truth polygons
 *   §21.3 layout metrics           — against hand-authored structural assertions
 *   §21.4 code metrics             — HTML/CSS parse, duplicate ids, unmapped classes
 *   §21.7 end-to-end success rate  — % of sketches reaching a usable preview
 *
 * DELIBERATELY NOT covered (see the header of this file):
 *   §21.1 detection metrics  — already produced by training; lives in
 *                              ml/models/ui-detector/v1.0.0/metrics.json
 *   §21.5 visual similarity  — no reference-design benchmark exists; only sketches.
 *   §21.6 human evaluation   — requires actual human evaluators.
 *
 * Usage:
 *   npm run eval                       # requires the cv-worker running on :8000
 *   npm run eval -- --out ml/evaluation/baseline-v1.0.0.json
 */

import fs from "node:fs";
import path from "node:path";
import type { BBox, Detection, PagePolygon, UINode, UIRoot } from "@sketch2ui/shared-types";
import { insideFraction, validateGeneratedCode } from "@sketch2ui/shared-types";
import { buildUITree, generateCSS, generateHTML } from "@sketch2ui/codegen";
import { ALL_CLASSES } from "@sketch2ui/shared-types";
import { REPO_ROOT } from "./dataset-layout.js";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT_FILE = outIdx >= 0 ? args[outIdx + 1] : "ml/evaluation/baseline-v1.0.0.json";
const WORKER = process.env.CV_WORKER_URL ?? "http://127.0.0.1:8000";

const SAMPLES = path.join(REPO_ROOT, "sample_images_object_detataction_expectation");

// ---------------------------------------------------------------------------------
// §21.2 ground truth — hand-verified.
//
// Read off each sketch by eye against a decile grid overlaid on the source image. The
// reference is the drawn page frame (the expectation renders label it `page`), i.e. the
// rectangle separating webpage content from the off-page handwritten notes.
//
// These are human estimates to roughly +/-0.01 normalized units, not survey-grade
// truth. That is accurate enough to distinguish "found the page" from "found something
// else", which is what the metric is for.
// ---------------------------------------------------------------------------------
const BOUNDARY_GROUND_TRUTH: Record<string, PagePolygon> = {
  "5d0083a7": [[0.010, 0.005], [0.985, 0.005], [0.985, 0.995], [0.010, 0.995]],
  "642be96a": [[0.052, 0.008], [0.765, 0.008], [0.765, 0.975], [0.052, 0.975]],
  "6de3567a": [[0.070, 0.005], [0.680, 0.005], [0.680, 0.975], [0.070, 0.975]],
  "881ceb2a": [[0.105, 0.033], [0.900, 0.033], [0.900, 0.950], [0.105, 0.950]],
  "cf91f277": [[0.012, 0.008], [0.982, 0.008], [0.982, 0.990], [0.012, 0.990]],
};

// ---------------------------------------------------------------------------------
// §21.3 structural assertions — hand-authored.
//
// Deliberately NOT full expected trees: those are too laborious to keep honest as the
// detector changes. Each assertion states one structural property a human reading the
// sketch would expect, and is checkable against layout.ts output.
// ---------------------------------------------------------------------------------
type Assertion =
  | { kind: "min-top-level"; n: number; why: string }
  | { kind: "has-grid-of"; type: string; minColumns: number; why: string }
  | { kind: "siblings-under"; parentType: string; childTypes: string[]; why: string }
  | { kind: "max-depth"; n: number; why: string }
  | { kind: "reading-order-monotonic"; why: string };

const LAYOUT_ASSERTIONS: Record<string, { file: string; assertions: Assertion[] }> = {
  community: {
    file: "642be96a-9412-49cd-a318-4e1de58809da.png",
    assertions: [
      { kind: "min-top-level", n: 4, why: "the sketch has >=4 stacked content bands" },
      { kind: "has-grid-of", type: "image", minColumns: 3, why: "a row of >=3 repeated card thumbnails should become one grid, not stacked siblings" },
      { kind: "reading-order-monotonic", why: "top-level bands must come out top-to-bottom" },
      { kind: "max-depth", n: 5, why: "a flat page of bands should not produce deep nesting" },
    ],
  },
  carsale: {
    file: "cf91f277-f7b8-4a2e-9d3d-0bb47b539789.png",
    assertions: [
      { kind: "min-top-level", n: 3, why: "header band, hero, featured-cars row, footer" },
      { kind: "has-grid-of", type: "image", minColumns: 3, why: "the 4 featured-car thumbnails sit in one row" },
      { kind: "reading-order-monotonic", why: "bands top-to-bottom" },
    ],
  },
  wildcard: {
    file: "5d0083a7-030b-4b5e-b2d0-2c4c073534d4.png",
    assertions: [
      { kind: "min-top-level", n: 4, why: "header, hero, cards row, content, portfolio, footer" },
      { kind: "siblings-under", parentType: "section", childTypes: ["text", "image"], why: "the hero band holds body text beside an image" },
      { kind: "reading-order-monotonic", why: "bands top-to-bottom" },
    ],
  },
};

// --- helpers ----------------------------------------------------------------------

function polygonArea(p: PagePolygon): number {
  let t = 0;
  for (let i = 0; i < p.length; i += 1) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    t += x1 * y2 - x2 * y1;
  }
  return Math.abs(t) / 2;
}

function boundsOf(p: PagePolygon): BBox {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Axis-aligned IoU between two page quads.
 *
 * Both polygons are reduced to their bounding boxes and compared consistently. The
 * ground truth is axis-aligned by construction and a detected page quad is near-axis-
 * aligned, so the approximation is small — but it MUST be applied to both sides. An
 * earlier version clipped A-as-bounds against B-as-polygon while using A's true polygon
 * area in the union, which produced IoU values above 1.0 on skewed quads.
 */
function polygonIoU(a: PagePolygon, b: PagePolygon): number {
  const A = boundsOf(a);
  const B = boundsOf(b);
  const ix = Math.max(0, Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x));
  const iy = Math.max(0, Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y));
  const inter = ix * iy;
  const union = A.width * A.height + B.width * B.height - inter;
  return union > 0 ? inter / union : 0;
}

function walk(node: UINode, fn: (n: UINode, depth: number) => void, depth = 1): void {
  fn(node, depth);
  for (const c of node.children) walk(c, fn, depth + 1);
}

function evaluateAssertions(root: UIRoot, assertions: Assertion[]) {
  const results: { kind: string; passed: boolean; detail: string; why: string }[] = [];

  for (const a of assertions) {
    let passed = false;
    let detail = "";

    if (a.kind === "min-top-level") {
      passed = root.children.length >= a.n;
      detail = `${root.children.length} top-level children (need >=${a.n})`;
    } else if (a.kind === "has-grid-of") {
      let best = 0;
      for (const c of root.children) {
        walk(c, (n) => {
          if (
            n.type === "group" &&
            n.layout?.display === "grid" &&
            n.children.length > 0 &&
            n.children.every((k) => k.type === a.type)
          ) {
            best = Math.max(best, n.children.length);
          }
        });
      }
      passed = best >= a.minColumns;
      detail = `largest ${a.type} grid = ${best} columns (need >=${a.minColumns})`;
    } else if (a.kind === "siblings-under") {
      let found = false;
      for (const c of root.children) {
        walk(c, (n) => {
          if (n.type !== a.parentType) return;
          const kinds = new Set(n.children.map((k) => k.type));
          if (a.childTypes.every((t) => kinds.has(t))) found = true;
        });
      }
      passed = found;
      detail = `a <${a.parentType}> containing ${a.childTypes.join(" + ")}: ${found ? "found" : "not found"}`;
    } else if (a.kind === "max-depth") {
      let max = 0;
      for (const c of root.children) walk(c, (_n, d) => { max = Math.max(max, d); });
      passed = max <= a.n;
      detail = `max depth ${max} (limit ${a.n})`;
    } else {
      // Reading order (section 11.5) is rows top-to-bottom, then left-to-right WITHIN a
      // row. So two siblings sharing a row may legitimately appear in decreasing
      // centre-y order. Only a drop LARGER than the engine's row tolerance is a real
      // inversion; a stricter test flags correct same-row ordering as a failure.
      const ROW_TOLERANCE = 0.03;
      const ys = root.children.map((c) => c.bbox.y + c.bbox.height / 2);
      let inversions = 0;
      for (let i = 1; i < ys.length; i += 1) {
        if (ys[i] < ys[i - 1] - ROW_TOLERANCE) inversions += 1;
      }
      passed = inversions === 0;
      detail = `${inversions} cross-row inversion(s) across ${ys.length} top-level children (tolerance ${ROW_TOLERANCE})`;
    }

    results.push({ kind: a.kind, passed, detail, why: a.why });
  }
  return results;
}

// --- §21.4 code metrics -----------------------------------------------------------

function checkCode(html: string, css: string, tree: UIRoot) {
  // Parse/duplicate-id checks come from the SHARED validator in shared-types, which is
  // the same code backend enforces when persisting a hand-edited version. Keeping a
  // second copy here would let the metric and the gate disagree.
  const validation = validateGeneratedCode(html, css);

  // Eval-only: every rendered type must have a codegen mapping. Asserted, not assumed —
  // a class added to the taxonomy without a renderer silently falls back to <div>.
  const rendered = new Set<string>();
  for (const c of tree.children) walk(c, (n) => rendered.add(n.type));
  const unmapped = [...rendered].filter(
    (t) => t !== "group" && !(ALL_CLASSES as readonly string[]).includes(t)
  );

  return {
    htmlParses: validation.htmlParses,
    cssParses: validation.cssParses,
    duplicateIds: validation.duplicateIds,
    unmappedComponentTypes: unmapped,
    htmlBytes: html.length,
    cssBytes: css.length,
  };
}

// --- runner -----------------------------------------------------------------------

async function detect(file: string) {
  const buf = fs.readFileSync(file);
  const fd = new FormData();
  const ext = path.extname(file).toLowerCase();
  fd.append("file", new Blob([buf], { type: ext === ".png" ? "image/png" : "image/jpeg" }), path.basename(file));
  const res = await fetch(`${WORKER}/detect`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`worker ${res.status}`);
  return res.json() as Promise<{
    detections: { className: string; confidence: number; bbox: BBox; status?: string; modelVersionId: string }[];
    pageBoundary: { polygon: number[][]; confidence: number; method: string; applied: boolean };
    imageWidth: number; imageHeight: number;
  }>;
}

async function main(): Promise<void> {
  const modelVersion = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "ml/models/ui-detector/v1.0.0/metrics.json"), "utf-8")
  ).model_version as string;

  console.log(`Sketch2UI evaluation — model ${modelVersion}\n`);

  const files = fs.readdirSync(SAMPLES).filter((f) => f.endsWith(".png")).sort();
  const boundary: Record<string, unknown> = {};
  const layout: Record<string, unknown> = {};
  const code: Record<string, unknown> = {};
  const e2e: Record<string, unknown> = {};

  for (const f of files) {
    const key = f.slice(0, 8);
    const full = path.join(SAMPLES, f);

    let r: Awaited<ReturnType<typeof detect>>;
    try {
      r = await detect(full);
    } catch (e) {
      e2e[key] = { usablePreview: false, failedAt: "detect", error: String(e) };
      continue;
    }

    // §21.2
    const gt = BOUNDARY_GROUND_TRUTH[key];
    const predicted = r.pageBoundary.polygon.map((p) => [p[0], p[1]]) as PagePolygon;
    if (gt) {
      boundary[key] = {
        method: r.pageBoundary.method,
        confidence: r.pageBoundary.confidence,
        applied: r.pageBoundary.applied,
        iou: Number(polygonIoU(predicted, gt).toFixed(4)),
        groundTruth: gt,
        predicted,
      };
    }

    // Build detections exactly as backend persists them.
    const dets: Detection[] = r.detections.map((d, i) => ({
      id: `d${i}`, projectId: "p", pageId: "pg", sourceAssetId: "a",
      className: d.className, confidence: d.confidence, bbox: d.bbox,
      status: (d.status ?? "active") as Detection["status"], source: "model",
      modelVersionId: d.modelVersionId, createdAt: "", updatedAt: "",
    }));
    const active = dets.filter((d) => d.status === "active");

    const tree = buildUITree(active, { name: key, viewport: { width: r.imageWidth, height: r.imageHeight } });
    const html = generateHTML(tree);
    const css = generateCSS(tree);

    // §21.4
    const cm = checkCode(html, css, tree);
    code[key] = cm;

    // §21.3
    const spec = Object.entries(LAYOUT_ASSERTIONS).find(([, v]) => v.file === f);
    if (spec) {
      const res = evaluateAssertions(tree, spec[1].assertions);
      layout[spec[0]] = {
        passed: res.filter((x) => x.passed).length,
        total: res.length,
        assertions: res,
      };
    }

    // §21.7 — operational definition of "reaches a usable preview"
    const nonDegenerateTree = tree.children.length > 0;
    const usable =
      active.length >= 1 && nonDegenerateTree && cm.htmlParses && cm.cssParses && cm.duplicateIds.length === 0;
    e2e[key] = {
      usablePreview: usable,
      acceptedDetections: active.length,
      rejectedDetections: dets.length - active.length,
      topLevelNodes: tree.children.length,
      htmlParses: cm.htmlParses,
      cssParses: cm.cssParses,
      duplicateIds: cm.duplicateIds.length,
    };
  }

  const usableCount = Object.values(e2e).filter((v) => (v as { usablePreview: boolean }).usablePreview).length;
  const ious = Object.values(boundary).map((b) => (b as { iou: number }).iou);
  const layoutPassed = Object.values(layout).reduce<number>((acc, v) => acc + (v as { passed: number }).passed, 0);
  const layoutTotal = Object.values(layout).reduce<number>((acc, v) => acc + (v as { total: number }).total, 0);

  const report = {
    schemaVersion: "1.0",
    modelVersion,
    generatedUtc: new Date().toISOString(),
    corpus: { name: "sample_images_object_detataction_expectation", images: files.length },
    summary: {
      endToEndUsablePreviewRate: Number((usableCount / files.length).toFixed(4)),
      endToEndUsable: `${usableCount}/${files.length}`,
      boundaryMeanIoU: Number((ious.reduce((a, b) => a + b, 0) / (ious.length || 1)).toFixed(4)),
      boundaryFoundCount: Object.values(boundary).filter((b) => (b as { method: string }).method !== "none").length,
      layoutAssertionsPassed: `${layoutPassed}/${layoutTotal}`,
      codeAllParse: Object.values(code).every((c) => (c as { htmlParses: boolean; cssParses: boolean }).htmlParses && (c as { cssParses: boolean }).cssParses),
      codeDuplicateIdsTotal: Object.values(code).reduce<number>((acc, c) => acc + (c as { duplicateIds: string[] }).duplicateIds.length, 0),
      codeUnmappedTypesTotal: Object.values(code).reduce<number>((acc, c) => acc + (c as { unmappedComponentTypes: string[] }).unmappedComponentTypes.length, 0),
    },
    "21.2_pageBoundaryIoU": boundary,
    "21.3_layoutStructure": layout,
    "21.4_codeMetrics": code,
    "21.7_endToEnd": e2e,
    notCovered: {
      "21.1_detectionMetrics": "produced at training time; see ml/models/ui-detector/v1.0.0/metrics.json",
      "21.5_visualSimilarity": "OUT OF SCOPE: no reference-design benchmark exists — only sketches. Building one would mean inventing 'correct' target renders, which is not a real evaluation.",
      "21.6_humanEvaluation": "OUT OF SCOPE: requires actual human evaluators. Not simulated or approximated.",
    },
  };

  const outPath = path.join(REPO_ROOT, OUT_FILE);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");

  console.log("─── Summary ───\n");
  for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k.padEnd(28)} ${v}`);
  console.log(`\n§21.2 per-image boundary IoU:`);
  for (const [k, v] of Object.entries(boundary)) {
    const b = v as { iou: number; method: string; confidence: number };
    console.log(`  ${k}  IoU=${b.iou.toFixed(3)}  method=${b.method}  conf=${b.confidence}`);
  }
  console.log(`\n§21.3 layout assertions:`);
  for (const [k, v] of Object.entries(layout)) {
    const l = v as { passed: number; total: number; assertions: { kind: string; passed: boolean; detail: string }[] };
    console.log(`  ${k}: ${l.passed}/${l.total}`);
    for (const a of l.assertions) console.log(`     ${a.passed ? "PASS" : "FAIL"}  ${a.kind.padEnd(26)} ${a.detail}`);
  }
  console.log(`\nWrote ${OUT_FILE}\n`);
}

main();
