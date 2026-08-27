// SaaS phase S10 — Audit Logs (brief Phase 14). Append-oriented: the repository
// contract (see backend/src/repositories/types.ts) deliberately exposes no update or
// delete method for this domain — a real audit trail is never edited after the fact.
//
// MODEL_ACTIVATED (from the brief's example list) is intentionally absent: there is
// no route or script anywhere in this app that activates a model — the CV worker
// picks its version from a MODEL_VERSION env var at process start, not an
// application action this app could log. Logging an event that never fires would be
// a fabricated audit trail, which defeats the point of one.
export type AuditEvent =
  | "user_registered"
  | "user_login"
  | "user_logout"
  | "user_password_reset"
  | "project_created"
  | "project_deleted"
  | "project_accessed_by_admin"
  | "training_approved"
  | "admin_role_changed";

export interface AuditLog {
  id: string;
  event: AuditEvent;
  /** The account that performed the action. Nullable so a hypothetical future
   * system-triggered event (no human actor) has somewhere valid to point, and so a
   * user's audit trail survives if the account is ever deleted (no such deletion
   * feature exists today, but the schema doesn't assume it never will). */
  userId: string | null;
  /** A loose, polymorphic pointer at whatever the event is about — "project", the
   * project id — kept as two plain strings rather than a real relation, since an
   * audit log must survive its target being deleted (a PROJECT_DELETED row's own
   * targetId points at a project that, by definition, no longer exists). */
  targetType: string | null;
  targetId: string | null;
  /** Small, non-sensitive context only — see each call site for what's actually
   * included. Never a password, session token, or password hash. */
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
