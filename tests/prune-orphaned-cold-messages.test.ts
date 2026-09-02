/**
 * Integration test for DatabaseStorage.pruneOrphanedColdMessages()
 *
 * Run with: npx tsx tests/prune-orphaned-cold-messages.test.ts
 *
 * The test verifies that old messages addressed to deleted profiles are
 * removed, while old messages addressed to an existing profile are retained.
 */

import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { coldMessages, profiles } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const TTL_DAYS = 90;
const createdProfileIds: string[] = [];
const createdMessageIds: string[] = [];

async function insertProfile(): Promise<string> {
  const id = randomUUID();
  await db.insert(profiles).values({
    id,
    name: `Profile-${id.slice(0, 6)}`,
    age: 25,
    imageUrl: "/images/avatar-placeholder.png",
    alienType: "Cosmico",
  });
  createdProfileIds.push(id);
  return id;
}

async function insertBackdatedColdMessage(toProfileId: string, daysAgo: number): Promise<string> {
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO cold_messages (id, from_profile_id, to_profile_id, content, created_at)
    VALUES (
      ${id},
      ${randomUUID()},
      ${toProfileId},
      'test',
      NOW() - make_interval(days => ${daysAgo})
    )
  `);
  createdMessageIds.push(id);
  return id;
}

async function cleanup() {
  if (createdMessageIds.length) {
    await db.delete(coldMessages).where(inArray(coldMessages.id, createdMessageIds));
  }
  if (createdProfileIds.length) {
    await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
  }
}

async function main() {
  try {
    // An old message whose recipient profile was deleted is eligible for cleanup.
    const orphanedMessageId = await insertBackdatedColdMessage(randomUUID(), TTL_DAYS + 1);
    const deletedCount = await storage.pruneOrphanedColdMessages(TTL_DAYS);
    const [deletedMessage] = await db
      .select()
      .from(coldMessages)
      .where(eq(coldMessages.id, orphanedMessageId));

    assert.equal(deletedMessage, undefined, "old message to a deleted profile should be pruned");
    assert.ok(deletedCount >= 1, "pruner should report deleting the orphaned message");

    // A recipient that still exists must protect its message from cleanup.
    const existingProfileId = await insertProfile();
    const retainedMessageId = await insertBackdatedColdMessage(existingProfileId, TTL_DAYS + 1);
    await storage.pruneOrphanedColdMessages(TTL_DAYS);
    const [retainedMessage] = await db
      .select()
      .from(coldMessages)
      .where(eq(coldMessages.id, retainedMessageId));

    assert.ok(retainedMessage, "message to an existing profile must not be pruned");
    console.log("✓ orphaned cold messages are pruned and messages to existing profiles are retained");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exitCode = 1;
});