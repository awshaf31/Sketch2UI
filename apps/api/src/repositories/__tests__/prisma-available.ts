/**
 * Shared reachability probe for the Prisma contract arms.
 *
 * Deliberately does NOT run migrations or create anything — it only answers "is there a
 * database I am allowed to talk to". Extracted so each new domain's Prisma arm does not
 * re-implement (and subtly vary) the same check.
 *
 * The result is cached: every contract file calls this at import time, and probing once
 * per suite is enough.
 */

let cached: boolean | undefined;

export async function databaseReachable(): Promise<boolean> {
  if (cached !== undefined) return cached;
  if (!process.env.DATABASE_URL) {
    cached = false;
    return cached;
  }
  try {
    const { getPrismaClient } = await import("../prisma/client.js");
    await getPrismaClient().$queryRaw`SELECT 1`;
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}
