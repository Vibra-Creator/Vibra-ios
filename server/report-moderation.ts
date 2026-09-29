export const REPORT_SUSPENSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function getReportSuspensionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REPORT_SUSPENSION_DURATION_MS);
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