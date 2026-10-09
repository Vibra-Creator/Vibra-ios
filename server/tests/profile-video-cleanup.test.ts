import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { inArray } from "drizzle-orm";
import { db } from "../db.js";
import {
  getProfileVideoCleanupCutoff,
  removeInactiveProfileVideos,
} from "../profile-video-cleanup.js";
import { DatabaseStorage } from "../storage.js";
import { profileVideos, profiles } from "../../shared/schema.js";

const RUN_DATABASE_INTEGRATION =
  process.env.RUN_PROFILE_VIDEO_CLEANUP_DB_TESTS === "true";
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" ||
  process.env.REPLIT_DEPLOYMENT === "1" ||
  process.env.REPLIT_DEPLOYMENT === "true";

if (
  RUN_DATABASE_INTEGRATION &&
  (IS_PRODUCTION || process.env.NODE_ENV !== "development")
) {
  throw new Error(
    "Refusing profile-video cleanup database tests outside a development environment",
  );
}

const storage = new DatabaseStorage();
const MINUTE_MS = 60 * 1000;

test("profile video cleanup cutoff is 30 days", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  assert.equal(
    getProfileVideoCleanupCutoff(now).getTime(),
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  );
});

test("missing video URLs are preserved while other inactive videos are cleaned", async () => {
  const video = (
    id: string,
    videoUrl: unknown,
  ): Parameters<typeof removeInactiveProfileVideos>[0][number] =>
    ({ id, videoUrl }) as Parameters<typeof removeInactiveProfileVideos>[0][number];
  const deletedObjectUrls: string[] = [];
  const deletedVideoIds: string[] = [];

  const result = await removeInactiveProfileVideos(
    [
      video("missing-url", undefined),
      video("blank-url", "  "),
      video("valid-url", "/objects/profile-videos/valid.mp4"),
    ],
    async (videoUrl) => {
      deletedObjectUrls.push(videoUrl);
    },
    async (videoId) => {
      deletedVideoIds.push(videoId);
    },
  );

  assert.deepEqual(result, { deletedCount: 1, skippedMissingUrlCount: 2 });
  assert.deepEqual(deletedObjectUrls, ["/objects/profile-videos/valid.mp4"]);
  assert.deepEqual(deletedVideoIds, ["valid-url"]);
});

test(
  "cleanup selects and removes only videos belonging to inactive profiles",
  { skip: !RUN_DATABASE_INTEGRATION },
  async () => {
    const runId = randomUUID();
    const inactiveProfileId = randomUUID();
    const activeProfileId = randomUUID();
    const noActivityProfileId = randomUUID();
    const inactiveVideoId = randomUUID();
    const activeVideoId = randomUUID();
    const noActivityVideoId = randomUUID();
    const inactiveVideoUrl = `test://profile-video-cleanup/${runId}/inactive.mp4`;
    const activeVideoUrl = `test://profile-video-cleanup/${runId}/active.mp4`;
    const noActivityVideoUrl = `test://profile-video-cleanup/${runId}/no-activity.mp4`;

    const cutoff = new Date(Date.now() - 10 * MINUTE_MS);
    const inactiveLastActiveAt = new Date(cutoff.getTime() - MINUTE_MS);
    const activeLastActiveAt = new Date(cutoff.getTime() + MINUTE_MS);

    try {
      await db.insert(profiles).values([
        {
          id: inactiveProfileId,
          name: `__video_cleanup_${runId}_inactive`,
          age: 25,
          bio: "",
          imageUrl: "/images/test.png",
          location: "",
          interests: [],
          alienType: "test",
          isBot: false,
          lastActiveAt: inactiveLastActiveAt,
        },
        {
          id: activeProfileId,
          name: `__video_cleanup_${runId}_active`,
          age: 25,
          bio: "",
          imageUrl: "/images/test.png",
          location: "",
          interests: [],
          alienType: "test",
          isBot: false,
          lastActiveAt: activeLastActiveAt,
        },
        {
          id: noActivityProfileId,
          name: `__video_cleanup_${runId}_no_activity`,
          age: 25,
          bio: "",
          imageUrl: "/images/test.png",
          location: "",
          interests: [],
          alienType: "test",
          isBot: false,
          lastActiveAt: null,
        },
      ]);

      const [inactiveVideo, activeVideo, noActivityVideo] = await db
        .insert(profileVideos)
        .values([
          {
            id: inactiveVideoId,
            profileId: inactiveProfileId,
            videoUrl: inactiveVideoUrl,
          },
          {
            id: activeVideoId,
            profileId: activeProfileId,
            videoUrl: activeVideoUrl,
          },
          {
            id: noActivityVideoId,
            profileId: noActivityProfileId,
            videoUrl: noActivityVideoUrl,
          },
        ])
        .returning();
      assert.ok(inactiveVideo);
      assert.ok(activeVideo);
      assert.ok(noActivityVideo);

      const candidates = await storage.getVideosForInactiveProfiles(cutoff);
      assert.deepEqual(candidates, [inactiveVideo]);

      const deletedObjectUrls: string[] = [];
      await removeInactiveProfileVideos(
        candidates,
        async (videoUrl) => {
          deletedObjectUrls.push(videoUrl);
        },
        (videoId) => storage.deleteProfileVideo(videoId),
      );

      assert.deepEqual(deletedObjectUrls, [inactiveVideoUrl]);
      assert.equal(deletedObjectUrls.includes(noActivityVideoUrl), false);
      const remainingVideos = await db
        .select()
        .from(profileVideos)
        .where(inArray(profileVideos.id, [
          inactiveVideoId,
          activeVideoId,
          noActivityVideoId,
        ]));
      assert.deepEqual(
        remainingVideos.map((video) => video.id).sort(),
        [activeVideoId, noActivityVideoId].sort(),
      );
    } finally {
      await db
        .delete(profileVideos)
        .where(inArray(profileVideos.id, [
          inactiveVideoId,
          activeVideoId,
          noActivityVideoId,
        ]));
      await db
        .delete(profiles)
        .where(inArray(profiles.id, [
          inactiveProfileId,
          activeProfileId,
          noActivityProfileId,
        ]));
    }
  },
);