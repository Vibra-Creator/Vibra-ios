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
import express from "express";
import { createServer, request as httpRequest, type Server as HttpServer } from "node:http";
import { db } from "../db.js";
import { getColdMessageByIdHandler } from "../routes.js";
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

async function startRouteTestServer(recipientUserId: string): Promise<HttpServer> {
  const app = express();
  app.use((req: any, _res, next) => {
    req.user = { claims: { sub: recipientUserId } };
    next();
  });
  app.get("/api/cold-messages/:id", getColdMessageByIdHandler);

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server;
}

async function getColdMessageOverHttp(server: HttpServer, messageId: string): Promise<{ statusCode: number; body: any }> {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Route test server is not listening");
  }

  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: `/api/cold-messages/${encodeURIComponent(messageId)}`,
        method: "GET",
        headers: { Accept: "application/json" },
      },
      (response) => {
        let rawBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          rawBody += chunk;
        });
        response.on("end", () => {
          try {
            resolve({
              statusCode: response.statusCode ?? 0,
              body: JSON.parse(rawBody),
            });
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

async function closeRouteTestServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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

describe("GET /api/cold-messages/:id sender reachability", () => {
  test("returns 200 for a recipient when the sender still exists and has not blocked them", async () => {
    const recipientUserId = `__test_http_recipient_${RUN_ID}`;
    const sender = await createTestProfile("http_sender_happy");
    const recipient = await createTestProfile("http_recipient_happy");
    await db.update(profiles).set({ userId: recipientUserId }).where(eq(profiles.id, recipient));
    createdProfileIds.push(sender, recipient);

    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "visible over HTTP");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    const server = await startRouteTestServer(recipientUserId);
    try {
      const response = await getColdMessageOverHttp(server, coldMessage.id);
      assert.equal(response.statusCode, 200);
      assert.equal(response.body.id, coldMessage.id);
      assert.equal(response.body.isSentByMe, false);
      assert.equal(response.body.otherProfile.id, sender);
    } finally {
      await closeRouteTestServer(server);
    }
  });

  test("returns 404 with message_deleted and no message body after deletion", async () => {
    const recipientUserId = `__test_http_recipient_message_deleted_${RUN_ID}`;
    const sender = await createTestProfile("http_sender_message_deleted");
    const recipient = await createTestProfile("http_recipient_message_deleted");
    await db.update(profiles).set({ userId: recipientUserId }).where(eq(profiles.id, recipient));
    createdProfileIds.push(sender, recipient);

    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "deleted before revalidation");
    assert.ok(coldMessage, "sendColdMessage must return the new message");
    await storage.deleteColdMessage(coldMessage.id, recipient);

    const server = await startRouteTestServer(recipientUserId);
    try {
      const response = await getColdMessageOverHttp(server, coldMessage.id);
      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.body, {
        error: "Messaggio non trovato",
        reason: "message_deleted",
      });
      assert.equal(response.body.content, undefined);
      assert.equal(response.body.otherProfile, undefined);
    } finally {
      await closeRouteTestServer(server);
    }
  });

  test("returns 403 with the unauthorized response contract for an unrelated profile", async () => {
    const unrelatedUserId = `__test_http_unrelated_${RUN_ID}`;
    const sender = await createTestProfile("http_sender_unrelated");
    const recipient = await createTestProfile("http_recipient_unrelated");
    const unrelated = await createTestProfile("http_unrelated");
    await db.update(profiles).set({ userId: unrelatedUserId }).where(eq(profiles.id, unrelated));
    createdProfileIds.push(sender, recipient, unrelated);

    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "private content");
    assert.ok(coldMessage, "sendColdMessage must return the new message");

    const server = await startRouteTestServer(unrelatedUserId);
    try {
      const response = await getColdMessageOverHttp(server, coldMessage.id);
      assert.equal(response.statusCode, 403);
      assert.deepEqual(response.body, { error: "Non autorizzato" });
    } finally {
      await closeRouteTestServer(server);
    }
  });

  test("returns 404 with sender_deleted when the sender deletes their profile", async () => {
    const recipientUserId = `__test_http_recipient_deleted_${RUN_ID}`;
    const sender = await createTestProfile("http_sender_deleted");
    const recipient = await createTestProfile("http_recipient_deleted");
    await db.update(profiles).set({ userId: recipientUserId }).where(eq(profiles.id, recipient));
    createdProfileIds.push(sender, recipient);

    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "deleted before reply");
    assert.ok(coldMessage, "sendColdMessage must return the new message");
    await storage.deleteProfile(sender);

    const server = await startRouteTestServer(recipientUserId);
    try {
      const response = await getColdMessageOverHttp(server, coldMessage.id);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body.reason, "sender_deleted");
    } finally {
      await closeRouteTestServer(server);
    }
  });

  test("returns 403 with sender_blocked when the sender blocks the recipient", async () => {
    const recipientUserId = `__test_http_recipient_blocked_${RUN_ID}`;
    const sender = await createTestProfile("http_sender_blocked");
    const recipient = await createTestProfile("http_recipient_blocked");
    await db.update(profiles).set({ userId: recipientUserId }).where(eq(profiles.id, recipient));
    createdProfileIds.push(sender, recipient);

    const { coldMessage } = await storage.sendColdMessage(sender, recipient, "blocked before reply");
    assert.ok(coldMessage, "sendColdMessage must return the new message");
    await storage.blockUser(sender, recipient);

    try {
      const server = await startRouteTestServer(recipientUserId);
      try {
        const response = await getColdMessageOverHttp(server, coldMessage.id);
        assert.equal(response.statusCode, 403);
        assert.equal(response.body.reason, "sender_blocked");
      } finally {
        await closeRouteTestServer(server);
      }
    } finally {
      await storage.unblockUser(sender, recipient);
    }
  });
});
