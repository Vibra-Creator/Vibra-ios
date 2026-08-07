import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Removes the legacy simulated accounts and their app data.
 * This is intentionally scoped by profiles.is_bot so real users are never touched.
 */
export async function removeBotProfiles(): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        CREATE TEMP TABLE bot_cleanup_ids ON COMMIT DROP AS
        SELECT id AS profile_id, user_id
        FROM profiles
        WHERE is_bot = true
      `);

      const countResult = await tx.execute(sql`
        SELECT COUNT(*)::int AS total FROM bot_cleanup_ids
      `);
      const count = Number(((countResult as any).rows ?? countResult)[0]?.total ?? 0);
      if (count === 0) return;

      // Delete messages belonging to matches that involve a bot first.
      await tx.execute(sql`
        DELETE FROM messages
        WHERE match_id IN (
          SELECT id FROM matches
          WHERE profile1_id IN (SELECT profile_id FROM bot_cleanup_ids)
             OR profile2_id IN (SELECT profile_id FROM bot_cleanup_ids)
        )
      `);

      // Remove direct profile references from user-generated tables.
      const profileColumns = [
        "profile_id", "sender_id", "receiver_id", "reporter_id", "reported_id",
        "blocker_id", "blocked_id", "rater_id", "rated_id", "requester_id",
        "owner_id", "real_profile_id", "bot_profile_id", "viewer_id", "viewed_id",
        "swiper_id", "swiped_id",
      ];
      const columnResult = await tx.execute(sql`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name NOT IN ('profiles', 'users', 'messages', 'matches')
      `);
      const columns = ((columnResult as any).rows ?? columnResult) as Array<{
        table_name: string;
        column_name: string;
      }>;
      const grouped = new Map<string, string[]>();

      for (const column of columns) {
        if (!profileColumns.includes(column.column_name)) continue;
        const list = grouped.get(column.table_name) ?? [];
        list.push(column.column_name);
        grouped.set(column.table_name, list);
      }

      const deleteStatements: string[] = [];
      grouped.forEach((tableColumns, table) => {
        const safeTable = `"${table.replaceAll('"', '""')}"`;
        const conditions = tableColumns.map((column: string) => {
          const safeColumn = `"${column.replaceAll('"', '""')}"`;
          return `${safeColumn} IN (SELECT profile_id FROM bot_cleanup_ids)`;
        }).join(" OR ");
        // The callback is collected below so all deletes remain on the same tx.
        deleteStatements.push(`DELETE FROM ${safeTable} WHERE ${conditions}`);
      });
      for (const statement of deleteStatements) {
        await tx.execute(sql.raw(statement));
      }

      await tx.execute(sql`
        DELETE FROM matches
        WHERE profile1_id IN (SELECT profile_id FROM bot_cleanup_ids)
           OR profile2_id IN (SELECT profile_id FROM bot_cleanup_ids)
      `);
      await tx.execute(sql`
        DELETE FROM profiles
        WHERE id IN (SELECT profile_id FROM bot_cleanup_ids)
      `);
      await tx.execute(sql`
        DELETE FROM users
        WHERE id IN (
          SELECT user_id FROM bot_cleanup_ids WHERE user_id IS NOT NULL
        )
      `);

      console.log(`[bot-cleanup] Removed ${count} simulated profiles`);
    });
  } catch (error) {
    console.error("[bot-cleanup] Cleanup failed:", error);
  }
}