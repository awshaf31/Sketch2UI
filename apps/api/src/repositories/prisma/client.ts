import { PrismaClient } from "@prisma/client";

/**
 * The single PrismaClient for the process.
 *
 * PrismaClient owns a connection pool, so constructing one per request or per
 * repository would leak connections until the server exhausted the database's limit.
 * One instance, created lazily so that nothing imports a client (and therefore nothing
 * tries to reach a database) unless a Prisma-backed repository is actually used —
 * which matters while PERSISTENCE_DRIVER still defaults to json.
 *
 * This module is the ONLY place in apps/api that may import PrismaClient outside of
 * repositories/prisma/ (amendment §6 rule 3).
 */

let client: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
