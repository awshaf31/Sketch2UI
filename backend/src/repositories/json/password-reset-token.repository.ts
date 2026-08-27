import { v4 as uuid } from "uuid";
import type { PasswordResetToken } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreatePasswordResetTokenInput, PasswordResetTokenRepository } from "../types.js";

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonPasswordResetTokenRepository implements PasswordResetTokenRepository {
  async create(input: CreatePasswordResetTokenInput): Promise<void> {
    const token: PasswordResetToken = {
      id: uuid(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.state.passwordResetTokens.push(token);
    db.save();
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const token = db.state.passwordResetTokens.find((t) => t.tokenHash === tokenHash);
    return token ? detach(token) : null;
  }

  async deleteAllForUser(userId: string): Promise<void> {
    db.state.passwordResetTokens = db.state.passwordResetTokens.filter((t) => t.userId !== userId);
    db.save();
  }
}
