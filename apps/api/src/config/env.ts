import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Repo root is apps/api/src/config -> ../../../..
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  dataDir: process.env.DATA_DIR ?? path.join(REPO_ROOT, "data"),
  uploadsDir: process.env.UPLOADS_DIR ?? path.join(REPO_ROOT, "data", "uploads"),
  // Export ZIPs live beside uploads under data/, the same local-filesystem convention
  // asset storage already uses — not a separate storage mechanism.
  exportsDir: process.env.EXPORTS_DIR ?? path.join(REPO_ROOT, "data", "exports"),
  storeFile: process.env.STORE_FILE ?? path.join(REPO_ROOT, "apps", "api", "data", "store.json"),
  // SaaS phase S9 — Admin Models reads model registry metadata straight off disk
  // (ml/models/<family>/<version>/metrics.json). Models are files, not a Prisma
  // entity — see admin.routes.ts's header comment.
  mlModelsDir: process.env.ML_MODELS_DIR ?? path.join(REPO_ROOT, "ml", "models"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // services/cv-worker. Loopback by default — plan section 19.6: the worker must not be
  // reachable from the public internet, only through this API.
  cvWorkerUrl: process.env.CV_WORKER_URL ?? "http://127.0.0.1:8000",
  // Inference on CPU runs ~2s for a single sketch; allow generous headroom before
  // declaring the worker unreachable.
  cvWorkerTimeoutMs: Number(process.env.CV_WORKER_TIMEOUT_MS ?? 120_000),
  /**
   * Which persistence adapter the repository layer uses — Phase 8 amendment §8.
   *
   * Defaults to "json" DELIBERATELY: the migration is incremental, and most modules
   * still read `db.state` directly. Defaulting to "postgres" while unconverted modules
   * bypass the repositories would split the source of truth in two, which is the one
   * failure mode the amendment is most concerned with.
   *
   * This switch exists for migration and parity testing only. The end state is
   * "postgres" for every module; see the amendment's rollback section.
   */
  persistenceDriver: (process.env.PERSISTENCE_DRIVER ?? "json") as "json" | "postgres",
};
