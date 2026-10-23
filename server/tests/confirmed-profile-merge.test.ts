import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  mergeConfirmedProfiles, loadConfirmedProfileAliases,
  resolveMergedUserId, resolveMergedProfileId, setSessionIdentity,
  normalizeMergedReferences, mergedLoginIdentityIds,
} from "../confirmed-profile-merge";

test("confirmed merge preserves references, both logins, real age/photo, old links and is idempotent", async () => {
  const source = randomUUID(), target = randomUUID(), sourceUser = randomUUID(), targetUser = randomUUID();
  const swipe = randomUUID();
  const options = { sourceId: source, targetId: target, expectedSourceAge: 25, expectedTargetAge: 67 };
  try {
    await db.execute(sql`INSERT INTO users (id, first_name, is_admin) VALUES (${sourceUser}, 'Merge source fixture', false), (${targetUser}, 'Merge target fixture', false)`);
    await db.execute(sql`INSERT INTO profiles (id,user_id,name,age,bio,image_url,location,interests,alien_type,is_bot,moderation_hidden)
      VALUES (${source},${sourceUser},'Merge fixture full name',25,'','/images/avatar-1.png','',ARRAY[]::text[],'Test',false,false),
      (${target},${targetUser},'Merge fixture',67,'Preserve me','/objects/uploads/fixture','',ARRAY['music'],'Test',false,false)`);
    await db.execute(sql`INSERT INTO swipes (id, swiper_id, swiped_id, liked) VALUES (${swipe}, ${target}, ${source}, true)`);
    let snapshot: any;
    const result = await mergeConfirmedProfiles(options, async data => { snapshot = data; return ".private/test-fixture"; });
    assert.equal(result.status, "merged");
    assert.equal(snapshot.sourceProfile.age, 25);
    assert.equal(snapshot.targetProfile.age, 67);
    assert.equal(snapshot.references.swipes.length, 1);
    const rows = await db.execute(sql`SELECT name, age, image_url, bio FROM profiles WHERE id IN (${source},${target}) AND moderation_hidden = false`);
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].age, 67);
    assert.equal(rows.rows[0].image_url, "/objects/uploads/fixture");
    assert.equal(rows.rows[0].bio, "Preserve me");
    const moved = await db.execute(sql`SELECT swiped_id FROM swipes WHERE id=${swipe}`);
    assert.equal(moved.rows[0].swiped_id, target);
    const accounts = await db.execute(sql`SELECT id FROM users WHERE id IN (${sourceUser},${targetUser})`);
    assert.equal(accounts.rows.length, 2);
    await loadConfirmedProfileAliases();
    assert.equal(resolveMergedUserId(sourceUser), targetUser);
    assert.equal(resolveMergedProfileId(source), target);
    const req: any = { session: {} };
    setSessionIdentity(req, sourceUser);
    assert.equal(req.session.userId, targetUser);
    assert.equal(req.session.loginIdentityId, sourceUser);
    assert.deepEqual(mergedLoginIdentityIds(targetUser), [targetUser, sourceUser]);
    const body = { toProfileId: source, userId: sourceUser, content: source };
    normalizeMergedReferences(body);
    assert.deepEqual(body, { toProfileId: target, userId: targetUser, content: source });
    assert.equal((await mergeConfirmedProfiles(options, async () => { throw new Error("Must not re-run"); })).status, "already-merged");
  } finally {
    await db.execute(sql`DELETE FROM swipes WHERE id=${swipe}`);
    await db.execute(sql`DELETE FROM app_settings WHERE key=${"confirmed-profile-merge:" + source}`);
    await db.execute(sql`DELETE FROM profiles WHERE id IN (${source},${target})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${sourceUser},${targetUser})`);
    await loadConfirmedProfileAliases();
  }
});

test("a failed private backup leaves both profiles untouched", async () => {
  const source = randomUUID(), target = randomUUID(), sourceUser = randomUUID(), targetUser = randomUUID();
  try {
    await db.execute(sql`INSERT INTO users (id,is_admin) VALUES (${sourceUser},false),(${targetUser},false)`);
    await db.execute(sql`INSERT INTO profiles (id,user_id,name,age,image_url,alien_type,is_bot,moderation_hidden)
      VALUES (${source},${sourceUser},'Rollback source',25,'/images/avatar-1.png','Test',false,false),
      (${target},${targetUser},'Rollback target',67,'/objects/uploads/fixture','Test',false,false)`);
    await assert.rejects(mergeConfirmedProfiles({sourceId:source,targetId:target,expectedSourceAge:25,expectedTargetAge:67}, async () => { throw new Error("Backup failed"); }), /Backup failed/);
    const pair = await db.execute(sql`SELECT id FROM profiles WHERE id IN (${source},${target})`);
    assert.equal(pair.rows.length, 2);
  } finally {
    await db.execute(sql`DELETE FROM profiles WHERE id IN (${source},${target})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${sourceUser},${targetUser})`);
  }
});

test("simultaneous profile creation for one account never creates or overwrites a second profile", async () => {
  const userId = randomUUID();
  try {
    const data = { userId, name: "Concurrent fixture", age: 67, imageUrl: "/objects/uploads/fixture", alienType: "Test", isBot: false };
    const [first, second] = await Promise.all([storage.createProfile(data), storage.createProfile(data)]);
    assert.equal(first.id, second.id);
    const again = await storage.createProfile({ ...data, age: 25, imageUrl: "/images/avatar-1.png" });
    assert.equal(again.age, 67);
    assert.equal(again.imageUrl, data.imageUrl);
    const rows = await db.execute(sql`SELECT id FROM profiles WHERE user_id=${userId}`);
    assert.equal(rows.rows.length, 1);
  } finally {
    await db.execute(sql`DELETE FROM profiles WHERE user_id=${userId}`);
  }
});
