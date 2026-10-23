// Development-only fixtures for the merged-account browser journey.
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { mergeConfirmedProfiles } from "../confirmed-profile-merge";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Test fixtures are forbidden in production");
  const path = "/tmp/vibra-profile-merge-browser-fixture.json";
  if (process.argv[2] === "clean") {
    const f = JSON.parse(await readFile(path, "utf8"));
    for (const profileId of [f.sourceId, f.targetId]) {
      await db.execute(sql`DELETE FROM user_activity_log WHERE profile_id=${profileId}`);
      await db.execute(sql`DELETE FROM vibing_sessions WHERE profile_id=${profileId}`);
      await db.execute(sql`DELETE FROM swipes WHERE swiper_id=${profileId} OR swiped_id=${profileId}`);
      await db.execute(sql`DELETE FROM profiles WHERE id=${profileId}`);
    }
    await db.execute(sql`DELETE FROM app_settings WHERE key=${"confirmed-profile-merge:" + f.sourceId}`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${f.sourceUser},${f.targetUser})`);
    console.log("Browser fixtures cleaned");
    return;
  }
  const suffix = randomUUID().slice(0, 8);
  const f = {
    sourceId: randomUUID(), targetId: randomUUID(), sourceUser: randomUUID(), targetUser: randomUUID(),
    sourceEmail: `merge-source-${suffix}@example.invalid`, targetEmail: `merge-target-${suffix}@example.invalid`,
    password: `Fixture-${randomUUID()}`, name: `MergeCheck ${suffix}`,
  };
  const hash = await bcrypt.hash(f.password, 10);
  await db.execute(sql`INSERT INTO users(id,email,password,first_name,email_verified,is_admin)
    VALUES (${f.sourceUser},${f.sourceEmail},${hash},'MergeCheck',true,false),
      (${f.targetUser},${f.targetEmail},${hash},'MergeCheck',true,false)`);
  await db.execute(sql`INSERT INTO profiles(id,user_id,name,age,image_url,photos,alien_type,is_bot,moderation_hidden,gender,interests)
    VALUES (${f.sourceId},${f.sourceUser},${f.name},25,'/images/avatar-1.png',ARRAY[]::text[],'Solare',false,false,'Uomo',ARRAY['Musica']),
      (${f.targetId},${f.targetUser},'MergeCheck',67,'/images/logo.jpg',ARRAY['/images/logo.jpg'],'Solare',false,false,'Uomo',ARRAY['Musica'])`);
  await mergeConfirmedProfiles({
    sourceId:f.sourceId,targetId:f.targetId,expectedSourceAge:25,expectedTargetAge:67,
  }, async () => ".private/development-browser-fixture");
  await writeFile(path, JSON.stringify(f));
  console.log(`Browser fixture manifest: ${path}`);
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
