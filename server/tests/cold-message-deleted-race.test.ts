/**
 * Integration test: cold-message deletion race condition
 *
 * Verifies that getColdMessageById returns null (→ HTTP 404) when the
 * message is deleted while the recipient's profile-detail modal is open.
 * This is the storage-level guarantee that the client-side guard in
 * ProfileDetailModal.onClose relies on to prevent restoring a stale
 * reply panel after the message has been removed.
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
});
