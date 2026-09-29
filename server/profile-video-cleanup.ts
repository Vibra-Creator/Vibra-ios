import type { ProfileVideo } from "@shared/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROFILE_VIDEO_INACTIVITY_DAYS = 30;

export function getProfileVideoCleanupCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PROFILE_VIDEO_INACTIVITY_DAYS * DAY_MS);
}

export interface InactiveProfileVideoCleanupResult {
  deletedCount: number;
  skippedMissingUrlCount: number;
}

export async function removeInactiveProfileVideos(
  videos: readonly ProfileVideo[],
  deleteObject: (videoUrl: string) => Promise<unknown>,
  deleteProfileVideo: (id: string) => Promise<void>,
): Promise<InactiveProfileVideoCleanupResult> {
  const result: InactiveProfileVideoCleanupResult = {
    deletedCount: 0,
    skippedMissingUrlCount: 0,
  };

  for (const video of videos) {
    if (typeof video.videoUrl !== "string" || video.videoUrl.trim().length === 0) {
      // Without a path, the storage object cannot be identified safely. Keep
      // the database row as the only remaining reference for investigation.
      result.skippedMissingUrlCount += 1;
      continue;
    }

    try {
      await deleteObject(video.videoUrl);
    } catch {
      // Preserve the cleanup's existing behavior: remove the database record
      // even if its object is already missing from storage.
    }
    await deleteProfileVideo(video.id);
    result.deletedCount += 1;
  }

  return result;
}