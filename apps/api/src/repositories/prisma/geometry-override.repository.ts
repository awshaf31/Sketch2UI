import type { PrismaClient, GeometryOverride as PrismaGeometryOverride } from "@prisma/client";
import type { GeometryOverride } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { GeometryOverrideRepository } from "../types.js";

/** Prisma-backed GeometryOverrideRepository. Each field is an independently-nullable column. */

function toValue(row: PrismaGeometryOverride): GeometryOverride {
  return {
    ...(row.x === null ? {} : { x: row.x }),
    ...(row.y === null ? {} : { y: row.y }),
    ...(row.width === null ? {} : { width: row.width }),
    ...(row.height === null ? {} : { height: row.height }),
  };
}

export class PrismaGeometryOverrideRepository implements GeometryOverrideRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async mapForProject(projectId: string): Promise<Record<string, GeometryOverride>> {
    const rows = await this.prisma.geometryOverride.findMany({ where: { projectId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async mapForPage(pageId: string): Promise<Record<string, GeometryOverride>> {
    const rows = await this.prisma.geometryOverride.findMany({ where: { pageId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async findByDetection(projectId: string, detectionId: string): Promise<GeometryOverride | null> {
    const row = await this.prisma.geometryOverride.findFirst({ where: { detectionId, projectId } });
    return row ? toValue(row) : null;
  }

  async put(
    projectId: string,
    pageId: string,
    detectionId: string,
    value: GeometryOverride
  ): Promise<GeometryOverride | null> {
    if (Object.keys(value).length === 0) {
      await this.prisma.geometryOverride.deleteMany({ where: { detectionId, projectId } });
      return null;
    }
    const data = {
      x: value.x ?? null,
      y: value.y ?? null,
      width: value.width ?? null,
      height: value.height ?? null,
    };
    const row = await this.prisma.geometryOverride.upsert({
      where: { detectionId },
      create: { projectId, pageId, detectionId, ...data },
      update: data,
    });
    return toValue(row);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    await this.prisma.geometryOverride.deleteMany({ where: { detectionId, projectId } });
  }
}
