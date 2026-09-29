import type { ProfileVideo } from "@shared/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
export const PROFILE_VIDEO_INACTIVITY_DAYS = 30;

export function getProfileVideoCleanupCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - PROFILE_VIDEO_INACTIVITY_DAYS * DAY_MS);
}

export async function removeInactiveProfileVideos(
  videos: readonly ProfileVideo[],
  deleteObject: (videoUrl: string) => Promise<unknown>,
  deleteProfileVideo: (id: string) => Promise<void>,
): Promise<void> {
  for (const video of videos) {
    try {
      await deleteObject(video.videoUrl);
    } catch {
      // Preserve the cleanup's existing behavior: remove the database record
      // even if its object is already missing from storage.
    }
    await deleteProfileVideo(video.id);
  }
}