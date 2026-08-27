/**
 * Static guard on direct persistence access — Phase 8 amendment §10, plan Part 14.
 *
 * Two jobs, both chosen for a migration that is deliberately incomplete:
 *
 *   1. MIGRATED modules must contain ZERO `db.state` / `db.save()`. A regression here
 *      means a converted module quietly went back to touching the store directly,
 *      which would reintroduce the split-source-of-truth this phase exists to remove.
 *
 *   2. The remaining total must NOT GROW. Asserting zero overall is impossible until
 *      every module is converted, but a ratchet catches new direct access being added
 *      to unconverted modules while the migration is in flight.
 *
 * Lower BASELINE_* as modules are migrated. The check fails if the real count drops
 * below the baseline too, so the numbers cannot silently drift out of date.
 *
 * Usage: npm run check:db-state
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_SRC = path.resolve(__dirname, "../../backend/src");

/**
 * Modules converted to the repository layer. Each must stay free of direct store
 * access. Add to this list as part of the commit that migrates the module.
 */
const MIGRATED_MODULES = [
  "modules/projects/projects.routes.ts",
  "modules/assets/assets.routes.ts",
  "modules/detections/detections.routes.ts",
  "modules/detections/detect.routes.ts",
  "modules/detections/detect.job.ts",
  "modules/boundaries/boundaries.routes.ts",
  "modules/boundaries/boundaries.service.ts",
  "modules/codegen/code-versions.routes.ts",
  "modules/codegen/codegen.routes.ts",
  "modules/style-overrides/style-overrides.routes.ts",
  "modules/content-overrides/content-overrides.routes.ts",
  "modules/geometry-overrides/geometry-overrides.routes.ts",
  "modules/structure-overrides/structure-overrides.routes.ts",
  "modules/training/training.routes.ts",
  "modules/corrections/corrections.routes.ts",
  "modules/exports/exports.routes.ts",
  "modules/crops/crops.routes.ts",
  "modules/crops/crop.service.ts",
  "modules/jobs/jobs.routes.ts",
  "modules/jobs/jobs.service.ts",
];

/**
 * Files allowed to touch the store regardless: the store itself, its adapters, and the
 * one-way importer. These are persistence infrastructure, not application modules.
 */
const INFRASTRUCTURE = [
  "db/jsonStore.ts",
  "db/migrate-json-to-postgres.ts",
  "repositories/json/",
];

/**
 * Occurrences remaining in UNMIGRATED application modules. Ratchet downward only.
 *
 * Zero as of Phase 8's final domain (Jobs): every application module now goes
 * through the repository layer. This baseline is the permanent regression floor —
 * it can only fail upward from here.
 */
const BASELINE_STATE = 0;
const BASELINE_SAVE = 0;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith(".ts") ? [full] : [];
  });
}

/**
 * Strip comments before counting.
 *
 * Without this the guard reports false positives on its own subject matter: a migrated
 * module that *documents* what it no longer does ("instead of mutating a live object
 * out of `db.state`") would be flagged as still using it. Caught by running the guard
 * against the first migrated module, which is exactly what a guard is for.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments, including JSDoc
    .replace(/\/\/.*$/gm, ""); // line comments
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function main(): void {
  const files = walk(API_SRC);
  const failures: string[] = [];
  let totalState = 0;
  let totalSave = 0;

  for (const file of files) {
    const rel = path.relative(API_SRC, file).split(path.sep).join("/");
    const source = stripComments(fs.readFileSync(file, "utf-8"));
    const stateHits = count(source, "db.state");
    const saveHits = count(source, "db.save()");
    if (stateHits === 0 && saveHits === 0) continue;

    if (INFRASTRUCTURE.some((p) => rel.startsWith(p))) continue;

    if (MIGRATED_MODULES.includes(rel)) {
      failures.push(
        `${rel}: MIGRATED module still has ${stateHits} db.state / ${saveHits} db.save() — ` +
          "it must use the repository layer."
      );
      continue;
    }

    totalState += stateHits;
    totalSave += saveHits;
  }

  console.log("Direct persistence-access guard (Phase 8)\n");
  console.log(`  migrated modules      : ${MIGRATED_MODULES.length}`);
  console.log(`  db.state remaining    : ${totalState}  (baseline ${BASELINE_STATE})`);
  console.log(`  db.save() remaining   : ${totalSave}  (baseline ${BASELINE_SAVE})\n`);

  if (totalState > BASELINE_STATE) {
    failures.push(`db.state grew: ${totalState} > baseline ${BASELINE_STATE}.`);
  }
  if (totalSave > BASELINE_SAVE) {
    failures.push(`db.save() grew: ${totalSave} > baseline ${BASELINE_SAVE}.`);
  }
  if (totalState < BASELINE_STATE || totalSave < BASELINE_SAVE) {
    failures.push(
      `Counts dropped below baseline (${totalState}/${totalSave} vs ${BASELINE_STATE}/${BASELINE_SAVE}). ` +
        "Lower BASELINE_STATE / BASELINE_SAVE in this file to lock the progress in."
    );
  }

  if (failures.length > 0) {
    console.error("FAILED:\n");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("  OK — no migrated module touches the store directly, and the");
  console.log("  remaining count has not grown.\n");
}

main();
