import assert from "node:assert/strict";
import { test } from "node:test";
import { updateProfileSchema } from "../../shared/schema.js";
import { createSuspensionWriteGuard } from "../suspension-write-guard.js";
import {
  createBlockedProfileReportData,
  getReportSuspensionExpiry,
  isBlogPostAuthoredByReportedUser,
  isChatMessageAuthoredByReportedUser,
  isColdMessageAuthoredByReportedUser,
  isRoomMessageAuthoredByReportedUser,
  isReportContentType,
  REPORT_SUSPENSION_DURATION_MS,
} from "../report-moderation.js";

test("blocking a user creates an actionable profile report with a review snapshot", () => {
  const report = createBlockedProfileReportData("reporter-profile", {
    id: "reported-profile",
    name: "Reported profile",
    bio: "Profile bio",
    imageUrl: "/reported-avatar.png",
    photos: ["/reported-photo.png"],
    profileVideoUrl: null,
  });

  assert.equal(report.reporterId, "reporter-profile");
  assert.equal(report.reportedId, "reported-profile");
  assert.equal(report.reportedContentType, "profile");
  assert.equal(report.reportedContentId, "reported-profile");
  assert.equal(report.reason, "Blocco utente");
  assert.deepEqual(JSON.parse(report.reportedContentSnapshot), {
    id: "reported-profile",
    name: "Reported profile",
    bio: "Profile bio",
    imageUrl: "/reported-avatar.png",
    photos: ["/reported-photo.png"],
    profileVideoUrl: null,
  });
});

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

test("chat-message reports must match both the author and the reporter's match", () => {
  const report = { reporterId: "reporter-profile", reportedId: "reported-profile" };
  const validMatch = { profile1Id: report.reporterId, profile2Id: report.reportedId };

  assert.equal(
    isChatMessageAuthoredByReportedUser(report, { senderId: report.reportedId }, validMatch),
    true,
  );
  assert.equal(
    isChatMessageAuthoredByReportedUser(report, { senderId: report.reporterId }, validMatch),
    false,
  );
  assert.equal(
    isChatMessageAuthoredByReportedUser(report, { senderId: report.reportedId }, {
      profile1Id: report.reportedId,
      profile2Id: "unrelated-profile",
    }),
    false,
  );
});

test("blog-post reports must target a post authored by the reported profile", () => {
  const report = { reportedId: "reported-profile" };
  assert.equal(isBlogPostAuthoredByReportedUser(report, { profileId: "reported-profile" }), true);
  assert.equal(isBlogPostAuthoredByReportedUser(report, { profileId: "unrelated-profile" }), false);
});

test("room-message reports must target a message authored by the reported profile", () => {
  const report = { reportedId: "reported-profile" };
  assert.equal(isRoomMessageAuthoredByReportedUser(report, { senderId: "reported-profile" }), true);
  assert.equal(isRoomMessageAuthoredByReportedUser(report, { senderId: "unrelated-profile" }), false);
});

test("only supported user-content types can be linked to a moderation report", () => {
  assert.equal(isReportContentType("profile"), true);
  assert.equal(isReportContentType("chat_message"), true);
  assert.equal(isReportContentType("cold_message"), true);
  assert.equal(isReportContentType("blog_post"), true);
  assert.equal(isReportContentType("room_message"), true);
  assert.equal(isReportContentType("private_room_message"), true);
  assert.equal(isReportContentType("user_id"), false);
  assert.equal(isReportContentType(null), false);
});

test("profile updates cannot clear the server-managed moderation hidden flag", () => {
  const parsed = updateProfileSchema.parse({ moderationHidden: false });
  assert.equal("moderationHidden" in parsed, false);
});

test("active suspensions block content writes but keep reporting and deletion available", async () => {
  const guard = createSuspensionWriteGuard({
    getUser: async () => ({ isAdmin: false }),
    getActiveSuspension: async () => ({
      isPermanent: false,
      expiresAt: new Date("2026-09-30T12:00:00.000Z"),
    }),
  });
  const makeResponse = () => ({
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  });

  const writeResponse = makeResponse();
  let writeNextCalled = false;
  await guard(
    { method: "POST", originalUrl: "/api/blog-posts", user: { claims: { sub: "suspended-user" } } },
    writeResponse,
    () => { writeNextCalled = true; },
  );
  assert.equal(writeNextCalled, false);
  assert.equal(writeResponse.statusCode, 403);
  assert.equal((writeResponse.body as { reason: string }).reason, "account_suspended");

  const reportResponse = makeResponse();
  let reportNextCalled = false;
  await guard(
    { method: "POST", originalUrl: "/api/reports", user: { claims: { sub: "suspended-user" } } },
    reportResponse,
    () => { reportNextCalled = true; },
  );
  assert.equal(reportNextCalled, true);

  const deleteResponse = makeResponse();
  let deleteNextCalled = false;
  await guard(
    { method: "DELETE", originalUrl: "/api/blog-posts/post-1", user: { claims: { sub: "suspended-user" } } },
    deleteResponse,
    () => { deleteNextCalled = true; },
  );
  assert.equal(deleteNextCalled, true);
});

test("suspension status lookup failures fail closed, while admins remain able to write", async () => {
  const failingGuard = createSuspensionWriteGuard({
    getUser: async () => { throw new Error("database unavailable"); },
    getActiveSuspension: async () => undefined,
  });
  const failureResponse = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  await failingGuard(
    { method: "POST", originalUrl: "/api/blog-posts", user: { claims: { sub: "user-1" } } },
    failureResponse,
    () => {},
  );
  assert.equal(failureResponse.statusCode, 503);

  const adminGuard = createSuspensionWriteGuard({
    getUser: async () => ({ isAdmin: true }),
    getActiveSuspension: async () => { throw new Error("should not be called for admins"); },
  });
  const adminResponse = {
    status(code: number) {
      return { statusCode: code };
    },
    json() {
      return {};
    },
  };
  let adminNextCalled = false;
  await adminGuard(
    { method: "POST", originalUrl: "/api/blog-posts", user: { claims: { sub: "admin-1" } } },
    adminResponse,
    () => { adminNextCalled = true; },
  );
  assert.equal(adminNextCalled, true);
});