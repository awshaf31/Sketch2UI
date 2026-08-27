import { v4 as uuid } from "uuid";
import type { User } from "@sketch2ui/shared-types";
import { db } from "../../db/jsonStore.js";
import type { CreateUserInput, UserRepository } from "../types.js";

function detach<T>(value: T): T {
  return structuredClone(value);
}

export class JsonUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = db.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user ? detach(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = db.state.users.find((u) => u.id === id);
    return user ? detach(user) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      id: uuid(),
      email: input.email,
      passwordHash: input.passwordHash,
      googleId: input.googleId,
      role: "user",
      createdAt: now,
      updatedAt: now,
    };
    db.state.users.push(user);
    db.save();
    return detach(user);
  }

  async count(): Promise<number> {
    return db.state.users.length;
  }

  async listAll(): Promise<User[]> {
    return db.state.users.map(detach);
  }

  async setRole(id: string, role: string): Promise<User | null> {
    const user = db.state.users.find((u) => u.id === id);
    if (!user) return null;
    user.role = role;
    user.updatedAt = new Date().toISOString();
    db.save();
    return detach(user);
  }

  async linkGoogleAccount(id: string, googleId: string): Promise<User> {
    const user = db.state.users.find((u) => u.id === id);
    if (!user) throw new Error(`User ${id} not found.`);
    user.googleId = googleId;
    user.updatedAt = new Date().toISOString();
    db.save();
    return detach(user);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<User | null> {
    const user = db.state.users.find((u) => u.id === id);
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    db.save();
    return detach(user);
  }
}
