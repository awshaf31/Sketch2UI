import { v4 as uuid } from "uuid";
import type { ProjectAsset } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { AssetRepository, CreateAssetInput } from "../types.js";

/**
 * JSON-backed AssetRepository — Phase 8 compatibility adapter.
 *
 * Adapter over the existing `db.state`, not a redesign. Same two contract rules as the
 * project adapter: reads are DETACHED (Prisma cannot hand back live references, so
 * neither may this, or the contract tests would pass here and fail there), and writes
 * are explicit calls rather than in-place mutation.
 *
 * ORDERING IS PART OF THE CONTRACT. The route this replaces returned
 * `db.state.assets.filter(...)` — plain array order, i.e. insertion order. Callers
 * depend on it: exports.routes.ts takes `.at(-1)` to find a project's source sketch.
 * So `listByProject` is specified as insertion order, and the Prisma adapter sorts by
 * `createdAt` to reproduce it.
 */

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonAssetRepository implements AssetRepository {
  async listByProject(projectId: string): Promise<ProjectAsset[]> {
    return db.state.assets.filter((a) => a.projectId === projectId).map(detach);
  }

  async findById(id: string): Promise<ProjectAsset | null> {
    const asset = db.state.assets.find((a) => a.id === id);
    return asset ? detach(asset) : null;
  }

  async findLatestForProject(projectId: string): Promise<ProjectAsset | null> {
    const list = db.state.assets.filter((a) => a.projectId === projectId);
    const latest = list[list.length - 1];
    return latest ? detach(latest) : null;
  }

  async create(input: CreateAssetInput): Promise<ProjectAsset> {
    const asset: ProjectAsset = {
      id: uuid(),
      projectId: input.projectId,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      width: input.width,
      height: input.height,
      fileSize: input.fileSize,
      createdAt: new Date().toISOString(),
    };
    db.state.assets.push(asset);
    db.save();
    return detach(asset);
  }
}
