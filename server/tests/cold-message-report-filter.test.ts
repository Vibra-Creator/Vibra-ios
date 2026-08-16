/**
 * Integration test: report-based cold-message filter
 *
 * Verifies that:
 *  1. After user A reports user B, B's cold messages are hidden from A's
 *     received list — even when B sends a NEW message after the report.
 *  2. The filter is independent of block status (works even if A has NOT
 *     explicitly blocked B via the blockedUsers table).
 *  3. Messages from non-reported senders are unaffected.
 *  4. The silent-drop guard lives in storage.sendColdMessage (not in the HTTP
 *     route layer). Calling sendColdMessage after a report silently discards
 *     the message without inserting a DB row. This test verifies both the
 *     send-time drop and the read-time filter in getColdMessagesReceived.
 *  5. (Edge case) A re-created account (same underlying userId, new profile UUID)
 *     is still caught by the filter because createReport denormalises the
 *     reportedUserId and getColdMessagesReceived expands the filter set to include
 *     all current profiles that share that userId.
 *
 * Run with:
 *   npx tsx --test server/tests/cold-message-report-filter.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.js";
import { runMigrations } from "../migrate.js";
import { DatabaseStorage } from "../storage.js";
import {
  profiles,
  reports,
  coldMessages,
  blockedUsers,
  users,
} from "../../shared/schema.js";
import { eq, and, inArray, or } from "drizzle-orm";

// ─── Schema migration (runs once before any test suite) ──────────────────────
// Delegates to the shared migration runner so tests and the HTTP server always
// apply exactly the same set of migrations — no duplication, no drift.

before(async () => {
  await runMigrations();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const storage = new DatabaseStorage();

/** Unique suffix so parallel test runs don't collide */
const RUN_ID = Date.now().toString(36);

function testProfileName(label: string) {
  return `__test_${label}_${RUN_ID}`;
}

/** Minimal profile fixture — only the required NOT NULL columns */
async function createTestProfile(label: string): Promise<string> {
  const [row] = await db
    .insert(profiles)
    .values({
      name: testProfileName(label),
      age: 25,
      bio: "",
      imageUrl: "/images/test.png",
      location: "",
      interests: [],
      alienType: "test",
      isBot: false,
    })
    .returning({ id: profiles.id });
  return row.id;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

let createdProfileIds: string[] = [];

after(async () => {
  if (createdProfileIds.length === 0) return;
  // Remove in dependency order: cold_messages → reports → blockedUsers → profiles
  await db
    .delete(coldMessages)
    .where(
      and(
        inArray(coldMessages.fromProfileId, createdProfileIds)
      )
    );
  await db
    .delete(coldMessages)
    .where(
      and(
        inArray(coldMessages.toProfileId, createdProfileIds)
      )
    );
  await db
    .delete(reports)
    .where(inArray(reports.reporterId, createdProfileIds));
  await db
    .delete(reports)
    .where(inArray(reports.reportedId, createdProfileIds));
  await db
    .delete(blockedUsers)
    .where(inArray(blockedUsers.blockerId, createdProfileIds));
  await db
    .delete(profiles)
    .where(inArray(profiles.id, createdProfileIds));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Report-based cold-message filter", () => {
  let profileA: string; // reporter / recipient
  let profileB: string; // reported sender
  let profileC: string; // innocent third party

  before(async () => {
    profileA = await createTestProfile("A");
    profileB = await createTestProfile("B");
    profileC = await createTestProfile("C");
    createdProfileIds = [profileA, profileB, profileC];
  });

  // ── 1. Baseline: before any report, messages are visible ──────────────────

  test("messages from B are visible before any report", async () => {
    await storage.sendColdMessage(profileB, profileA, "hi before report");

    const received = await storage.getColdMessagesReceived(profileA);
    const fromB = received.filter((m) => m.fromProfileId === profileB);
    assert.equal(fromB.length, 1, "B's message should appear before report");
  });

  // ── 2. Core: report filters future messages ────────────────────────────────

  test("after A reports B, B's existing and new messages are hidden", async () => {
    // A reports B
    await storage.createReport({
      reporterId: profileA,
      reportedId: profileB,
      reason: "spam",
    });

    // B sends a NEW message after the report
    await storage.sendColdMessage(profileB, profileA, "post-report message");

    const received = await storage.getColdMessagesReceived(profileA);
    const fromB = received.filter((m) => m.fromProfileId === profileB);
    assert.equal(
      fromB.length,
      0,
      "No messages from reported sender B should appear"
    );
  });

  // ── 3. Filter is independent of block status ───────────────────────────────

  test("filter works even without an explicit block entry", async () => {
    // Confirm A has NOT blocked B (no blockedUsers row)
    const isBlockedRow = await db
      .select()
      .from(blockedUsers)
      .where(
        and(
          eq(blockedUsers.blockerId, profileA),
          eq(blockedUsers.blockedId, profileB)
        )
      );
    assert.equal(
      isBlockedRow.length,
      0,
      "A has not explicitly blocked B"
    );

    // Messages still filtered purely due to the report
    const received = await storage.getColdMessagesReceived(profileA);
    const fromB = received.filter((m) => m.fromProfileId === profileB);
    assert.equal(
      fromB.length,
      0,
      "Filter must work without a block — report alone is sufficient"
    );
  });

  // ── 4. Non-reported senders are unaffected ─────────────────────────────────

  test("messages from non-reported sender C remain visible", async () => {
    await storage.sendColdMessage(profileC, profileA, "hello from C");

    const received = await storage.getColdMessagesReceived(profileA);
    const fromC = received.filter((m) => m.fromProfileId === profileC);
    assert.equal(
      fromC.length,
      1,
      "C's message should still be visible (C was not reported)"
    );
  });

  // ── 5. Filter survives a simulated restart (re-instantiated storage) ───────

  test("filter persists across storage re-instantiation (simulated restart)", async () => {
    // Create a fresh DatabaseStorage instance — simulates a server restart
    const freshStorage = new DatabaseStorage();

    const received = await freshStorage.getColdMessagesReceived(profileA);
    const fromB = received.filter((m) => m.fromProfileId === profileB);
    assert.equal(
      fromB.length,
      0,
      "Filter must persist after storage re-instantiation"
    );
  });

  // ── 6. Filter survives session expiry (stateless DB query) ────────────────

  test("filter is stateless — works without any cached session data", async () => {
    // getColdMessagesReceived derives everything from the DB; no in-memory
    // session state is involved. Calling it with only the profileId (as a
    // fresh request after session expiry would) should still enforce the filter.
    const received = await storage.getColdMessagesReceived(profileA);
    const fromB = received.filter((m) => m.fromProfileId === profileB);
    assert.equal(
      fromB.length,
      0,
      "Filter is stateless and must hold without session data"
    );
  });

  // ── 7. Reporter's own sent messages are unaffected ────────────────────────

  test("A can still see messages she sent herself (unrelated to filter)", async () => {
    // A sends a cold message to C — not affected by A's report of B
    await storage.sendColdMessage(profileA, profileC, "A writes to C");

    const sent = await storage.getSentColdMessages(profileA);
    const toC = sent.filter((m) => m.toProfileId === profileC);
    assert.ok(toC.length >= 1, "A's outgoing messages are not filtered");
  });
});

// ─── Deleted-and-recreated account edge case ──────────────────────────────────
//
// Scenario: B deletes their profile and registers again under the same
// underlying auth-user id (account recreation). Without userId-level linkage
// the new profile UUID wouldn't match A's report and the filter would silently
// miss B's messages.
//
// Fix applied:
//  • createReport now stores the reportedUserId (denormalised from the profile
//    row at report-creation time).
//  • deleteProfile no longer removes reports where the deleted profile is the
//    *reported* party — they survive as the linkage anchor.
//  • getColdMessagesReceived expands the filter set to include every current
//    profile that shares a reportedUserId, catching the new profile UUID.

describe("Deleted-and-recreated account filter (account recreation gap)", () => {
  // Synthetic auth-user id shared by B's old and new profiles
  const SHARED_USER_ID = `__test_user_B2_${RUN_ID}`;

  let recipientA: string;   // A — reporter / cold-message recipient
  let senderB_old: string;  // B's original profile (will be deleted)
  let senderB_new: string;  // B's new profile after recreation

  /** Extra profile ids tracked for cleanup (senderB_old may be deleted mid-test) */
  const localIds: string[] = [];

  before(async () => {
    // Recipient A — no special userId needed
    recipientA = await createTestProfile("Arec");

    // B's first profile carries the shared userId
    const [rowOld] = await db
      .insert(profiles)
      .values({
        name: testProfileName("Bold"),
        age: 22,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: SHARED_USER_ID,
      })
      .returning({ id: profiles.id });
    senderB_old = rowOld.id;

    // B's new profile after re-registration — same userId, fresh UUID
    const [rowNew] = await db
      .insert(profiles)
      .values({
        name: testProfileName("Bnew"),
        age: 22,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: SHARED_USER_ID,
      })
      .returning({ id: profiles.id });
    senderB_new = rowNew.id;

    localIds.push(recipientA, senderB_new);
    // senderB_old may be deleted during the test; add it anyway — deletions are idempotent
    localIds.push(senderB_old);
  });

  after(async () => {
    if (localIds.length === 0) return;
    await db.delete(coldMessages).where(
      or(
        inArray(coldMessages.fromProfileId, localIds),
        inArray(coldMessages.toProfileId, localIds),
      ),
    );
    await db.delete(reports).where(
      or(
        inArray(reports.reporterId, localIds),
        inArray(reports.reportedId, localIds),
      ),
    );
    // Profiles that were already deleted mid-test won't be found; that's fine.
    await db.delete(profiles).where(inArray(profiles.id, localIds)).catch(() => {});
  });

  // ── 8a. Gap documented: without userId linkage the new profile would slip through

  test("without the fix, B_new's messages would be visible (gap documented)", async () => {
    // A reports B_old BEFORE it is deleted. createReport captures reportedUserId.
    await storage.createReport({
      reporterId: recipientA,
      reportedId: senderB_old,
      reason: "spam",
    });

    // Confirm the report row now carries the shared userId
    const [reportRow] = await db
      .select({ reportedUserId: reports.reportedUserId })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, recipientA),
          eq(reports.reportedId, senderB_old),
        ),
      );
    assert.equal(
      reportRow?.reportedUserId,
      SHARED_USER_ID,
      "createReport must denormalise the reportedUserId from the profile row",
    );
  });

  // ── 8b. B deletes their profile; the report survives (new deleteProfile behaviour)

  test("report survives deleteProfile so the linkage anchor is preserved", async () => {
    // Delete B's old profile via the storage method (simulates account deletion)
    await storage.deleteProfile(senderB_old);

    // Report must still exist (deleteProfile no longer removes reports-as-reported)
    const surviving = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, recipientA),
          eq(reports.reportedId, senderB_old),
        ),
      );
    assert.equal(
      surviving.length,
      1,
      "Report must survive profile deletion so userId-level linkage is preserved",
    );
  });

  // ── 8c. B_new sends a cold message; the filter catches it via userId linkage

  test("messages from B_new (same userId, new profile UUID) are filtered out", async () => {
    // B registers fresh — same underlying userId, brand-new profile UUID (senderB_new)
    await storage.sendColdMessage(senderB_new, recipientA, "hi from my new account");

    const received = await storage.getColdMessagesReceived(recipientA);
    const fromBNew = received.filter((m) => m.fromProfileId === senderB_new);
    assert.equal(
      fromBNew.length,
      0,
      "Messages from the recreated account (same userId) must be filtered — userId-level linkage must catch the new profile UUID",
    );
  });
});

// ─── Send-time guard: isSenderReportedByRecipient ────────────────────────────
//
// The POST /api/cold-messages route calls storage.isSenderReportedByRecipient
// before persisting the message.  This suite verifies that the shared predicate
// correctly catches both the direct UUID case and the recreated-account case
// (same userId, new profile UUID — no direct reportedId match).

describe("isSenderReportedByRecipient — send-time guard", () => {
  const GUARD_USER_ID = `__test_user_guard_${RUN_ID}`;

  let recipient: string;
  let senderOld: string;
  let senderNew: string;
  let unrelatedSender: string;

  const localIds: string[] = [];

  before(async () => {
    recipient = await createTestProfile("Grec");
    unrelatedSender = await createTestProfile("Gunrel");

    const [rowOld] = await db
      .insert(profiles)
      .values({
        name: testProfileName("Gsenold"),
        age: 24,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: GUARD_USER_ID,
      })
      .returning({ id: profiles.id });
    senderOld = rowOld.id;

    const [rowNew] = await db
      .insert(profiles)
      .values({
        name: testProfileName("Gsennew"),
        age: 24,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: GUARD_USER_ID,
      })
      .returning({ id: profiles.id });
    senderNew = rowNew.id;

    localIds.push(recipient, unrelatedSender, senderOld, senderNew);
  });

  after(async () => {
    if (localIds.length === 0) return;
    await db.delete(coldMessages).where(
      or(
        inArray(coldMessages.fromProfileId, localIds),
        inArray(coldMessages.toProfileId, localIds),
      ),
    );
    await db.delete(reports).where(
      or(
        inArray(reports.reporterId, localIds),
        inArray(reports.reportedId, localIds),
      ),
    );
    await db.delete(profiles).where(inArray(profiles.id, localIds)).catch(() => {});
  });

  test("returns false for a sender who has not been reported by the recipient", async () => {
    const result = await storage.isSenderReportedByRecipient(unrelatedSender, recipient);
    assert.equal(result, false, "Unreported sender must not be flagged");
  });

  test("returns true for a direct UUID match (normal report case)", async () => {
    await storage.createReport({
      reporterId: recipient,
      reportedId: senderOld,
      reason: "spam",
    });
    const result = await storage.isSenderReportedByRecipient(senderOld, recipient);
    assert.equal(result, true, "Direct UUID match must be detected");
  });

  test("returns true for a recreated account (same userId, new profile UUID)", async () => {
    // senderOld is reported; senderNew shares the same userId.
    // No direct UUID match exists for senderNew.
    const result = await storage.isSenderReportedByRecipient(senderNew, recipient);
    assert.equal(
      result,
      true,
      "Recreated account (same userId) must be flagged even without a direct reportedId match",
    );
  });

  test("silently drops a cold message from a recreated account (storage-layer guard)", async () => {
    // The guard now lives inside storage.sendColdMessage itself — no HTTP layer needed.
    // Calling sendColdMessage directly must silently discard the message (return "sent"
    // without inserting a DB row) when the sender is reported by the recipient.
    const result = await storage.sendColdMessage(senderNew, recipient, "this should be dropped");
    assert.equal(result.status, "sent", "Guard must return 'sent' to hide the filter from the caller");
    assert.equal(result.coldMessage, undefined, "No ColdMessage object must be returned when silently dropped");

    // Confirm no DB row was created
    const rows = await db
      .select({ id: coldMessages.id })
      .from(coldMessages)
      .where(
        and(
          eq(coldMessages.fromProfileId, senderNew),
          eq(coldMessages.toProfileId, recipient),
        ),
      );
    assert.equal(
      rows.length,
      0,
      "Cold-message must not be persisted when the storage-layer guard fires for a recreated account",
    );
  });
});

// ─── Self-service deletion path (DELETE /api/profiles/me) ─────────────────────
//
// The self-service route performs its own cascade-delete sequence without going
// through storage.deleteProfile.  It must apply the same rule: only remove
// reports where the departing profile is the *reporter* (reporterId = profileId),
// NOT where it is the *reported* party.
//
// This suite replicates the route's DB-level operations to verify that the
// report-linkage anchor survives a self-service profile deletion and that
// cold messages from the recreated account remain hidden.

describe("Self-service profile deletion preserves report linkage (DELETE /api/profiles/me path)", () => {
  const SELF_SERVICE_USER_ID = `__test_user_SS_${RUN_ID}`;

  let recipientA: string;
  let senderB_old: string;
  let senderB_new: string;

  const localIds: string[] = [];

  before(async () => {
    recipientA = await createTestProfile("SSA");

    const [rowOld] = await db
      .insert(profiles)
      .values({
        name: testProfileName("SSBold"),
        age: 23,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: SELF_SERVICE_USER_ID,
      })
      .returning({ id: profiles.id });
    senderB_old = rowOld.id;

    const [rowNew] = await db
      .insert(profiles)
      .values({
        name: testProfileName("SSBnew"),
        age: 23,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: SELF_SERVICE_USER_ID,
      })
      .returning({ id: profiles.id });
    senderB_new = rowNew.id;

    localIds.push(recipientA, senderB_new, senderB_old);
  });

  after(async () => {
    if (localIds.length === 0) return;
    await db.delete(coldMessages).where(
      or(
        inArray(coldMessages.fromProfileId, localIds),
        inArray(coldMessages.toProfileId, localIds),
      ),
    );
    await db.delete(reports).where(
      or(
        inArray(reports.reporterId, localIds),
        inArray(reports.reportedId, localIds),
      ),
    );
    await db.delete(profiles).where(inArray(profiles.id, localIds)).catch(() => {});
  });

  test("self-service deletion keeps the report row when the deleted profile was reported", async () => {
    // A reports B's original profile (reportedUserId is denormalised)
    await storage.createReport({
      reporterId: recipientA,
      reportedId: senderB_old,
      reason: "harassment",
    });

    // Simulate the self-service DELETE /api/profiles/me cascade.
    // The route now only deletes reports where reporterId = profileId:
    await db.delete(reports).where(eq(reports.reporterId, senderB_old));
    // …then deletes the profile row itself
    await db.delete(profiles).where(eq(profiles.id, senderB_old));

    // Report filed by A against B_old must survive (B_old was the reported party)
    const surviving = await db
      .select({ id: reports.id, reportedUserId: reports.reportedUserId })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, recipientA),
          eq(reports.reportedId, senderB_old),
        ),
      );
    assert.equal(
      surviving.length,
      1,
      "Report must survive self-service profile deletion (reported party, not reporter)",
    );
    assert.equal(
      surviving[0].reportedUserId,
      SELF_SERVICE_USER_ID,
      "reportedUserId anchor must be intact after self-service deletion",
    );
  });

  test("after self-service deletion, B_new's cold message is still filtered via userId linkage", async () => {
    // B creates a new profile (senderB_new) under the same userId and messages A
    await storage.sendColdMessage(senderB_new, recipientA, "hi from recreated account via self-service path");

    const received = await storage.getColdMessagesReceived(recipientA);
    const fromBNew = received.filter((m) => m.fromProfileId === senderB_new);
    assert.equal(
      fromBNew.length,
      0,
      "Cold messages from a recreated account must be filtered even after self-service profile deletion",
    );
  });
});

// ─── Email-level linkage (Task #30) ───────────────────────────────────────────
//
// Scenario: B deletes their account entirely and re-registers with a completely
// NEW userId (e.g. switches from Google auth to Apple auth) but keeps the same
// email address.  Without email-level linkage the new userId would not match any
// reportedUserId stored in the report row, and B's messages would slip through.
//
// Fix applied:
//  • createReport now also stores reportedEmail (looked up from the users table
//    via the profile's userId) alongside reportedUserId.
//  • isSenderReportedByRecipient additionally matches by current sender email vs
//    stored reportedEmail.
//  • getColdMessagesReceived additionally expands the filtered-ID set by joining
//    current users on email to find profiles with a matching email.
//
// NOTE: this does NOT catch a brand-new email address — that gap is explicitly
//       documented in the codebase as a known limitation.

describe("Email-level linkage filter (same email, new userId/auth provider)", () => {
  const SHARED_EMAIL = `test_email_${RUN_ID}@example.invalid`;

  // Two distinct synthetic auth-user ids to simulate a provider switch
  const USER_ID_OLD = `__test_uid_email_old_${RUN_ID}`;
  const USER_ID_NEW = `__test_uid_email_new_${RUN_ID}`;

  let recipientA: string;     // reporter / cold-message recipient (no auth user needed)
  let senderB_old: string;    // B's original profile (linked to USER_ID_OLD / SHARED_EMAIL)
  let senderB_new: string;    // B's new profile (linked to USER_ID_NEW / same SHARED_EMAIL)

  const localIds: string[] = [];
  const localUserIds: string[] = [];

  before(async () => {
    recipientA = await createTestProfile("EmlA");
    localIds.push(recipientA);

    // Insert two distinct users rows that share the same email
    await db.insert(users).values({
      id: USER_ID_OLD,
      email: SHARED_EMAIL,
      firstName: "B",
      lastName: "Old",
    }).onConflictDoNothing();

    await db.insert(users).values({
      id: USER_ID_NEW,
      email: SHARED_EMAIL,
      firstName: "B",
      lastName: "New",
    }).onConflictDoNothing();

    localUserIds.push(USER_ID_OLD, USER_ID_NEW);

    // B's original profile linked to the old user id
    const [rowOld] = await db
      .insert(profiles)
      .values({
        name: testProfileName("EmlBold"),
        age: 26,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: USER_ID_OLD,
      })
      .returning({ id: profiles.id });
    senderB_old = rowOld.id;
    localIds.push(senderB_old);

    // B's new profile linked to the NEW user id (simulates fresh auth registration)
    const [rowNew] = await db
      .insert(profiles)
      .values({
        name: testProfileName("EmlBnew"),
        age: 26,
        bio: "",
        imageUrl: "/images/test.png",
        location: "",
        interests: [],
        alienType: "test",
        isBot: false,
        userId: USER_ID_NEW,
      })
      .returning({ id: profiles.id });
    senderB_new = rowNew.id;
    localIds.push(senderB_new);
  });

  after(async () => {
    if (localIds.length > 0) {
      await db.delete(coldMessages).where(
        or(
          inArray(coldMessages.fromProfileId, localIds),
          inArray(coldMessages.toProfileId, localIds),
        ),
      );
      await db.delete(reports).where(
        or(
          inArray(reports.reporterId, localIds),
          inArray(reports.reportedId, localIds),
        ),
      );
      await db.delete(profiles).where(inArray(profiles.id, localIds)).catch(() => {});
    }
    if (localUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, localUserIds)).catch(() => {});
    }
  });

  test("createReport captures reportedEmail from the users table", async () => {
    await storage.createReport({
      reporterId: recipientA,
      reportedId: senderB_old,
      reason: "spam",
    });

    const [reportRow] = await db
      .select({ reportedEmail: reports.reportedEmail, reportedUserId: reports.reportedUserId })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, recipientA),
          eq(reports.reportedId, senderB_old),
        ),
      );
    assert.equal(
      reportRow?.reportedEmail,
      SHARED_EMAIL,
      "createReport must store the reported user's email in the report row",
    );
    assert.equal(
      reportRow?.reportedUserId,
      USER_ID_OLD,
      "createReport must also store reportedUserId as a secondary anchor",
    );
  });

  test("isSenderReportedByRecipient returns true for a new account sharing the same email", async () => {
    // senderB_old was reported; senderB_new has a DIFFERENT userId but the SAME email.
    const result = await storage.isSenderReportedByRecipient(senderB_new, recipientA);
    assert.equal(
      result,
      true,
      "isSenderReportedByRecipient must match by reportedEmail when the userId differs",
    );
  });

  test("getColdMessagesReceived filters out messages from a same-email new account", async () => {
    // senderB_new sends a cold message to recipientA
    await storage.sendColdMessage(senderB_new, recipientA, "hi from my new email account");

    const received = await storage.getColdMessagesReceived(recipientA);
    const fromBNew = received.filter((m) => m.fromProfileId === senderB_new);
    assert.equal(
      fromBNew.length,
      0,
      "getColdMessagesReceived must filter out messages from a profile whose email matches a reported email",
    );
  });

  test("sendColdMessage silently drops message from same-email new account (send-time guard)", async () => {
    // The storage-layer guard inside sendColdMessage must fire for the new account too.
    // We need to clean up any existing row first (previous test may have inserted before the filter).
    await db.delete(coldMessages).where(
      and(
        eq(coldMessages.fromProfileId, senderB_new),
        eq(coldMessages.toProfileId, recipientA),
      ),
    );

    const result = await storage.sendColdMessage(senderB_new, recipientA, "dropped at send time");
    assert.equal(result.status, "sent", "Guard must return 'sent' to hide the filter from the caller");
    assert.equal(result.coldMessage, undefined, "No ColdMessage object must be returned when silently dropped");

    // Confirm no DB row was created
    const rows = await db
      .select({ id: coldMessages.id })
      .from(coldMessages)
      .where(
        and(
          eq(coldMessages.fromProfileId, senderB_new),
          eq(coldMessages.toProfileId, recipientA),
        ),
      );
    assert.equal(
      rows.length,
      0,
      "Cold message must not be persisted when email-level filter fires at send time",
    );
  });
});
