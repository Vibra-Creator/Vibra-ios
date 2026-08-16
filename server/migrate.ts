/**
 * Standalone migration runner.
 *
 * Applies all schema changes that are NOT yet expressed as Drizzle migrations
 * (typically `ALTER TABLE … ADD COLUMN IF NOT EXISTS` back-fills and one-off
 * table creations that need to run before any application code touches the DB).
 *
 * Calling this file is safe to do multiple times — every statement is
 * idempotent.  It is called by:
 *   • `registerRoutes` at HTTP-server startup
 *   • Test `before()` hooks so tests can run against a fresh DB without
 *     starting the HTTP server
 */

import { db } from "./db.js";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  // ── reports table extra columns ───────────────────────────────────────────
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_id VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_content TEXT`);
  // reportedUserId: denormalised auth-user id captured at report creation time so
  // the filter survives profile deletion (account re-creation gap fix).
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id VARCHAR`);
  // reportedEmail: email address of the reported user captured at report-creation time.
  // Provides a second linkage anchor so that a bad actor who re-registers with the same
  // email (even under a new auth provider / userId) can still be matched.
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_email TEXT`);

  // Backfill reportedUserId for pre-existing reports whose reported profile still exists
  await db.execute(sql`
    UPDATE reports r
    SET reported_user_id = p.user_id
    FROM profiles p
    WHERE r.reported_id = p.id
      AND r.reported_user_id IS NULL
      AND p.user_id IS NOT NULL
  `);

  // Backfill reportedEmail for pre-existing reports where we can still join to users
  await db.execute(sql`
    UPDATE reports r
    SET reported_email = u.email
    FROM profiles p
    JOIN users u ON u.id = p.user_id
    WHERE r.reported_id = p.id
      AND r.reported_email IS NULL
      AND p.user_id IS NOT NULL
      AND u.email IS NOT NULL
  `);

  // ── vibrapp_dms table (created if absent) ────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS vibrapp_dms (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      from_profile_id VARCHAR NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      to_profile_id VARCHAR NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS vibrapp_dms_from ON vibrapp_dms(from_profile_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS vibrapp_dms_to ON vibrapp_dms(to_profile_id)`);
}
