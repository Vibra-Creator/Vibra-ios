import { db } from "./db";
import { sql } from "drizzle-orm";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

const BACKUP_DIR = ".private/backups";
const MAX_BACKUPS = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const TABLES_TO_BACKUP = [
  "profiles",
  "swipes",
  "matches",
  "messages",
  "rooms",
  "room_members",
  "room_messages",
  "private_rooms",
  "private_room_requests",
  "private_room_messages",
  "daily_challenges",
  "challenge_submissions",
  "virtual_gifts",
  "sent_gifts",
  "reports",
  "user_suspensions",
  "banned_words",
  "profile_ratings",
  "vibing_sessions",
  "blocked_users",
  "location_shares",
  "referrals",
];

function getBucketName(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return bucketId;
}

async function exportTableData(tableName: string): Promise<any[]> {
  try {
    const result = await db.execute(sql.raw(`SELECT * FROM "${tableName}"`));
    return Array.isArray(result) ? result : (result as any).rows || [];
  } catch (error: any) {
    if (error.code === "42P01") return [];
    console.error(`[backup] Error exporting table ${tableName}:`, error.message);
    return [];
  }
}

async function listBackups(): Promise<string[]> {
  try {
    const bucket = objectStorageClient.bucket(getBucketName());
    const [files] = await bucket.getFiles({ prefix: `${BACKUP_DIR}/` });
    return files
      .map((f) => f.name)
      .filter((n) => n.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

async function deleteOldBackups(): Promise<void> {
  const backups = await listBackups();
  if (backups.length <= MAX_BACKUPS) return;

  const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
  const bucket = objectStorageClient.bucket(getBucketName());
  for (const fileName of toDelete) {
    try {
      await bucket.file(fileName).delete();
      console.log(`[backup] Deleted old backup: ${fileName}`);
    } catch (error: any) {
      console.error(`[backup] Failed to delete ${fileName}:`, error.message);
    }
  }
}

export async function createBackup(): Promise<{ success: boolean; fileName?: string; size?: number; tables?: number; error?: string }> {
  const startTime = Date.now();
  console.log("[backup] Starting database backup...");

  try {
    const backupData: Record<string, any> = {
      metadata: {
        createdAt: new Date().toISOString(),
        version: "1.0",
        tables: TABLES_TO_BACKUP,
      },
      data: {} as Record<string, any[]>,
    };

    let totalRows = 0;
    for (const table of TABLES_TO_BACKUP) {
      const rows = await exportTableData(table);
      backupData.data[table] = rows;
      totalRows += rows.length;
    }

    backupData.metadata.totalRows = totalRows;

    const jsonContent = JSON.stringify(backupData);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${BACKUP_DIR}/vibra-backup-${timestamp}.json`;

    const bucket = objectStorageClient.bucket(getBucketName());
    const file = bucket.file(fileName);
    await file.save(jsonContent, { contentType: "application/json" });

    await deleteOldBackups();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMB = (Buffer.byteLength(jsonContent) / 1024 / 1024).toFixed(2);
    console.log(`[backup] Backup completed: ${fileName} (${sizeMB} MB, ${totalRows} rows, ${duration}s)`);

    return { success: true, fileName, size: Buffer.byteLength(jsonContent), tables: TABLES_TO_BACKUP.length };
  } catch (error: any) {
    console.error("[backup] Backup failed:", error.message);
    return { success: false, error: error.message };
  }
}

export async function getBackupList(): Promise<Array<{ name: string; date: string; size?: number }>> {
  try {
    const bucket = objectStorageClient.bucket(getBucketName());
    const [files] = await bucket.getFiles({ prefix: `${BACKUP_DIR}/` });
    const backups = [];
    for (const f of files) {
      if (!f.name.endsWith(".json")) continue;
      const [metadata] = await f.getMetadata();
      const dateMatch = f.name.match(/vibra-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
      let dateStr = "unknown";
      if (dateMatch) {
        dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:${dateMatch[6]}Z`;
      }
      backups.push({
        name: f.name,
        date: dateStr,
        size: parseInt(metadata.size as string) || 0,
      });
    }
    return backups.sort((a, b) => b.name.localeCompare(a.name));
  } catch {
    return [];
  }
}

let backupInterval: NodeJS.Timeout | null = null;
let backupStarted = false;

export function startAutoBackup(): void {
  if (backupStarted) return;
  backupStarted = true;
  console.log("[backup] Auto-backup scheduled every 24 hours");

  setTimeout(() => {
    createBackup().catch((err) => console.error("[backup] Auto-backup error:", err));
  }, 60 * 1000);

  backupInterval = setInterval(() => {
    createBackup().catch((err) => console.error("[backup] Auto-backup error:", err));
  }, BACKUP_INTERVAL_MS);
}

export function stopAutoBackup(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    backupStarted = false;
  }
}
