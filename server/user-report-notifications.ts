export type UserReportNotification = {
  id: string;
  notificationAttempts: number;
};

export type UserReportNotificationRecipient = {
  email: string;
  name: string;
};

type UserReportNotificationDependencies = {
  claimPendingReports: (options?: { reportId?: string }) => Promise<UserReportNotification[]>;
  getAdminRecipients: () => Promise<UserReportNotificationRecipient[]>;
  sendBulkEmail: (
    recipients: UserReportNotificationRecipient[],
    subject: string,
    htmlBody: string,
  ) => Promise<{ sent: number; failed: number }>;
  markSent: (reportId: string, sentAt: Date) => Promise<void>;
  scheduleRetry: (reportId: string, nextAttemptAt: Date, error: string) => Promise<void>;
  now?: () => Date;
  logError?: (message: string, error?: unknown) => void;
};

const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 30 * 60_000;
export const USER_REPORT_NOTIFICATION_CLAIM_LEASE_MS = 2 * 60_000;

export function getUserReportNotificationRetryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.min(20, Math.floor(attempts) - 1));
  return Math.min(RETRY_BASE_MS * 2 ** exponent, RETRY_MAX_MS);
}

export function createUserReportNotificationProcessor(
  dependencies: UserReportNotificationDependencies,
): (reportId?: string) => Promise<void> {
  let processing = false;
  const now = dependencies.now ?? (() => new Date());
  const logError = dependencies.logError ?? ((message, error) => console.error(message, error));

  return async (reportId?: string): Promise<void> => {
    if (processing) return;
    processing = true;
    try {
      const reports = await dependencies.claimPendingReports({ reportId });
      for (const report of reports) {
        try {
          const recipients = await dependencies.getAdminRecipients();
          if (recipients.length === 0) {
            throw new Error("No admin email recipients available");
          }

          const result = await dependencies.sendBulkEmail(
            recipients,
            "Vibra: nuova segnalazione da revisionare",
            `<p>È arrivata una nuova segnalazione UGC da revisionare.</p>
             <p>Riferimento: ${report.id}</p>
             <p>Apri la dashboard admin e verifica la segnalazione entro 24 ore.</p>`,
          );
          if (result.failed > 0 || result.sent < recipients.length) {
            throw new Error(`Admin notification delivery incomplete (${result.sent}/${recipients.length} sent)`);
          }

          await dependencies.markSent(report.id, now());
        } catch (error) {
          const retryAt = new Date(
            now().getTime() + getUserReportNotificationRetryDelayMs(report.notificationAttempts),
          );
          try {
            await dependencies.scheduleRetry(
              report.id,
              retryAt,
              error instanceof Error ? error.message : String(error),
            );
          } catch (scheduleError) {
            logError(`[ugc-moderation] Could not persist retry for report ${report.id}`, scheduleError);
          }
          logError(`[ugc-moderation] Could not notify admins about report ${report.id}`, error);
        }
      }
    } catch (error) {
      logError("[ugc-moderation] Could not claim pending report notifications", error);
    } finally {
      processing = false;
    }
  };
}