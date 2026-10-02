import assert from "node:assert/strict";
import test from "node:test";
import {
  createUserReportNotificationProcessor,
  getUserReportNotificationRetryDelayMs,
} from "../user-report-notifications";

test("a temporary email failure keeps the report and persisted alert queued until delivery succeeds", async () => {
  let now = new Date("2026-10-02T09:00:00.000Z");
  const reports = new Map([[
    "report-1",
    {
      id: "report-1",
      status: "pending",
      notificationStatus: "pending",
      notificationAttempts: 0,
      notificationNextAttemptAt: new Date(now),
      notificationLastError: null as string | null,
      notificationSentAt: null as Date | null,
    },
  ]]);
  let deliveryAttempts = 0;
  const errors: string[] = [];

  const notify = createUserReportNotificationProcessor({
    claimPendingReports: async ({ reportId } = {}) => {
      const report = reports.get(reportId ?? "report-1");
      if (
        !report ||
        report.status !== "pending" ||
        !["pending", "sending"].includes(report.notificationStatus) ||
        report.notificationNextAttemptAt > now
      ) {
        return [];
      }
      report.notificationStatus = "sending";
      report.notificationAttempts += 1;
      report.notificationNextAttemptAt = new Date(now.getTime() + 2 * 60_000);
      return [{ id: report.id, notificationAttempts: report.notificationAttempts }];
    },
    getAdminRecipients: async () => [{ email: "admin@example.test", name: "Admin" }],
    sendBulkEmail: async () => {
      deliveryAttempts += 1;
      if (deliveryAttempts === 1) return { sent: 0, failed: 1 };
      return { sent: 1, failed: 0 };
    },
    markSent: async (reportId, sentAt) => {
      const report = reports.get(reportId)!;
      report.notificationStatus = "sent";
      report.notificationSentAt = sentAt;
      report.notificationLastError = null;
    },
    scheduleRetry: async (reportId, nextAttemptAt, error) => {
      const report = reports.get(reportId)!;
      report.notificationStatus = "pending";
      report.notificationNextAttemptAt = nextAttemptAt;
      report.notificationLastError = error;
    },
    now: () => new Date(now),
    logError: (message) => errors.push(message),
  });

  await notify("report-1");

  const afterTemporaryFailure = reports.get("report-1")!;
  assert.equal(afterTemporaryFailure.status, "pending", "the report itself must remain available");
  assert.equal(afterTemporaryFailure.notificationStatus, "pending", "the durable alert must be queued again");
  assert.match(afterTemporaryFailure.notificationLastError ?? "", /delivery incomplete/);
  assert.equal(afterTemporaryFailure.notificationAttempts, 1);
  assert.equal(
    afterTemporaryFailure.notificationNextAttemptAt.getTime() - now.getTime(),
    getUserReportNotificationRetryDelayMs(1),
  );
  assert.equal(errors.length, 1);

  now = new Date(afterTemporaryFailure.notificationNextAttemptAt);
  await notify("report-1");

  const afterSuccessfulRetry = reports.get("report-1")!;
  assert.equal(afterSuccessfulRetry.status, "pending", "delivery must not remove the report from moderation");
  assert.equal(afterSuccessfulRetry.notificationStatus, "sent");
  assert.equal(afterSuccessfulRetry.notificationAttempts, 2);
  assert.equal(afterSuccessfulRetry.notificationLastError, null);
  assert.equal(afterSuccessfulRetry.notificationSentAt?.toISOString(), now.toISOString());
});