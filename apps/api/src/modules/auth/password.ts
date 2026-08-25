import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
// N=16384, r=8, p=1 — OWASP's minimum-acceptable scrypt cost parameters for
// interactive login. Node's crypto.scrypt is used instead of bcrypt/argon2 so the
// authentication module adds zero new native-dependency surface (Phase D1 scope).
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, SCRYPT_OPTS, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, salt);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
