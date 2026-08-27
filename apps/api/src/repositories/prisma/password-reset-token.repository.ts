import type { PasswordResetToken as PrismaPasswordResetToken, PrismaClient } from "@prisma/client";
import type { PasswordResetToken } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreatePasswordResetTokenInput, PasswordResetTokenRepository } from "../types.js";

function toRecord(row: PrismaPasswordResetToken): PasswordResetToken {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async create(input: CreatePasswordResetTokenInput): Promise<void> {
    await this.prisma.passwordResetToken.create({
      data: { userId: input.userId, tokenHash: input.tokenHash, expiresAt: input.expiresAt },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return row ? toRecord(row) : null;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId } });
  }
}
