import type { PrismaClient, StyleOverride as PrismaStyleOverride } from "@prisma/client";
import { getPrismaClient } from "./client.js";
import type { StyleOverrideRepository } from "../types.js";

/**
 * Prisma-backed StyleOverrideRepository.
 *
 * `style` is stored as Json (schema.prisma: the six-property allowlist is enforced at
 * the API boundary, not the database, so §17.3 can extend it without a migration).
 */

function toValue(row: PrismaStyleOverride): Record<string, string> {
  return row.style as Record<string, string>;
}

export class PrismaStyleOverrideRepository implements StyleOverrideRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async mapForProject(projectId: string): Promise<Record<string, Record<string, string>>> {
    const rows = await this.prisma.styleOverride.findMany({ where: { projectId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async findByDetection(projectId: string, detectionId: string): Promise<Record<string, string> | null> {
    const row = await this.prisma.styleOverride.findFirst({ where: { detectionId, projectId } });
    return row ? toValue(row) : null;
  }

  async put(
    projectId: string,
    detectionId: string,
    value: Record<string, string>
  ): Promise<Record<string, string> | null> {
    if (Object.keys(value).length === 0) {
      await this.prisma.styleOverride.deleteMany({ where: { detectionId, projectId } });
      return null;
    }
    const row = await this.prisma.styleOverride.upsert({
      where: { detectionId },
      create: { projectId, detectionId, style: value },
      update: { style: value },
    });
    return toValue(row);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    await this.prisma.styleOverride.deleteMany({ where: { detectionId, projectId } });
  }
}
