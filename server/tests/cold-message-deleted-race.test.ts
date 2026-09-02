/**
 * Integration test: cold-message deletion race condition
 *
 * Verifies that:
 * 1. getColdMessageById returns null (→ HTTP 404) when the message is deleted
 *    while the recipient's profile-detail modal is open.
 * 2. getProfile returns undefined when the sender deletes their account
 *    (→ HTTP 404 with reason "sender_deleted" from the route).
 * 3. isBlocked returns true when the sender blocks the recipient after sending
 *    (→ HTTP 403 with reason "sender_blocked" from the route).
 * 4. replyColdMessage refuses to persist a reply when the sender is deleted
 *    or has blocked the recipient.
 *
 * These are the storage-level guarantees that the GET /api/cold-messages/:id
 * route relies on to suppress the reply panel cleanly.
 *
 * Run with:
 *   npx tsx --test server/tests/cold-message-deleted-race.test.ts
 */

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.js";
import { DatabaseStorage } from "../storage.js";
import { profiles, coldMessages } from "../../shared/schema.js";
import { eq, inArray } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const storage = new DatabaseStorage();

const RUN_ID = Date.now().toString(36);

function testProfileName(label: string) {
  return `__test_race_${label}_${RUN_ID}`;
}

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
  await db
    .delete(coldMessages)
    .where(inArray(coldMessages.fromProfileId, createdProfileIds));
  await db
    .delete(coldMessages)
    .where(inArray(coldMessages.toProfileId, createdProfileIds));
  await db
    .delete(profiles)
    .where(inArray(profiles.id, createdProfileIds));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Cold-message deletion race condition", () => {
  let sender: string;
  let recipient: string;

  before(async () => {
    sender = await createTestProfile("sender");
    recipient = await createTestProfile("recipient");
    createdProfileIds = [sender, recipient];
  });

  test("getColdMessageById returns null after the message is deleted (simulates profile-modal race)", async () => {
    // 1. Sender sends a cold message — recipient opens it, sees reply panel
    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "hello!");
    assert.ok(coldMessage, "sendColdMessage must return the new message");
    const msgId = coldMessage.id;

    // 2. Verify message exists before deletion
    const before = await storage.getColdMessageById(msgId);
    assert.ok(before !== null, "message should exist before deletion");
    assert.equal(before.id, msgId);

    // 3. Recipient deletes the message (e.g. presses Delete while modal is
    //    open in another tab, or sender triggers a moderation deletion)
    await storage.deleteColdMessage(msgId, recipient);

    // 4. The client onClose handler fetches GET /api/cold-messages/:id to
    //    re-validate. At the storage layer this must return null → HTTP 404.
    const after = await storage.getColdMessageById(msgId);
    assert.equal(
      after,
      null,
      "getColdMessageById must return null after deletion so the HTTP route returns 404 and the client clears the panel"
    );
  });

  test("getColdMessageById still returns the message when it was NOT deleted", async () => {
    // Baseline: if the message is still alive, the panel should be restored normally
    // Use a fresh pair so test isolation is maintained (sender→recipient already has a row)
    const sender2 = await createTestProfile("sender2");
    const recipient2 = await createTestProfile("recipient2");
    createdProfileIds.push(sender2, recipient2);

    const { coldMessage } = await storage.sendColdMessage(sender2, recipient2, "still here");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    const msg = await storage.getColdMessageById(coldMessage.id);
    assert.ok(msg !== null, "undeleted message must still be retrievable");
    assert.equal(msg.content, "still here");
  });

  test("getProfile returns undefined after the sender deletes their account (sender-deleted scenario)", async () => {
    // Simulates: sender sends a cold message, recipient opens it, then sender
    // deletes their account. The GET /api/cold-messages/:id route calls
    // storage.getProfile(msg.fromProfileId) and returns 404 when this is falsy.
    const sender3 = await createTestProfile("sender3");
    const recipient3 = await createTestProfile("recipient3");
    createdProfileIds.push(recipient3); // sender3 will be deleted in this test

    const { coldMessage } = await storage.sendColdMessage(sender3, recipient3, "goodbye");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    // Sender deletes their account
    await storage.deleteProfile(sender3);

    // Cold message row may still exist (cascade depends on schema); what matters
    // is that the sender profile lookup returns falsy — the route uses this to
    // return HTTP 404 with reason "sender_deleted".
    const senderProfile = await storage.getProfile(sender3);
    assert.equal(
      senderProfile,
      undefined,
      "getProfile must return undefined after the sender deletes their account"
    );
  });

  test("isBlocked returns true when sender blocks the recipient after sending (sender-blocked scenario)", async () => {
    // Simulates: sender sends a cold message, recipient opens it, then sender
    // blocks the recipient. The GET /api/cold-messages/:id route calls
    // storage.isBlocked(msg.fromProfileId, recipientProfileId) and returns 403
    // with reason "sender_blocked" when this is true.
    const sender4 = await createTestProfile("sender4");
    const recipient4 = await createTestProfile("recipient4");
    createdProfileIds.push(sender4, recipient4);

    const { coldMessage } = await storage.sendColdMessage(sender4, recipient4, "then I blocked you");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    // Sender blocks the recipient after the message was sent
    await storage.blockUser(sender4, recipient4);

    const blocked = await storage.isBlocked(sender4, recipient4);
    assert.equal(
      blocked,
      true,
      "isBlocked must return true after the sender blocks the recipient — route must return 403 sender_blocked"
    );

    // Cleanup block so the cascade delete in `after()` doesn't leave orphan rows
    await storage.unblockUser(sender4, recipient4);
  });

  test("replyColdMessage does not persist after the sender deletes their account", async () => {
    const sender5 = await createTestProfile("sender5");
    const recipient5 = await createTestProfile("recipient5");
    createdProfileIds.push(recipient5); // sender5 is deleted in this test

    const { coldMessage } = await storage.sendColdMessage(sender5, recipient5, "reply race");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    await storage.deleteProfile(sender5);

    await assert.rejects(
      () => storage.replyColdMessage(coldMessage.id, "too late"),
      (error: any) => error?.code === "sender_deleted",
      "replyColdMessage must reject when the sender profile no longer exists"
    );

    const unchanged = await storage.getColdMessageById(coldMessage.id);
    assert.equal(unchanged?.replied, false, "deleted sender must not result in a persisted reply");
  });

  test("replyColdMessage does not persist after the sender blocks the recipient", async () => {
    const sender5 = await createTestProfile("sender5_blocked");
    const recipient5 = await createTestProfile("recipient5_blocked");
    createdProfileIds.push(sender5, recipient5);

    const { coldMessage } = await storage.sendColdMessage(sender5, recipient5, "blocked reply race");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    await storage.blockUser(sender5, recipient5);

    await assert.rejects(
      () => storage.replyColdMessage(coldMessage.id, "should not open"),
      (error: any) => error?.code === "sender_blocked",
      "replyColdMessage must reject when the sender blocks the recipient"
    );

    const unchanged = await storage.getColdMessageById(coldMessage.id);
    assert.equal(unchanged?.replied, false, "blocked sender must not result in a persisted reply");

    await storage.unblockUser(sender5, recipient5);
  });
});
