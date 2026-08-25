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
}
