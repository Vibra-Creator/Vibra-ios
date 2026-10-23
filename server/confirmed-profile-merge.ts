import { sql } from "drizzle-orm";
import { db } from "./db";
import { objectStorageClient, ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const MARKER_PREFIX = "confirmed-profile-merge:";
const userAliases = new Map<string, string>();
const profileAliases = new Map<string, string>();

export function resolveMergedUserId(id: string): string {
  return userAliases.get(id) ?? id;
}

export function resolveMergedProfileId(id: string): string {
  return profileAliases.get(id) ?? id;
}

export function mergedLoginIdentityIds(canonicalUserId: string): string[] {
  return [canonicalUserId, ...[...userAliases].filter(([, target]) => target === canonicalUserId).map(([source]) => source)];
}

// Keep the credential identity separate from the shared application identity.
// Each linked login retains its own password/reset flow.
export function setSessionIdentity(req: any, id: string): void {
  req.session.loginIdentityId = id;
  req.session.userId = resolveMergedUserId(id);
}

export function normalizeMergedReferences(record: Record<string, any> | undefined): void {
  if (!record || typeof record !== "object") return;
  for (const key of Object.keys(record)) {
    if (!/id$/i.test(key) || typeof record[key] !== "string") continue;
    record[key] = key === "userId" ? resolveMergedUserId(record[key]) : resolveMergedProfileId(record[key]);
  }
}

type MergeOptions = {
  sourceId: string;
  targetId: string;
  expectedSourceAge: number;
  expectedTargetAge: number;
};

type SnapshotWriter = (snapshot: unknown) => Promise<string>;

const identifier = (value: string) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(value)) throw new Error("Unsafe database identifier");
  return sql.identifier(value);
};

/**
 * An explicitly confirmed pair only. No name/email similarity matching.
 * All reference changes, source archival and the alias marker commit together.
 * On a uniqueness conflict the entire transaction rolls back; no rows are discarded.
 */
export async function mergeConfirmedProfiles(options: MergeOptions, writeSnapshot: SnapshotWriter) {
  if (options.sourceId === options.targetId) throw new Error("Cannot merge a profile into itself");
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${MARKER_PREFIX + options.sourceId}))`);
    const markerKey = MARKER_PREFIX + options.sourceId;
    const marker = await tx.execute(sql`SELECT value FROM app_settings WHERE key = ${markerKey}`);
    if (marker.rows.length) return { status: "already-merged" as const };

    const pair = await tx.execute(sql`SELECT * FROM profiles WHERE id IN (${options.sourceId}, ${options.targetId}) ORDER BY id FOR UPDATE`);
    const source = pair.rows.find((row: any) => row.id === options.sourceId) as any;
    const target = pair.rows.find((row: any) => row.id === options.targetId) as any;
    if (!source || !target) throw new Error("Confirmed merge pair is missing; no data changed");
    if (source.age !== options.expectedSourceAge || target.age !== options.expectedTargetAge ||
        source.is_bot || target.is_bot || !source.user_id || !target.user_id ||
        source.moderation_hidden || target.moderation_hidden ||
        !target.image_url || /\/images\/(?:avatar|profile-)/i.test(target.image_url)) {
      throw new Error("Confirmed merge no longer matches the reviewed data; no data changed");
    }
    const accounts = await tx.execute(sql`SELECT is_admin FROM users WHERE id IN (${source.user_id}, ${target.user_id}) FOR UPDATE`);
    if (accounts.rows.length !== 2 || accounts.rows.some((row: any) => row.is_admin)) {
      throw new Error("Unexpected account ownership or privilege; no data changed");
    }

    // The legacy schema uses plain ID columns rather than foreign keys throughout.
    // Discover all actual reference columns, including modules added after this repair.
    const columnsResult = await tx.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
        AND column_name ~ '_id$' AND table_name NOT IN ('profiles', 'users', 'sessions')
      ORDER BY table_name, column_name
    `);
    const columns = columnsResult.rows as { table_name: string; column_name: string }[];
    const tables = [...new Set(columns.map(c => c.table_name))];
    // Block concurrent relationship writes while moving references.
    for (const table of tables) {
      await tx.execute(sql`LOCK TABLE ${identifier(table)} IN SHARE ROW EXCLUSIVE MODE`);
    }

    const referencedRows: Record<string, unknown[]> = {};
    for (const table of tables) {
      const conditions = columns.filter(c => c.table_name === table).map(c =>
        sql`${identifier(c.column_name)} IN (${source.id}, ${source.user_id})`,
      );
      const rows = await tx.execute(sql`SELECT * FROM ${identifier(table)} WHERE ${sql.join(conditions, sql` OR `)}`);
      if (rows.rows.length) referencedRows[table] = rows.rows;
    }
    const backupPath = await writeSnapshot({
      createdAt: new Date().toISOString(), sourceProfile: source, targetProfile: target,
      references: referencedRows,
    });

    for (const column of columns) {
      await tx.execute(sql`
        UPDATE ${identifier(column.table_name)}
        SET ${identifier(column.column_name)} = CASE
          WHEN ${identifier(column.column_name)} = ${source.id} THEN ${target.id}
          ELSE ${target.user_id} END
        WHERE ${identifier(column.column_name)} IN (${source.id}, ${source.user_id})
      `);
    }

    // Keep the complete profile authoritative; retain non-empty information from
    // the incomplete record instead of dropping it.
    const updates = Object.entries(source)
      .filter(([key, value]) => !["id", "user_id", "age", "image_url", "photos", "points", "name", "is_bot", "moderation_hidden"].includes(key)
        && value !== null && value !== "" && (target[key] === null || target[key] === ""))
      .map(([key, value]) => sql`${identifier(key)} = ${value}`);
    const photos = [...new Set<string>([target.image_url, ...(target.photos ?? []), ...(source.photos ?? [])])]
      .filter(url => url && !/\/images\/(?:avatar|profile-)/i.test(url));
    updates.push(sql`name = ${source.name}`, sql`points = ${(target.points ?? 0) + (source.points ?? 0)}`,
      sql`photos = ${sql`ARRAY[${sql.join(photos.map(url => sql`${url}`), sql`, `)}]::text[]`}`);
    await tx.execute(sql`UPDATE profiles SET ${sql.join(updates, sql`, `)} WHERE id = ${target.id}`);
    const markerValue = JSON.stringify({
      sourceProfileId: source.id, targetProfileId: target.id,
      sourceUserId: source.user_id, targetUserId: target.user_id,
      backupPath, completedAt: new Date().toISOString(),
    });
    await tx.execute(sql`INSERT INTO app_settings (id, key, value) VALUES (gen_random_uuid(), ${markerKey}, ${markerValue})`);
    // Retain the original row as a hidden, reversible archive. This also keeps
    // an older server during a rolling publish from recreating the source profile.
    await tx.execute(sql`UPDATE profiles SET moderation_hidden = true WHERE id = ${source.id}`);
    return { status: "merged" as const };
  });
}

export async function loadConfirmedProfileAliases() {
  const result = await db.execute(sql`SELECT value FROM app_settings WHERE key LIKE ${MARKER_PREFIX + "%"}`);
  userAliases.clear();
  profileAliases.clear();
  for (const row of result.rows) {
    const mapping = JSON.parse(String(row.value));
    if (!mapping.sourceUserId || !mapping.targetUserId || !mapping.sourceProfileId || !mapping.targetProfileId) {
      throw new Error("Invalid confirmed profile merge marker");
    }
    userAliases.set(mapping.sourceUserId, mapping.targetUserId);
    profileAliases.set(mapping.sourceProfileId, mapping.targetProfileId);
  }
}

export async function initializeConfirmedProfileRepair() {
  if (process.env.NODE_ENV === "production") {
    // The user explicitly confirmed this pair and its authoritative age/photo.
    // This is a data repair, not a schema migration, and only runs after publish.
    const pair = {
      sourceId: "e5013a7f-9fe1-4480-8511-2e1d2fb2799a",
      targetId: "afc30e4d-e8d1-4718-a654-cbf32001ed25",
      expectedSourceAge: 25,
      expectedTargetAge: 67,
    };
    try {
      const result = await mergeConfirmedProfiles(pair, async snapshot => {
        const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
        if (!bucket) throw new Error("Private merge backup storage is unavailable");
        const photo = (snapshot as any).targetProfile.image_url;
        if (photo.startsWith("/objects/")) {
          await new ObjectStorageService().getObjectEntityFile(photo);
        } else {
          throw new Error("The reviewed photo is no longer an object-storage photo");
        }
        const path = `.private/profile-merges/${pair.sourceId}-${Date.now()}.json`;
        await objectStorageClient.bucket(bucket).file(path).save(JSON.stringify(snapshot), {
          contentType: "application/json", resumable: false,
        });
        return path;
      });
      console.log(`[profile-repair] ${result.status}`);
    } catch (error) {
      console.error("[profile-repair] Merge rolled back; profiles unchanged:", error);
    }
  }
  await loadConfirmedProfileAliases();
}
