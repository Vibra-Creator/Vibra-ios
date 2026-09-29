export const COLD_MESSAGE_CLEANUP_TTL_DAYS = 90;
export const COLD_MESSAGE_CLEANUP_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

export type ColdMessageCleanupState = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  status: "never" | "running" | "success" | "failure";
  lastDeletedCount: number | null;
  consecutiveFailures: number;
  lastError: string | null;
};

export type PersistedColdMessageCleanupState = ColdMessageCleanupState;

export function createColdMessageCleanupState(): ColdMessageCleanupState {
  return {
    lastAttemptAt: null,
    lastSuccessAt: null,
    status: "never",
    lastDeletedCount: null,
    consecutiveFailures: 0,
    lastError: null,
  };
}

export function restoreColdMessageCleanupState(
  state: ColdMessageCleanupState,
  persisted: PersistedColdMessageCleanupState,
): ColdMessageCleanupState {
  return {
    ...state,
    ...persisted,
  };
}

export function markColdMessageCleanupStarted(
  state: ColdMessageCleanupState,
  attemptedAt = new Date().toISOString(),
): ColdMessageCleanupState {
  return {
    ...state,
    lastAttemptAt: attemptedAt,
    status: "running",
  };
}

export function markColdMessageCleanupSucceeded(
  state: ColdMessageCleanupState,
  deletedCount: number,
  completedAt = new Date().toISOString(),
): ColdMessageCleanupState {
  return {
    ...state,
    lastSuccessAt: completedAt,
    status: "success",
    lastDeletedCount: deletedCount,
    consecutiveFailures: 0,
    lastError: null,
  };
}

export function markColdMessageCleanupFailed(
  state: ColdMessageCleanupState,
  error: unknown,
): ColdMessageCleanupState {
  return {
    ...state,
    status: "failure",
    consecutiveFailures: state.consecutiveFailures + 1,
    lastError: error instanceof Error ? error.message : String(error),
  };
}

export function getColdMessageCleanupHealth(
  state: ColdMessageCleanupState,
  now = Date.now(),
): { schedulerStale: boolean; healthy: boolean } {
  const lastAttemptMs = state.lastAttemptAt ? Date.parse(state.lastAttemptAt) : Number.NaN;
  const schedulerStale =
    !Number.isFinite(lastAttemptMs) ||
    now - lastAttemptMs > COLD_MESSAGE_CLEANUP_STALE_AFTER_MS;

  return {
    schedulerStale,
    healthy: state.status === "success" && !schedulerStale,
  };
}

export function buildColdMessageCleanupStatusResponse(
  state: ColdMessageCleanupState,
  orphanedColdMessagesOlderThanTtl: number,
  now = Date.now(),
) {
  return {
    ...state,
    ttlDays: COLD_MESSAGE_CLEANUP_TTL_DAYS,
    orphanedColdMessagesOlderThanTtl,
    ...getColdMessageCleanupHealth(state, now),
  };
}

export function buildColdMessageCleanupStatusFailure(
  state: ColdMessageCleanupState,
  now = Date.now(),
) {
  return {
    ...state,
    ttlDays: COLD_MESSAGE_CLEANUP_TTL_DAYS,
    orphanedColdMessagesOlderThanTtl: null,
    ...getColdMessageCleanupHealth(state, now),
    error: "Unable to read orphaned cold-message backlog",
  };
}