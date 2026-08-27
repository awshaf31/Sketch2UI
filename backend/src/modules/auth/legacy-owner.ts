/**
 * The well-known account that pre-auth projects are assigned to.
 *
 * A fixed id/email so the backfill (backend/scripts/backfill-legacy-owner.ts) and the
 * JSON->Postgres importer (db/migrate-json-to-postgres.ts) always agree on the same
 * account, and re-running either is idempotent rather than creating duplicates.
 *
 * Not meant to be logged into: its password hash is a random value nobody knows,
 * generated once at creation time (see the backfill script). There is no
 * password-reset flow in Phase D1's scope, so this is a deliberate, permanent
 * placeholder account, not a real user.
 */
export const LEGACY_OWNER_ID = "00000000-0000-4000-8000-000000000001";
export const LEGACY_OWNER_EMAIL = "legacy-owner@sketch2ui.local";
