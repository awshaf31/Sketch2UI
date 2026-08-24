/**
 * Repository factory — the single place application modules obtain persistence.
 *
 * Phase 8 amendment §6. Rules this file enforces by being the only entry point:
 *
 *   - Route/service modules import from HERE, never from `jsonStore` (after their
 *     migration) and never from `@prisma/client` at all.
 *   - Which adapter is in use is a configuration decision, not something a caller
 *     can see or influence.
 *
 * Only the domains that have actually been migrated are wired up. Listing a domain
 * here that still has no implementation would be a lie the type system would happily
 * accept, so `getRepositories()` returns a partial set that grows one domain at a time
 * — and a module asking for something not yet migrated fails loudly at startup rather
 * than silently getting an undefined.
 */

import { env } from "../config/env.js";
import type { AssetRepository, ProjectRepository } from "./types.js";
import { JsonProjectRepository } from "./json/project.repository.js";
import { JsonAssetRepository } from "./json/asset.repository.js";
import { PrismaProjectRepository } from "./prisma/project.repository.js";
import { PrismaAssetRepository } from "./prisma/asset.repository.js";

export * from "./types.js";

/** Domains migrated to the repository layer so far. Grows per Phase 8 increment. */
export interface MigratedRepositories {
  projects: ProjectRepository;
  assets: AssetRepository;
}

let cached: MigratedRepositories | undefined;

function build(): MigratedRepositories {
  if (env.persistenceDriver === "postgres") {
    return {
      projects: new PrismaProjectRepository(),
      assets: new PrismaAssetRepository(),
    };
  }
  return {
    projects: new JsonProjectRepository(),
    assets: new JsonAssetRepository(),
  };
}

/**
 * Repositories are stateless over their backing store, so one shared set per process is
 * correct and avoids re-creating a Prisma-backed repository (and therefore re-reading
 * the client singleton) on every request.
 */
export function getRepositories(): MigratedRepositories {
  if (!cached) cached = build();
  return cached;
}

/** Test seam: force a specific set, or clear back to configuration-driven. */
export function setRepositoriesForTesting(repos: MigratedRepositories | undefined): void {
  cached = repos;
}
