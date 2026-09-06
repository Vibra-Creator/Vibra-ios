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
