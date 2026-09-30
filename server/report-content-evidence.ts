import { eq } from "drizzle-orm";
import { cosmicSignals, profileVideos, profiles, signalComments } from "@shared/schema";
import { db } from "./db";
import {
  isCosmicSignalAuthoredByReportedUser,
  isCosmicSignalVisibleToReporter,
  isProfilePhotoOwnedByReportedProfile,
  isProfileVideoAuthoredByReportedUser,
  isSignalCommentAuthoredByReportedUser,
} from "./report-moderation";

export type DetailedReportContentType =
  | "profile_photo"
  | "profile_video"
  | "profile_main_video"
  | "cosmic_signal"
  | "signal_comment";

export async function captureDetailedReportContentSnapshot(input: {
  reporterId: string;
  reportedId: string;
  contentType: DetailedReportContentType;
  contentId: string;
}): Promise<string | null> {
  const { reporterId, reportedId, contentType, contentId } = input;

  if (contentType === "profile_photo") {
    const [profile] = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        imageUrl: profiles.imageUrl,
        photos: profiles.photos,
      })
      .from(profiles)
      .where(eq(profiles.id, reportedId))
      .limit(1);
    if (!profile || !isProfilePhotoOwnedByReportedProfile({ reportedId }, profile, contentId)) {
      return null;
    }
    return JSON.stringify({
      profileId: profile.id,
      profileName: profile.name,
      photoUrl: contentId,
      isPrimaryPhoto: profile.imageUrl === contentId,
    });
  }

  if (contentType === "profile_video") {
    const [video] = await db
      .select({
        id: profileVideos.id,
        profileId: profileVideos.profileId,
        videoUrl: profileVideos.videoUrl,
        caption: profileVideos.caption,
        createdAt: profileVideos.createdAt,
      })
      .from(profileVideos)
      .where(eq(profileVideos.id, contentId))
      .limit(1);
    if (!video || !isProfileVideoAuthoredByReportedUser({ reportedId }, video)) return null;
    return JSON.stringify(video);
  }

  if (contentType === "profile_main_video") {
    const [profile] = await db
      .select({
        id: profiles.id,
        name: profiles.name,
        profileVideoUrl: profiles.profileVideoUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, reportedId))
      .limit(1);
    if (!profile || profile.id !== contentId || !profile.profileVideoUrl) return null;
    return JSON.stringify({
      profileId: profile.id,
      profileName: profile.name,
      videoUrl: profile.profileVideoUrl,
    });
  }

  if (contentType === "cosmic_signal") {
    const [signal] = await db
      .select({
        id: cosmicSignals.id,
        profileId: cosmicSignals.profileId,
        toProfileId: cosmicSignals.toProfileId,
        content: cosmicSignals.content,
        mediaUrl: cosmicSignals.mediaUrl,
        mediaType: cosmicSignals.mediaType,
        createdAt: cosmicSignals.createdAt,
      })
      .from(cosmicSignals)
      .where(eq(cosmicSignals.id, contentId))
      .limit(1);
    if (
      !signal ||
      !isCosmicSignalAuthoredByReportedUser({ reportedId }, signal) ||
      !isCosmicSignalVisibleToReporter(reporterId, signal)
    ) {
      return null;
    }
    return JSON.stringify(signal);
  }

  const [comment] = await db
    .select({
      id: signalComments.id,
      signalId: signalComments.signalId,
      profileId: signalComments.profileId,
      content: signalComments.content,
      createdAt: signalComments.createdAt,
    })
    .from(signalComments)
    .where(eq(signalComments.id, contentId))
    .limit(1);
  if (!comment || !isSignalCommentAuthoredByReportedUser({ reportedId }, comment)) return null;

  const [parentSignal] = await db
    .select({
      id: cosmicSignals.id,
      toProfileId: cosmicSignals.toProfileId,
      content: cosmicSignals.content,
    })
    .from(cosmicSignals)
    .where(eq(cosmicSignals.id, comment.signalId))
    .limit(1);
  if (!parentSignal || !isCosmicSignalVisibleToReporter(reporterId, parentSignal)) return null;

  return JSON.stringify({
    ...comment,
    parentSignalContent: parentSignal.content,
  });
}