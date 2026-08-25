import { v4 as uuid } from "uuid";
import type { Session } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreateSessionInput, SessionRepository } from "../types.js";

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonSessionRepository implements SessionRepository {
  async create(input: CreateSessionInput): Promise<void> {
    const session: Session = {
      id: uuid(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.state.sessions.push(session);
    db.save();
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const session = db.state.sessions.find((s) => s.tokenHash === tokenHash);
    return session ? detach(session) : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    db.state.sessions = db.state.sessions.filter((s) => s.tokenHash !== tokenHash);
    db.save();
  }
}
