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
import type {
  AssetRepository,
  AuditLogRepository,
  BoundaryRepository,
  CodeVersionRepository,
  ContentOverrideRepository,
  CorrectionRepository,
  DetectionRepository,
  ExportRepository,
  GeometryOverrideRepository,
  JobRepository,
  PageRepository,
  PasswordResetTokenRepository,
  ProjectRepository,
  SessionRepository,
  StructureOverrideRepository,
  StyleOverrideRepository,
  TrainingRepository,
  UserRepository,
} from "./types.js";
import { JsonProjectRepository } from "./json/project.repository.js";
import { JsonPageRepository } from "./json/page.repository.js";
import { JsonAssetRepository } from "./json/asset.repository.js";
import { JsonDetectionRepository } from "./json/detection.repository.js";
import { JsonBoundaryRepository } from "./json/boundary.repository.js";
import { JsonCodeVersionRepository } from "./json/code-version.repository.js";
import { JsonStyleOverrideRepository } from "./json/style-override.repository.js";
import { JsonContentOverrideRepository } from "./json/content-override.repository.js";
import { JsonGeometryOverrideRepository } from "./json/geometry-override.repository.js";
import { JsonStructureOverrideRepository } from "./json/structure-override.repository.js";
import { JsonTrainingRepository } from "./json/training.repository.js";
import { JsonCorrectionRepository } from "./json/correction.repository.js";
import { JsonExportRepository } from "./json/export.repository.js";
import { JsonJobRepository } from "./json/job.repository.js";
import { JsonUserRepository } from "./json/user.repository.js";
import { JsonSessionRepository } from "./json/session.repository.js";
import { JsonPasswordResetTokenRepository } from "./json/password-reset-token.repository.js";
import { JsonAuditLogRepository } from "./json/audit-log.repository.js";
import { PrismaProjectRepository } from "./prisma/project.repository.js";
import { PrismaPageRepository } from "./prisma/page.repository.js";
import { PrismaAssetRepository } from "./prisma/asset.repository.js";
import { PrismaDetectionRepository } from "./prisma/detection.repository.js";
import { PrismaBoundaryRepository } from "./prisma/boundary.repository.js";
import { PrismaCodeVersionRepository } from "./prisma/code-version.repository.js";
import { PrismaStyleOverrideRepository } from "./prisma/style-override.repository.js";
import { PrismaContentOverrideRepository } from "./prisma/content-override.repository.js";
import { PrismaGeometryOverrideRepository } from "./prisma/geometry-override.repository.js";
import { PrismaStructureOverrideRepository } from "./prisma/structure-override.repository.js";
import { PrismaTrainingRepository } from "./prisma/training.repository.js";
import { PrismaCorrectionRepository } from "./prisma/correction.repository.js";
import { PrismaExportRepository } from "./prisma/export.repository.js";
import { PrismaJobRepository } from "./prisma/job.repository.js";
import { PrismaUserRepository } from "./prisma/user.repository.js";
import { PrismaSessionRepository } from "./prisma/session.repository.js";
import { PrismaPasswordResetTokenRepository } from "./prisma/password-reset-token.repository.js";
import { PrismaAuditLogRepository } from "./prisma/audit-log.repository.js";

export * from "./types.js";

/** Domains migrated to the repository layer so far. Grows per Phase 8 increment. */
export interface MigratedRepositories {
  projects: ProjectRepository;
  pages: PageRepository;
  assets: AssetRepository;
  detections: DetectionRepository;
  boundaries: BoundaryRepository;
  codeVersions: CodeVersionRepository;
  styleOverrides: StyleOverrideRepository;
  contentOverrides: ContentOverrideRepository;
  geometryOverrides: GeometryOverrideRepository;
  structureOverrides: StructureOverrideRepository;
  training: TrainingRepository;
  corrections: CorrectionRepository;
  exports: ExportRepository;
  jobs: JobRepository;
  users: UserRepository;
  sessions: SessionRepository;
  passwordResetTokens: PasswordResetTokenRepository;
  auditLogs: AuditLogRepository;
}

let cached: MigratedRepositories | undefined;

function build(): MigratedRepositories {
  if (env.persistenceDriver === "postgres") {
    return {
      projects: new PrismaProjectRepository(),
      pages: new PrismaPageRepository(),
      assets: new PrismaAssetRepository(),
      detections: new PrismaDetectionRepository(),
      boundaries: new PrismaBoundaryRepository(),
      codeVersions: new PrismaCodeVersionRepository(),
      styleOverrides: new PrismaStyleOverrideRepository(),
      contentOverrides: new PrismaContentOverrideRepository(),
      geometryOverrides: new PrismaGeometryOverrideRepository(),
      structureOverrides: new PrismaStructureOverrideRepository(),
      training: new PrismaTrainingRepository(),
      corrections: new PrismaCorrectionRepository(),
      exports: new PrismaExportRepository(),
      jobs: new PrismaJobRepository(),
      users: new PrismaUserRepository(),
      sessions: new PrismaSessionRepository(),
      passwordResetTokens: new PrismaPasswordResetTokenRepository(),
      auditLogs: new PrismaAuditLogRepository(),
    };
  }
  return {
    projects: new JsonProjectRepository(),
    pages: new JsonPageRepository(),
    assets: new JsonAssetRepository(),
    detections: new JsonDetectionRepository(),
    boundaries: new JsonBoundaryRepository(),
    codeVersions: new JsonCodeVersionRepository(),
    styleOverrides: new JsonStyleOverrideRepository(),
    contentOverrides: new JsonContentOverrideRepository(),
    geometryOverrides: new JsonGeometryOverrideRepository(),
    structureOverrides: new JsonStructureOverrideRepository(),
    training: new JsonTrainingRepository(),
    corrections: new JsonCorrectionRepository(),
    exports: new JsonExportRepository(),
    jobs: new JsonJobRepository(),
    users: new JsonUserRepository(),
    sessions: new JsonSessionRepository(),
    passwordResetTokens: new JsonPasswordResetTokenRepository(),
    auditLogs: new JsonAuditLogRepository(),
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
