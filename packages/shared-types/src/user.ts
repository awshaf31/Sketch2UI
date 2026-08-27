export interface User {
  id: string;
  email: string;
  /** Null for a Google-only account — nothing to verify a password login against. */
  passwordHash: string | null;
  /** Google's stable per-account subject id, set once a Google sign-in has linked
   * this account (first Google sign-in for a new email, or a later one for an
   * existing password account with a matching, Google-verified email). */
  googleId?: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/** The only shape of a User ever serialized to a client — never the passwordHash. */
export interface PublicUser {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
