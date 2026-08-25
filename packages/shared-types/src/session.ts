/** Backend-internal only — never serialized to a client. */
export interface Session {
  id: string;
  userId: string;
  /** sha256(cookie token), never the raw token. */
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}
