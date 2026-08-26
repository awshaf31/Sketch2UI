import fs from "node:fs";
import path from "node:path";
import { env } from "../../config/env.js";

// SaaS phase S9 — Admin Model Management (brief Phase 12). Models are files under
// ml/models/<family>/<version>/, not a Prisma entity — services/cv-worker/app/
// detector/model.py loads weights.pt straight off this same directory tree, keyed by
// version string. Reading metrics.json off disk here is the honest equivalent of a
// database aggregate for something that was never in the database.
//
// "Active" is determined the exact same way the CV worker itself decides which
// version to load (MODEL_VERSION env var, defaulting to "v1.0.0" — see
// DEFAULT_MODEL_VERSION in model.py) — not a separate admin-only concept that could
// drift from what's actually running.
//
// Deliberately no delete/promote route here (Phase 12: "Do not expose arbitrary model
// weight deletion controls. Model promotion must remain a controlled engineering
// operation" — i.e. deploying a new MODEL_VERSION, not a button in this UI).

export interface AdminModelSummary {
  family: string;
  version: string;
  architecture: string;
  status: string;
  datasetVersion: string;
  classCount: number;
  createdAt: string | null;
  active: boolean;
  metrics: {
    precision: number;
    recall: number;
    mAP50: number;
    mAP50_95: number;
  } | null;
}

interface RawMetrics {
  model_version?: string;
  created_utc?: string;
  status?: string;
  dataset?: { source?: string; classes?: number };
  config?: { pretrained_weights?: string };
  metrics?: {
    val?: { precision?: number; recall?: number; mAP50?: number; mAP50_95?: number };
  };
}

function readMetrics(metricsPath: string): RawMetrics | null {
  try {
    return JSON.parse(fs.readFileSync(metricsPath, "utf-8")) as RawMetrics;
  } catch {
    // A version directory with no readable metrics.json (mid-training, corrupted,
    // hand-created) is skipped rather than surfaced as a broken row — same "don't
    // show what you can't honestly describe" principle as the rest of this admin
    // surface.
    return null;
  }
}

export function listModels(): AdminModelSummary[] {
  const activeVersion = process.env.MODEL_VERSION ?? "v1.0.0";
  const results: AdminModelSummary[] = [];

  let families: string[];
  try {
    families = fs
      .readdirSync(env.mlModelsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return results;
  }

  for (const family of families) {
    const familyDir = path.join(env.mlModelsDir, family);
    const versions = fs
      .readdirSync(familyDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const version of versions) {
      const metricsPath = path.join(familyDir, version, "metrics.json");
      const raw = readMetrics(metricsPath);
      if (!raw) continue;

      results.push({
        family,
        version,
        architecture: raw.config?.pretrained_weights ?? "(unknown)",
        status: raw.status ?? "(unknown)",
        datasetVersion: raw.dataset?.source ?? "(unknown)",
        classCount: raw.dataset?.classes ?? 0,
        createdAt: raw.created_utc ?? null,
        active: version === activeVersion,
        metrics: raw.metrics?.val
          ? {
              precision: raw.metrics.val.precision ?? 0,
              recall: raw.metrics.val.recall ?? 0,
              mAP50: raw.metrics.val.mAP50 ?? 0,
              mAP50_95: raw.metrics.val.mAP50_95 ?? 0,
            }
          : null,
      });
    }
  }

  return results;
}
