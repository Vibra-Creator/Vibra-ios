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
  // Real profiles are linked to an auth account. Legacy schema defaulted is_bot
  // to true, which could make a real recipient trigger automated bot replies.
  await db.execute(sql`ALTER TABLE profiles ALTER COLUMN is_bot SET DEFAULT FALSE`);
  await db.execute(sql`
    UPDATE profiles
    SET is_bot = FALSE
    WHERE user_id IS NOT NULL
      AND is_bot IS DISTINCT FROM FALSE
  `);

  // Some verified real accounts were created in users but never received a
  // profile because the old registration repair was non-fatal. Without a
  // profile they cannot appear in the radar or receive messages. Recreate only
  // real verified accounts; bot-user remnants and admins must stay excluded.
  const repairedProfiles: any = await db.execute(sql`
    INSERT INTO profiles (
      id, user_id, name, age, bio, image_url, location, interests,
      alien_type, is_bot, is_verified, points, referral_code
    )
    SELECT
      gen_random_uuid(),
      u.id,
      COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'Esploratore'),
      25,
      '',
      COALESCE(NULLIF(u.profile_image_url, ''), '/images/avatar-1.png'),
      '',
      '{}'::text[],
      (ARRAY['Nebulare', 'Cristallino', 'Biotico', 'Dimensionale', 'Solare', 'Viaggiatore Stellare', 'Quantico', 'Etereo'])
        [1 + floor(random() * 8)::int],
      FALSE,
      FALSE,
      0,
      'VBR-' || upper(substr(md5(u.id || random()::text), 1, 8))
    FROM users u
    WHERE COALESCE(u.is_admin, FALSE) = FALSE
      AND COALESCE(u.email_verified, FALSE) = TRUE
      AND u.id NOT LIKE 'bot-user-%'
      AND u.email IS DISTINCT FROM 'nome@vibra.app'
      AND NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.user_id = u.id
      )
    RETURNING id
  `);
  const repairedCount = repairedProfiles?.rowCount ?? repairedProfiles?.rows?.length ?? 0;
  if (repairedCount > 0) {
    console.log(`[migrate] Repaired ${repairedCount} real accounts missing profiles`);
  }

  // ── reports table extra columns ───────────────────────────────────────────
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_id VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_content TEXT`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_content_type TEXT`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_content_id VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_content_snapshot TEXT`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderation_action TEXT`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderated_by VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS moderation_hidden BOOLEAN NOT NULL DEFAULT FALSE`);
  // reportedUserId: denormalised auth-user id captured at report creation time so
  // the filter survives profile deletion (account re-creation gap fix).
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id VARCHAR`);
  // reportedEmail: email address of the reported user captured at report-creation time.
  // Provides a second linkage anchor so that a bad actor who re-registers with the same
  // email (even under a new auth provider / userId) can still be matched.
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_email TEXT`);

  // Persist the admin-email outbox on the report row itself. Existing reports
  // predate delivery tracking and must not all be emailed again on deployment.
  await db.execute(sql`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS notification_status TEXT NOT NULL DEFAULT 'not_required'
  `);
  await db.execute(sql`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    ALTER TABLE reports
    ADD COLUMN IF NOT EXISTS notification_next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW()
  `);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS notification_last_attempt_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS notification_last_error TEXT`);
  await db.execute(sql`
    UPDATE reports
    SET notification_status = 'not_required'
    WHERE notification_status IS NULL
  `);
  await db.execute(sql`
    UPDATE reports
    SET notification_attempts = 0
    WHERE notification_attempts IS NULL
  `);
  await db.execute(sql`
    UPDATE reports
    SET notification_next_attempt_at = NOW()
    WHERE notification_next_attempt_at IS NULL
  `);
  await db.execute(sql`
    ALTER TABLE reports
    ALTER COLUMN notification_status SET DEFAULT 'pending',
    ALTER COLUMN notification_status SET NOT NULL,
    ALTER COLUMN notification_attempts SET DEFAULT 0,
    ALTER COLUMN notification_attempts SET NOT NULL,
    ALTER COLUMN notification_next_attempt_at SET DEFAULT NOW(),
    ALTER COLUMN notification_next_attempt_at SET NOT NULL
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS reports_notification_queue_idx
    ON reports (notification_status, notification_next_attempt_at)
  `);

  // ── report cleanup alert state ────────────────────────────────────────────
  // Keep the failure streak and successful notification timestamp across
  // application restarts so an ongoing incident remains rate-limited.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS report_cleanup_alert_state (
      id VARCHAR PRIMARY KEY,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_notification_at TIMESTAMP,
      last_error TEXT
    )
  `);

  // Keep the latest cold-message cleanup result visible across application
  // restarts so an ongoing failure streak is not hidden by a deployment.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cold_message_cleanup_state (
      id VARCHAR PRIMARY KEY,
      last_attempt_at TIMESTAMP,
      last_success_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'never',
      last_deleted_count INTEGER,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    )
  `);

  // Enforce one cold-message inbox entry per directed profile pair. Preserve
  // any legacy duplicates rather than deleting messages or replies implicitly;
  // sendColdMessage also takes this pair's advisory lock if the index cannot
  // yet be installed.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('cold_messages_from_to_unique_migration'))`);
    const duplicates = await tx.execute(sql`
      SELECT 1
      FROM cold_messages
      GROUP BY from_profile_id, to_profile_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `);
    if (duplicates.rows.length > 0) {
      console.warn("[migrate] Skipped cold-message uniqueness index because legacy duplicate pairs need review");
    } else {
      await tx.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS cold_messages_from_to_unique
        ON cold_messages (from_profile_id, to_profile_id)
      `);
    }
  });

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
