import type { Prisma, PrismaClient, AuditLog as PrismaAuditLog } from "@prisma/client";
import type { AuditEvent, AuditLog } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { AuditLogRepository, RecordAuditLogInput } from "../types.js";

function toRecord(row: PrismaAuditLog): AuditLog {
  return {
    id: row.id,
    event: row.event as AuditEvent,
    userId: row.userId,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async record(input: RecordAuditLogInput): Promise<AuditLog> {
    const row = await this.prisma.auditLog.create({
      data: {
        event: input.event,
        userId: input.userId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    return toRecord(row);
  }

  async listRecent(limit: number): Promise<AuditLog[]> {
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toRecord);
  }
}
