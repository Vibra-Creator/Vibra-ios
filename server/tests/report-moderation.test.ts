import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getReportSuspensionExpiry,
  isColdMessageAuthoredByReportedUser,
  REPORT_SUSPENSION_DURATION_MS,
} from "../report-moderation.js";

test("reported cold message must be sent by the reported profile to the reporter", () => {
  const report = { reporterId: "reporter-profile", reportedId: "reported-profile" };

  assert.equal(
    isColdMessageAuthoredByReportedUser(report, {
      fromProfileId: "reported-profile",
      toProfileId: "reporter-profile",
    }),
    true,
  );
  assert.equal(
    isColdMessageAuthoredByReportedUser(report, {
      fromProfileId: "reporter-profile",
      toProfileId: "reported-profile",
    }),
    false,
  );
  assert.equal(
    isColdMessageAuthoredByReportedUser(report, {
      fromProfileId: "unrelated-profile",
      toProfileId: "reporter-profile",
    }),
    false,
  );
});

test("moderation suspension expires after exactly 24 hours", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");
  assert.equal(
    getReportSuspensionExpiry(now).getTime(),
    now.getTime() + REPORT_SUSPENSION_DURATION_MS,
  );
});