import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { User } from "@sketch2ui/shared-types";
import { getPrismaClient } from "./client.js";
import type { CreateUserInput, UserRepository } from "../types.js";

function toRecord(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async findByEmail(email: string): Promise<User | null> {
    // Emails are normalized (trim+lowercase) before ever reaching a repository, so an
    // exact match is correct here — no case-insensitive collation needed.
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: { email: input.email, passwordHash: input.passwordHash },
    });
    return toRecord(row);
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async listAll(): Promise<User[]> {
    const rows = await this.prisma.user.findMany();
    return rows.map(toRecord);
  }

  async setRole(id: string, role: string): Promise<User | null> {
    try {
      const row = await this.prisma.user.update({ where: { id }, data: { role } });
      return toRecord(row);
    } catch {
      // Prisma throws on an update to a missing row — findById/create/etc. in this
      // same file already prefer "return null" over a thrown error for a missing
      // record, so this matches that convention rather than introducing a new one.
      return null;
    }
  }
}
