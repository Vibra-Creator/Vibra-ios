export const REPORT_SUSPENSION_DURATION_MS = 24 * 60 * 60 * 1000;

export const REPORT_CONTENT_TYPES = [
  "profile",
  "chat_message",
  "cold_message",
  "blog_post",
  "room_message",
  "private_room_message",
  "profile_photo",
  "profile_video",
  "profile_main_video",
  "cosmic_signal",
  "signal_comment",
  "hub_post",
  "event",
  "story_briciola",
  "challenge_submission",
] as const;
export type ReportContentType = typeof REPORT_CONTENT_TYPES[number];

export interface BlockedProfileReportTarget {
  id: string;
  name: string;
  bio: string;
  imageUrl: string;
  photos: string[] | null;
  profileVideoUrl: string | null;
}

export function createBlockedProfileReportData(
  reporterId: string,
  profile: BlockedProfileReportTarget,
) {
  const profileEvidence = {
    id: profile.id,
    name: profile.name,
    bio: profile.bio,
    imageUrl: profile.imageUrl,
    photos: profile.photos,
    profileVideoUrl: profile.profileVideoUrl,
  };

  return {
    reporterId,
    reportedId: profile.id,
    reason: "Blocco utente",
    description: "Segnalazione automatica: l'utente è stato bloccato e richiede una verifica di moderazione.",
    reportedContentType: "profile" as const,
    reportedContentId: profile.id,
    reportedContentSnapshot: JSON.stringify(profileEvidence),
  };
}

export function getReportSuspensionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REPORT_SUSPENSION_DURATION_MS);
}

export function isReportContentType(value: unknown): value is ReportContentType {
  return typeof value === "string" && (REPORT_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isColdMessageAuthoredByReportedUser(
  report: { reporterId: string; reportedId: string },
  message: { fromProfileId: string; toProfileId: string },
): boolean {
  return (
    message.fromProfileId === report.reportedId &&
    message.toProfileId === report.reporterId
  );
}

export function isChatMessageAuthoredByReportedUser(
  report: { reporterId: string; reportedId: string },
  message: { senderId: string },
  match: { profile1Id: string; profile2Id: string } | undefined,
): boolean {
  if (!match || message.senderId !== report.reportedId) return false;
  return (
    (match.profile1Id === report.reporterId && match.profile2Id === report.reportedId) ||
    (match.profile2Id === report.reporterId && match.profile1Id === report.reportedId)
  );
}

export function isBlogPostAuthoredByReportedUser(
  report: { reportedId: string },
  post: { profileId: string },
): boolean {
  return post.profileId === report.reportedId;
}

export function isRoomMessageAuthoredByReportedUser(
  report: { reportedId: string },
  message: { senderId: string },
): boolean {
  return message.senderId === report.reportedId;
}

export function isProfilePhotoOwnedByReportedProfile(
  report: { reportedId: string },
  profile: { id: string; imageUrl?: string | null; photos?: string[] | null },
  photoUrl: string,
): boolean {
  return profile.id === report.reportedId &&
    (profile.imageUrl === photoUrl || (profile.photos ?? []).includes(photoUrl));
}

export function isProfileVideoAuthoredByReportedUser(
  report: { reportedId: string },
  video: { profileId: string },
): boolean {
  return video.profileId === report.reportedId;
}

export function isCosmicSignalAuthoredByReportedUser(
  report: { reportedId: string },
  signal: { profileId: string },
): boolean {
  return signal.profileId === report.reportedId;
}

export function isSignalCommentAuthoredByReportedUser(
  report: { reportedId: string },
  comment: { profileId: string },
): boolean {
  return comment.profileId === report.reportedId;
}

export function isCosmicSignalVisibleToReporter(
  reporterId: string,
  signal: { toProfileId?: string | null },
): boolean {
  return signal.toProfileId == null || signal.toProfileId === reporterId;
}
