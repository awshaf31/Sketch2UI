import { createHash, randomBytes } from "node:crypto";

/** A high-entropy opaque bearer value — this, not any signed payload, is what the
 * `sid` cookie carries. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What actually gets stored: sha256 of the token, never the token itself — a
 * database read/leak must not hand out a usable bearer value directly. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
