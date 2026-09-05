export const REPORT_CLEANUP_TTL_DAYS = 90;
export const REPORT_CLEANUP_STALE_AFTER_MS = 26 * 60 * 60 * 1000;
export const REPORT_CLEANUP_ALERT_AFTER_FAILURES = 2;
export const REPORT_CLEANUP_NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type ReportCleanupState = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  status: "never" | "running" | "success" | "failure";
  lastDeletedCount: number | null;
  consecutiveFailures: number;
  lastError: string | null;
  lastNotificationAt: string | null;
};

export function createReportCleanupState(): ReportCleanupState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    status: "never",
    lastDeletedCount: null,
    consecutiveFailures: 0,
    lastError: null,
    lastNotificationAt: null,
  };
}

export function markReportCleanupStarted(
  state: ReportCleanupState,
  attemptedAt = new Date().toISOString(),
): ReportCleanupState {
  return {
    ...state,
    lastAttemptAt: attemptedAt,
    status: "running",
  };
}

export function markReportCleanupSucceeded(
  state: ReportCleanupState,
  deletedCount: number,
  completedAt = new Date().toISOString(),
): ReportCleanupState {
  return {
    ...state,
    lastSuccessAt: completedAt,
    status: "success",
    lastDeletedCount: deletedCount,
    consecutiveFailures: 0,
    lastError: null,
    lastNotificationAt: null,
  };
}

export function markReportCleanupFailed(
  state: ReportCleanupState,
  error: unknown,
): ReportCleanupState {
  return {
    ...state,
    status: "failure",
    consecutiveFailures: state.consecutiveFailures + 1,
    lastError: error instanceof Error ? error.message : String(error),
  };
}

export function shouldNotifyReportCleanupFailure(
  state: ReportCleanupState,
  now = Date.now(),
): boolean {
  if (
    state.status !== "failure" ||
    state.consecutiveFailures < REPORT_CLEANUP_ALERT_AFTER_FAILURES
  ) {
    return false;
  }

  if (!state.lastNotificationAt) {
    return true;
  }

  const lastNotificationMs = Date.parse(state.lastNotificationAt);
  return (
    !Number.isFinite(lastNotificationMs) ||
    now - lastNotificationMs >= REPORT_CLEANUP_NOTIFICATION_COOLDOWN_MS
  );
}

export function markReportCleanupNotificationSent(
  state: ReportCleanupState,
  notifiedAt = new Date().toISOString(),
): ReportCleanupState {
  return {
    ...state,
    lastNotificationAt: notifiedAt,
  };
}

export function getReportCleanupHealth(
  state: ReportCleanupState,
  now = Date.now(),
): { schedulerStale: boolean; healthy: boolean } {
  const lastAttemptMs = state.lastAttemptAt ? Date.parse(state.lastAttemptAt) : Number.NaN;
  const schedulerStale =
    !Number.isFinite(lastAttemptMs) ||
    now - lastAttemptMs > REPORT_CLEANUP_STALE_AFTER_MS;

  return {
    schedulerStale,
    healthy: state.status === "success" && !schedulerStale,
  };
}

export function buildReportCleanupStatusResponse(
  state: ReportCleanupState,
  orphanedReportsOlderThanTtl: number,
  now = Date.now(),
) {
  return {
    ...state,
    ttlDays: REPORT_CLEANUP_TTL_DAYS,
    orphanedReportsOlderThanTtl,
    ...getReportCleanupHealth(state, now),
  };
}

export function buildReportCleanupStatusFailure(
  state: ReportCleanupState,
  now = Date.now(),
) {
  return {
    ...state,
    ttlDays: REPORT_CLEANUP_TTL_DAYS,
    orphanedReportsOlderThanTtl: null,
    ...getReportCleanupHealth(state, now),
    error: "Unable to read orphaned report backlog",
  };
}