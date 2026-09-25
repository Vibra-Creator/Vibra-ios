import assert from "node:assert/strict";
import {
  buildColdMessageCleanupStatusResponse,
  createColdMessageCleanupState,
  getColdMessageCleanupHealth,
  markColdMessageCleanupFailed,
  markColdMessageCleanupStarted,
  markColdMessageCleanupSucceeded,
  restoreColdMessageCleanupState,
} from "../server/cold-message-cleanup";

const now = Date.parse("2026-09-05T10:05:00.000Z");

let state = markColdMessageCleanupStarted(
  createColdMessageCleanupState(),
  "2026-09-05T10:00:00.000Z",
);
state = markColdMessageCleanupSucceeded(
  state,
  3,
  "2026-09-05T10:00:01.000Z",
);

assert.deepEqual(
  buildColdMessageCleanupStatusResponse(state, now),
  {
    ...state,
    ttlDays: 90,
    schedulerStale: false,
    healthy: true,
  },
  "a successful cleanup should expose its deletion count and healthy state",
);

state = markColdMessageCleanupStarted(state, "2026-09-05T11:00:00.000Z");
state = markColdMessageCleanupFailed(state, new Error("database unavailable"));

assert.equal(state.status, "failure");
assert.equal(state.lastError, "database unavailable");
assert.equal(state.lastDeletedCount, 3);
assert.equal(state.consecutiveFailures, 1);
assert.equal(
  buildColdMessageCleanupStatusResponse(state, now).healthy,
  false,
  "a failed cleanup should be reported as unhealthy",
);

state = markColdMessageCleanupStarted(state, "2026-09-05T12:00:00.000Z");
state = markColdMessageCleanupFailed(state, "connection refused");
assert.equal(state.consecutiveFailures, 2);
assert.equal(state.lastError, "connection refused");

const restoredSuccessState = restoreColdMessageCleanupState(
  createColdMessageCleanupState(),
  {
    lastAttemptAt: "2026-09-05T09:00:00.000Z",
    lastSuccessAt: "2026-09-05T09:00:01.000Z",
    status: "success",
    lastDeletedCount: 8,
    consecutiveFailures: 0,
    lastError: null,
  },
);
assert.deepEqual(
  restoredSuccessState,
  {
    lastAttemptAt: "2026-09-05T09:00:00.000Z",
    lastSuccessAt: "2026-09-05T09:00:01.000Z",
    status: "success",
    lastDeletedCount: 8,
    consecutiveFailures: 0,
    lastError: null,
  },
  "a successful cleanup state should be restored after a restart",
);

const restoredFailureState = restoreColdMessageCleanupState(
  createColdMessageCleanupState(),
  {
    lastAttemptAt: "2026-09-05T09:30:00.000Z",
    lastSuccessAt: "2026-09-05T09:00:01.000Z",
    status: "failure",
    lastDeletedCount: 8,
    consecutiveFailures: 3,
    lastError: "database unavailable",
  },
);
assert.equal(restoredFailureState.status, "failure");
assert.equal(restoredFailureState.lastAttemptAt, "2026-09-05T09:30:00.000Z");
assert.equal(restoredFailureState.consecutiveFailures, 3);
assert.equal(restoredFailureState.lastError, "database unavailable");

const staleState = markColdMessageCleanupSucceeded(
  markColdMessageCleanupStarted(
    createColdMessageCleanupState(),
    "2026-09-03T00:00:00.000Z",
  ),
  0,
  "2026-09-03T00:00:01.000Z",
);
assert.deepEqual(getColdMessageCleanupHealth(staleState, now), {
  schedulerStale: true,
  healthy: false,
});

console.log("✓ cold-message cleanup monitoring reports success, deletions, failures, and failure streaks");