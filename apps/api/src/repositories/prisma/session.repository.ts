import type { PrismaClient, Session as PrismaSession } from "@prisma/client";
import type { Session } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreateSessionInput, SessionRepository } from "../types.js";

function toRecord(row: PrismaSession): Session {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(input: CreateSessionInput): Promise<void> {
    await this.prisma.session.create({
      data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({ where: { tokenHash } });
    return row ? toRecord(row) : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    // deleteMany, not delete: the contract is a silent no-op when the session is
    // already gone, and `delete` would throw P2025 instead (same reasoning as
    // PrismaProjectRepository's setActiveCodeVersion/setStatus).
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }
}
