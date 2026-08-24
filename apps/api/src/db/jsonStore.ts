import fs from "node:fs";
import path from "node:path";
import type {
  CodeVersion,
  Detection,
  Job,
  Project,
  ProjectAsset,
  PageBoundaryRecord,
  ProjectExport,
  TrainingSample,
} from "@sketch2ui/shared-types";
import { env } from "../config/env.js";

// Temporary persistence layer. Plan section 8 specifies PostgreSQL via Prisma; this
// file-backed store lets the API run without a database during the skeleton phase
// (practical build order, section 51, steps 1-6). Swap for Prisma/Postgres in Phase 2+
// without touching module/route code, since routes only depend on the exported functions below.

interface StoreShape {
  projects: Project[];
  assets: ProjectAsset[];
  detections: Detection[];
  codeVersions: CodeVersion[];
  jobs: Job[];
  trainingSamples: TrainingSample[];
  exports: ProjectExport[];
  pageBoundaries: PageBoundaryRecord[];
}

function emptyStore(): StoreShape {
  return { projects: [], assets: [], detections: [], codeVersions: [], jobs: [], trainingSamples: [], exports: [], pageBoundaries: [] };
}

function load(): StoreShape {
  try {
    const raw = fs.readFileSync(env.storeFile, "utf-8");
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

let store = load();

function persist(): void {
  fs.mkdirSync(path.dirname(env.storeFile), { recursive: true });
  fs.writeFileSync(env.storeFile, JSON.stringify(store, null, 2));
}

export const db = {
  get state(): StoreShape {
    return store;
  },
  save(): void {
    persist();
  },
  reset(): void {
    store = emptyStore();
    persist();
  },
};
