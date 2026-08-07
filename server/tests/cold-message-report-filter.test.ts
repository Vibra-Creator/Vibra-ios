/**
 * Integration test: report-based cold-message filter
 *
 * Verifies that:
 *  1. After user A reports user B, B's cold messages are hidden from A's
 *     received list — even when B sends a NEW message after the report.
 *  2. The filter is independent of block status (works even if A has NOT
 *     explicitly blocked B via the blockedUsers table).
 *  3. Messages from non-reported senders are unaffected.
 *  4. The silent-drop guard in storage.sendColdMessage is NOT exercised here
 *     (that guard lives in the HTTP route layer); this test targets the
 *     storage-level filter in getColdMessagesReceived, which is the persistent
 *     layer that survives restarts and session expiry.
 *
 * Run with:
 *   npx tsx --test server/tests/cold-message-report-filter.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.js";
import { DatabaseStorage } from "../storage.js";
import {
  profiles,
  reports,
  coldMessages,
  blockedUsers,
} from "../../shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";

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
