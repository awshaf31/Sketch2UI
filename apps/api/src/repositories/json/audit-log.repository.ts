import { v4 as uuid } from "uuid";
import type { AuditLog } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { AuditLogRepository, RecordAuditLogInput } from "../types.js";

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonAuditLogRepository implements AuditLogRepository {
  async record(input: RecordAuditLogInput): Promise<AuditLog> {
    const entry: AuditLog = {
      id: uuid(),
      event: input.event,
      userId: input.userId ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      createdAt: new Date().toISOString(),
    };
    db.state.auditLogs.push(entry);
    db.save();
    return detach(entry);
  }

  async listRecent(limit: number): Promise<AuditLog[]> {
    return db.state.auditLogs
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(detach);
  }
}
