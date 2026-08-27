/** Backend-internal only — never serialized to a client. Same shape/intent as
 * Session (session.ts): an opaque bearer value, only its hash is ever stored. */
export interface PasswordResetToken {
  id: string;
  userId: string;
  /** sha256(raw token), never the raw token. */
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}
