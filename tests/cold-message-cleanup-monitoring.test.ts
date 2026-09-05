import assert from "node:assert/strict";
import {
  buildColdMessageCleanupStatusResponse,
  createColdMessageCleanupState,
  getColdMessageCleanupHealth,
  markColdMessageCleanupFailed,
  markColdMessageCleanupStarted,
  markColdMessageCleanupSucceeded,
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