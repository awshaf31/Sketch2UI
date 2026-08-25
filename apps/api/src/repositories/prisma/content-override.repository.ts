import type { PrismaClient, ContentOverride as PrismaContentOverride, ContentState as PrismaContentState } from "@prisma/client";
import type { ContentOverride, ContentState } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { ContentOverrideRepository } from "../types.js";

/**
 * Prisma-backed ContentOverrideRepository.
 *
 * The enum can't spell "user-edited" (Prisma enum members can't contain a hyphen), so
 * `user_edited` is the wire form and this adapter is the only place that translates.
 */

function toDomainState(state: PrismaContentState): ContentState {
  return state === "user_edited" ? "user-edited" : state;
}

function toPrismaState(state: ContentState): PrismaContentState {
  return state === "user-edited" ? "user_edited" : (state as PrismaContentState);
}

function toValue(row: PrismaContentOverride): ContentOverride {
  return {
    ...(row.text === null ? {} : { text: row.text }),
    ...(row.altText === null ? {} : { altText: row.altText }),
    ...(row.href === null ? {} : { href: row.href }),
    contentState: toDomainState(row.contentState),
  };
}

function isEmpty(value: ContentOverride): boolean {
  return value.text === undefined && value.altText === undefined && value.href === undefined;
}

export class PrismaContentOverrideRepository implements ContentOverrideRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async mapForProject(projectId: string): Promise<Record<string, ContentOverride>> {
    const rows = await this.prisma.contentOverride.findMany({ where: { projectId } });
    return Object.fromEntries(rows.map((r) => [r.detectionId, toValue(r)]));
  }

  async findByDetection(projectId: string, detectionId: string): Promise<ContentOverride | null> {
    const row = await this.prisma.contentOverride.findFirst({ where: { detectionId, projectId } });
    return row ? toValue(row) : null;
  }

  async put(projectId: string, detectionId: string, value: ContentOverride): Promise<ContentOverride | null> {
    if (isEmpty(value)) {
      await this.prisma.contentOverride.deleteMany({ where: { detectionId, projectId } });
      return null;
    }
    const data = {
      text: value.text ?? null,
      altText: value.altText ?? null,
      href: value.href ?? null,
      contentState: toPrismaState(value.contentState),
    };
    const row = await this.prisma.contentOverride.upsert({
      where: { detectionId },
      create: { projectId, detectionId, ...data },
      update: data,
    });
    return toValue(row);
  }

  async remove(projectId: string, detectionId: string): Promise<void> {
    await this.prisma.contentOverride.deleteMany({ where: { detectionId, projectId } });
  }
}
