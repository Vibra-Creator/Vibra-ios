import { and, eq, sql } from "drizzle-orm";
import {
  cosmicSignals,
  challengeSubmissions,
  events,
  hubPosts,
  profileVideos,
  profiles,
  reports,
  signalComments,
  signalLikes,
  storyBriciole,
  storyVotes,
  userSuspensions,
  type Report,
} from "@shared/schema";
import { db } from "./db";
import {
  getReportSuspensionExpiry,
  isCosmicSignalAuthoredByReportedUser,
  isProfilePhotoOwnedByReportedProfile,
  isProfileVideoAuthoredByReportedUser,
  isSignalCommentAuthoredByReportedUser,
  type ReportContentType,
} from "./report-moderation";

type ReportModerationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ModerationError =
  | "not_found"
  | "not_pending"
  | "content_mismatch"
  | "content_evidence_unavailable";

export type DetailedReportModerationResult =
  | { ok: false; error: ModerationError }
  | {
      ok: true;
      targetProfileId: string;
      contentRemoved: boolean;
      contentHidden: false;
      authorSuspended: boolean;
      expiresAt: Date | null;
    };

const DETAILED_REPORT_TYPES = new Set<ReportContentType>([
  "profile_photo",
  "profile_video",
  "profile_main_video",
  "cosmic_signal",
  "signal_comment",
  "hub_post",
  "event",
  "story_briciola",
  "challenge_submission",
]);

export function isDetailedReportContentType(value: unknown): value is
  | "profile_photo"
  | "profile_video"
  | "profile_main_video"
  | "cosmic_signal"
  | "signal_comment"
  | "hub_post"
  | "event"
  | "story_briciola"
  | "challenge_submission" {
  return typeof value === "string" && DETAILED_REPORT_TYPES.has(value as ReportContentType);
}

export async function moderateDetailedReportInTransaction(
  tx: ReportModerationTransaction,
  report: Report,
  moderatorUserId: string,
  now: Date,
): Promise<DetailedReportModerationResult> {
  if (report.status !== "pending") return { ok: false, error: "not_pending" };
  const contentType = report.reportedContentType;
  const contentId = report.reportedContentId;
  if (!isDetailedReportContentType(contentType) || !contentId) {
    return { ok: false, error: "content_mismatch" };
  }

  const snapshotAvailable = Boolean(report.reportedContentSnapshot);
  let itemExists = false;
  let storyBriciolaId: string | undefined;

  if (contentType === "profile_photo") {
    const [profile] = await tx
      .select({
        id: profiles.id,
        userId: profiles.userId,
        imageUrl: profiles.imageUrl,
        photos: profiles.photos,
      })
      .from(profiles)
      .where(eq(profiles.id, report.reportedId))
      .limit(1);
    if (profile && !isProfilePhotoOwnedByReportedProfile({ reportedId: report.reportedId }, profile, contentId)) {
      // If the exact reference is no longer present, it was removed after the
      // report was captured; do not substitute a different photo from this profile.
      itemExists = false;
    } else {
      itemExists = Boolean(profile);
    }
    if (!profile && !snapshotAvailable) return { ok: false, error: "content_evidence_unavailable" };
  } else if (contentType === "profile_video") {
    const [video] = await tx
      .select({
        id: profileVideos.id,
        profileId: profileVideos.profileId,
      })
      .from(profileVideos)
      .where(eq(profileVideos.id, contentId))
      .limit(1);
    if (video && !isProfileVideoAuthoredByReportedUser({ reportedId: report.reportedId }, video)) {
      return { ok: false, error: "content_mismatch" };
    }
    itemExists = Boolean(video);
  } else if (contentType === "profile_main_video") {
    const [profile] = await tx
      .select({ id: profiles.id, profileVideoUrl: profiles.profileVideoUrl })
      .from(profiles)
      .where(and(eq(profiles.id, report.reportedId), eq(profiles.id, contentId)))
      .limit(1);
    const snapshotVideoUrl = (() => {
      try {
        return JSON.parse(report.reportedContentSnapshot ?? "null")?.videoUrl as string | undefined;
      } catch {
        return undefined;
      }
    })();
    itemExists = Boolean(profile?.profileVideoUrl && profile.profileVideoUrl === snapshotVideoUrl);
  } else if (contentType === "cosmic_signal") {
    const [signal] = await tx
      .select({
        id: cosmicSignals.id,
        profileId: cosmicSignals.profileId,
      })
      .from(cosmicSignals)
      .where(eq(cosmicSignals.id, contentId))
      .limit(1);
    if (signal && !isCosmicSignalAuthoredByReportedUser({ reportedId: report.reportedId }, signal)) {
      return { ok: false, error: "content_mismatch" };
    }
    itemExists = Boolean(signal);
  } else if (contentType === "signal_comment") {
    const [comment] = await tx
      .select({
        id: signalComments.id,
        profileId: signalComments.profileId,
      })
      .from(signalComments)
      .where(eq(signalComments.id, contentId))
      .limit(1);
    if (comment && !isSignalCommentAuthoredByReportedUser({ reportedId: report.reportedId }, comment)) {
      return { ok: false, error: "content_mismatch" };
    }
    itemExists = Boolean(comment);
  } else if (contentType === "hub_post") {
    const [post] = await tx.select({ id: hubPosts.id, profileId: hubPosts.profileId })
      .from(hubPosts).where(eq(hubPosts.id, contentId)).limit(1);
    if (post && post.profileId !== report.reportedId) return { ok: false, error: "content_mismatch" };
    itemExists = Boolean(post);
  } else if (contentType === "event") {
    const [event] = await tx.select({ id: events.id, profileId: events.profileId })
      .from(events).where(eq(events.id, contentId)).limit(1);
    if (event && event.profileId !== report.reportedId) return { ok: false, error: "content_mismatch" };
    itemExists = Boolean(event);
  } else if (contentType === "story_briciola") {
    const [briciola] = await tx.select({
      id: storyBriciole.id,
      profileId: storyBriciole.profileId,
    }).from(storyBriciole).where(eq(storyBriciole.id, contentId)).limit(1);
    if (briciola && briciola.profileId !== report.reportedId) return { ok: false, error: "content_mismatch" };
    itemExists = Boolean(briciola);
    storyBriciolaId = briciola?.id;
  } else {
    const [submission] = await tx.select({
      id: challengeSubmissions.id,
      profileId: challengeSubmissions.profileId,
    }).from(challengeSubmissions).where(eq(challengeSubmissions.id, contentId)).limit(1);
    if (submission && submission.profileId !== report.reportedId) return { ok: false, error: "content_mismatch" };
    itemExists = Boolean(submission);
  }

  if (!itemExists && !snapshotAvailable) {
    return { ok: false, error: "content_evidence_unavailable" };
  }

  const [claimedReport] = await tx
    .update(reports)
    .set({
      status: "resolved",
      resolvedAt: now,
      moderatedBy: moderatorUserId,
      moderatedAt: now,
    })
    .where(and(eq(reports.id, report.id), eq(reports.status, "pending")))
    .returning({ id: reports.id });
  if (!claimedReport) return { ok: false, error: "not_pending" };

  let contentRemoved = false;
  if (itemExists && contentType === "profile_photo") {
    const [updatedProfile] = await tx
      .update(profiles)
      .set({
        imageUrl: sql`CASE WHEN ${profiles.imageUrl} = ${contentId} THEN '/images/avatar-1.png' ELSE ${profiles.imageUrl} END`,
        photos: sql`array_remove(COALESCE(${profiles.photos}, ARRAY[]::text[]), ${contentId})`,
      })
      .where(and(
        eq(profiles.id, report.reportedId),
        sql`(${profiles.imageUrl} = ${contentId} OR ${contentId} = ANY(COALESCE(${profiles.photos}, ARRAY[]::text[])))`,
      ))
      .returning({ id: profiles.id });
    contentRemoved = Boolean(updatedProfile);
  } else if (itemExists && contentType === "profile_video") {
    const deleted = await tx
      .delete(profileVideos)
      .where(and(
        eq(profileVideos.id, contentId),
        eq(profileVideos.profileId, report.reportedId),
      ))
      .returning({ id: profileVideos.id });
    contentRemoved = deleted.length > 0;
  } else if (itemExists && contentType === "profile_main_video") {
    const snapshotVideoUrl = (() => {
      try {
        return JSON.parse(report.reportedContentSnapshot ?? "null")?.videoUrl as string | undefined;
      } catch {
        return undefined;
      }
    })();
    if (snapshotVideoUrl) {
      const updated = await tx
        .update(profiles)
        .set({ profileVideoUrl: null })
        .where(and(
          eq(profiles.id, report.reportedId),
          eq(profiles.id, contentId),
          eq(profiles.profileVideoUrl, snapshotVideoUrl),
        ))
        .returning({ id: profiles.id });
      contentRemoved = updated.length > 0;
    }
  } else if (itemExists && contentType === "cosmic_signal") {
    const [signal] = await tx
      .select({ id: cosmicSignals.id, profileId: cosmicSignals.profileId })
      .from(cosmicSignals)
      .where(and(
        eq(cosmicSignals.id, contentId),
        eq(cosmicSignals.profileId, report.reportedId),
      ))
      .limit(1);
    if (signal) {
      await tx.delete(signalComments).where(eq(signalComments.signalId, contentId));
      await tx.delete(signalLikes).where(eq(signalLikes.signalId, contentId));
      const deleted = await tx
        .delete(cosmicSignals)
        .where(and(eq(cosmicSignals.id, contentId), eq(cosmicSignals.profileId, report.reportedId)))
        .returning({ id: cosmicSignals.id });
      contentRemoved = deleted.length > 0;
    }
  } else if (itemExists && contentType === "signal_comment") {
    const deleted = await tx
      .delete(signalComments)
      .where(and(
        eq(signalComments.id, contentId),
        eq(signalComments.profileId, report.reportedId),
      ))
      .returning({ id: signalComments.id });
    contentRemoved = deleted.length > 0;
  } else if (itemExists && contentType === "hub_post") {
    const deleted = await tx.delete(hubPosts).where(and(
      eq(hubPosts.id, contentId),
      eq(hubPosts.profileId, report.reportedId),
    )).returning({ id: hubPosts.id });
    contentRemoved = deleted.length > 0;
  } else if (itemExists && contentType === "event") {
    const deleted = await tx.delete(events).where(and(
      eq(events.id, contentId),
      eq(events.profileId, report.reportedId),
    )).returning({ id: events.id });
    contentRemoved = deleted.length > 0;
  } else if (itemExists && contentType === "story_briciola" && storyBriciolaId) {
    await tx.delete(storyVotes).where(eq(storyVotes.briolaId, storyBriciolaId));
    const deleted = await tx.delete(storyBriciole).where(and(
      eq(storyBriciole.id, contentId),
      eq(storyBriciole.profileId, report.reportedId),
    )).returning({ id: storyBriciole.id });
    contentRemoved = deleted.length > 0;
  } else if (itemExists && contentType === "challenge_submission") {
    const deleted = await tx.delete(challengeSubmissions).where(and(
      eq(challengeSubmissions.id, contentId),
      eq(challengeSubmissions.profileId, report.reportedId),
    )).returning({ id: challengeSubmissions.id });
    contentRemoved = deleted.length > 0;
  }

  let reportedUserId = report.reportedUserId;
  if (!reportedUserId) {
    const [reportedProfile] = await tx
      .select({ userId: profiles.userId })
      .from(profiles)
      .where(eq(profiles.id, report.reportedId))
      .limit(1);
    reportedUserId = reportedProfile?.userId ?? null;
  }

  let expiresAt: Date | null = null;
  if (reportedUserId) {
    expiresAt = getReportSuspensionExpiry(now);
    await tx.insert(userSuspensions).values({
      userId: reportedUserId,
      reason: `Segnalazione ${report.id.slice(0, 8)}: ${report.reason}`.slice(0, 500),
      expiresAt,
      isPermanent: false,
    });
  }

  const action = contentRemoved
    ? `${contentType}_removed${reportedUserId ? "_and_suspended" : ""}`
    : `content_already_removed${reportedUserId ? "_and_suspended" : ""}`;
  await tx.update(reports)
    .set({ moderationAction: action })
    .where(eq(reports.id, report.id));

  return {
    ok: true,
    targetProfileId: report.reportedId,
    contentRemoved,
    contentHidden: false,
    authorSuspended: Boolean(reportedUserId),
    expiresAt,
  };
}