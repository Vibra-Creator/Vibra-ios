export const REPORT_SUSPENSION_DURATION_MS = 24 * 60 * 60 * 1000;

export const REPORT_CONTENT_TYPES = [
  "profile",
  "chat_message",
  "cold_message",
  "blog_post",
  "room_message",
  "private_room_message",
] as const;
export type ReportContentType = typeof REPORT_CONTENT_TYPES[number];

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
