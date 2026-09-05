/**
 * Regression tests for orphaned report cleanup monitoring and
 * DatabaseStorage.pruneOrphanedReports()
 *
 * Run the safe monitoring tests with:
 *   npx tsx tests/prune-orphaned-reports.test.ts
 *
 * The database integration cases are opt-in:
 *   RUN_REPORT_CLEANUP_DB_TESTS=true npx tsx tests/prune-orphaned-reports.test.ts
 * They must only be run against a disposable development database.
 *
 * The test inserts controlled rows, runs the pruner, and asserts:
 *   1. A report whose reported profile is gone AND reportedUserId has no active
 *      profile IS deleted when it is old enough.
 *   2. A report whose reported profile is gone BUT reportedUserId still has an
 *      active profile is NOT deleted (userId linkage preserved, Task #23).
 *   3. A recent orphaned report (within TTL) is NOT deleted regardless.
 */

import assert from "node:assert/strict";
import { db } from "../server/db";
import {
  buildReportCleanupStatusFailure,
  buildReportCleanupStatusResponse,
  createReportCleanupState,
  getReportCleanupHealth,
  markReportCleanupFailed,
  markReportCleanupStarted,
  markReportCleanupSucceeded,
} from "../server/report-cleanup";
import { storage } from "../server/storage";
import { reports, profiles, users } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// ─── helpers ─────────────────────────────────────────────────────────────────

function pass(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string): never {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

async function cleanupReports(reportIds: string[]) {
  if (reportIds.length) {
    await db.delete(reports).where(inArray(reports.id, reportIds));
  }
}

async function cleanupProfiles(profileIds: string[]) {
  if (profileIds.length) {
    await db.delete(profiles).where(inArray(profiles.id, profileIds));
  }
}

async function cleanupUsers(userIds: string[]) {
  if (userIds.length) {
    await db.delete(users).where(inArray(users.id, userIds));
  }
}

// ─── test data builders ──────────────────────────────────────────────────────

async function insertUser(id = randomUUID()): Promise<string> {
  await db.insert(users).values({
    id,
    email: `test-${id}@test.invalid`,
    firstName: "Test",
  }).onConflictDoNothing();
  return id;
}

async function insertProfile(userId: string, id = randomUUID()): Promise<string> {
  await db.insert(profiles).values({
    id,
    userId,
    name: `Profile-${id.slice(0, 6)}`,
    age: 25,
    imageUrl: "/images/avatar-placeholder.png",
    alienType: "Cosmico",
  }).onConflictDoNothing();
  return id;
}

/**
 * Insert a report row with createdAt backdated by `daysAgo`.
 * Uses raw SQL so we can override the defaultNow() timestamp.
 */
async function insertBackdatedReport(opts: {
  reportedId: string;
  reportedUserId: string | null;
  daysAgo: number;
}): Promise<string> {
  const id = randomUUID();
  const reporterId = randomUUID();
  await db.execute(sql`
    INSERT INTO reports (id, reporter_id, reported_id, reported_user_id, reason, created_at)
    VALUES (
      ${id},
      ${reporterId},
      ${opts.reportedId},
      ${opts.reportedUserId},
      'test',
      NOW() - make_interval(days => ${opts.daysAgo})
    )
  `);
  return id;
}

// ─── test runner ─────────────────────────────────────────────────────────────

const TTL_DAYS = 90;
const RUN_DATABASE_INTEGRATION = process.env.RUN_REPORT_CLEANUP_DB_TESTS === "true";
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.REPLIT_DEPLOYMENT === "1" ||
  process.env.REPLIT_DEPLOYMENT === "true";

function testCleanupMonitoring() {
  const startedAt = "2026-09-05T10:00:00.000Z";
  const completedAt = "2026-09-05T10:00:01.000Z";
  const now = Date.parse("2026-09-05T10:05:00.000Z");

  let state = markReportCleanupStarted(createReportCleanupState(), startedAt);
  state = markReportCleanupSucceeded(state, 0, completedAt);
  assert.deepEqual(
    buildReportCleanupStatusResponse(state, 0, now),
    {
      ...state,
      ttlDays: 90,
      orphanedReportsOlderThanTtl: 0,
      schedulerStale: false,
      healthy: true,
    },
    "a successful zero-deletion run should be healthy",
  );

  state = markReportCleanupStarted(state, "2026-09-05T11:00:00.000Z");
  state = markReportCleanupSucceeded(state, 4, "2026-09-05T11:00:01.000Z");
  assert.equal(state.lastDeletedCount, 4, "a successful run should expose its deletion count");
  assert.equal(state.consecutiveFailures, 0);

  state = markReportCleanupStarted(state, "2026-09-05T12:00:00.000Z");
  state = markReportCleanupFailed(state, new Error("database unavailable"));
  assert.equal(state.status, "failure");
  assert.equal(state.lastError, "database unavailable");
  assert.equal(state.consecutiveFailures, 1);
  assert.equal(
    buildReportCleanupStatusResponse(state, 4, now).healthy,
    false,
    "a failed cleanup attempt should be unhealthy",
  );

  const staleState = markReportCleanupSucceeded(
    markReportCleanupStarted(createReportCleanupState(), "2026-09-03T00:00:00.000Z"),
    0,
    "2026-09-03T00:00:01.000Z",
  );
  assert.deepEqual(getReportCleanupHealth(staleState, now), {
    schedulerStale: true,
    healthy: false,
  });

  const backlogFailure = buildReportCleanupStatusFailure(staleState, now);
  assert.equal(backlogFailure.orphanedReportsOlderThanTtl, null);
  assert.equal(backlogFailure.healthy, false);
  assert.equal(backlogFailure.error, "Unable to read orphaned report backlog");

  console.log("✓ cleanup monitoring reports zero deletions, deletion counts, failures, stale runs, and backlog-query failures");
}

/** Ensure the columns added by the runtime migration in routes.ts exist before
 *  the test tries to read/write the reports table. */
async function ensureReportColumns() {
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_id VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS cold_message_content TEXT`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id VARCHAR`);
  await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_email TEXT`);
}

async function main() {
  console.log("\nprune-orphaned-reports integration tests\n");
  testCleanupMonitoring();

  if (!RUN_DATABASE_INTEGRATION) {
    console.log("Skipping database mutation cases (set RUN_REPORT_CLEANUP_DB_TESTS=true to opt in).\n");
    return;
  }
  if (IS_PRODUCTION) {
    throw new Error("Refusing database mutation cases in a production environment");
  }

  await ensureReportColumns();

  // ── Case 1: old orphaned report with NO surviving userId profile → deleted ──
  {
    const userId = await insertUser();
    const profileId = await insertProfile(userId);
    // Delete profile and user so no active profile exists for this userId
    await db.delete(profiles).where(eq(profiles.id, profileId));
    await db.delete(users).where(eq(users.id, userId));

    const reportId = await insertBackdatedReport({
      reportedId: profileId,
      reportedUserId: userId,
      daysAgo: TTL_DAYS + 1,
    });

    const deletedCount = await storage.pruneOrphanedReports(TTL_DAYS);
    const [remaining] = await db.select().from(reports).where(eq(reports.id, reportId));

    if (remaining) {
      await cleanupReports([reportId]);
      fail("Case 1: expected the orphaned report to be deleted, but it still exists");
    }
    if (deletedCount < 1) {
      fail("Case 1: pruneOrphanedReports returned 0 but the row should have been deleted");
    }
    pass("Case 1: old orphaned report with no surviving userId profile → deleted");
  }

  // ── Case 2: old report, profile gone, BUT userId has an active profile → kept ──
  // This is the key safety case: the reported user re-registered (same userId, new
  // profile UUID). The report row must survive so the cold-message filter still works.
  {
    const userId = await insertUser();
    // New profile under the same userId (account recreation scenario)
    const newProfileId = await insertProfile(userId);
    // The original profile this report targeted is gone
    const deletedProfileId = randomUUID();

    const reportId = await insertBackdatedReport({
      reportedId: deletedProfileId, // no longer exists
      reportedUserId: userId,        // but userId still has a live profile!
      daysAgo: TTL_DAYS + 1,
    });

    await storage.pruneOrphanedReports(TTL_DAYS);
    const [remaining] = await db.select().from(reports).where(eq(reports.id, reportId));

    // Clean up regardless of outcome
    await cleanupReports([reportId]);
    await cleanupProfiles([newProfileId]);
    await cleanupUsers([userId]);

    if (!remaining) {
      fail("Case 2: report with active userId linkage was incorrectly pruned");
    }
    pass("Case 2: orphaned report with active userId profile → preserved (linkage intact)");
  }

  // ── Case 3: orphaned report that is too recent → kept ──
  {
    const userId = await insertUser();
    const profileId = await insertProfile(userId);
    await db.delete(profiles).where(eq(profiles.id, profileId));
    await db.delete(users).where(eq(users.id, userId));

    const reportId = await insertBackdatedReport({
      reportedId: profileId,
      reportedUserId: userId,
      daysAgo: TTL_DAYS - 1, // within TTL — must NOT be pruned
    });

    await storage.pruneOrphanedReports(TTL_DAYS);
    const [remaining] = await db.select().from(reports).where(eq(reports.id, reportId));

    await cleanupReports([reportId]);

    if (!remaining) {
      fail("Case 3: recent orphaned report was incorrectly pruned before TTL expired");
    }
    pass("Case 3: recent orphaned report → preserved (not yet past TTL)");
  }

  // ── Case 4: old report, profile gone, userId gone, BUT reported email belongs ──
  // to a current user who has an active profile → kept.
  // This covers the "same email, new auth provider" re-registration path that
  // the reportedEmail anchor was added to protect (Task #23 email gap).
  {
    // Original user deleted (userId gone from users table)
    const oldEmail = `test-reregistered-${randomUUID()}@test.invalid`;

    // New user registered with the same email address (different userId)
    const newUserId = await insertUser(randomUUID());
    // Manually set their email to match the reported email
    await db.execute(sql`UPDATE users SET email = ${oldEmail} WHERE id = ${newUserId}`);
    const newProfileId = await insertProfile(newUserId);

    // The original profile and original userId are gone
    const deletedProfileId = randomUUID();
    const deletedUserId = randomUUID(); // never actually in users table

    const reportId = await insertBackdatedReport({
      reportedId: deletedProfileId,   // gone
      reportedUserId: deletedUserId,  // gone (no profile linked)
      daysAgo: TTL_DAYS + 1,
    });
    // Patch in the reportedEmail so the email anchor is active
    await db.execute(sql`UPDATE reports SET reported_email = ${oldEmail} WHERE id = ${reportId}`);

    await storage.pruneOrphanedReports(TTL_DAYS);
    const [remaining] = await db.select().from(reports).where(eq(reports.id, reportId));

    // Clean up regardless of outcome
    await cleanupReports([reportId]);
    await cleanupProfiles([newProfileId]);
    await cleanupUsers([newUserId]);

    if (!remaining) {
      fail("Case 4: report retained by email anchor was incorrectly pruned");
    }
    pass("Case 4: same-email re-registration → report preserved (email-anchor linkage intact)");
  }

  console.log("\nAll tests passed ✓\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
