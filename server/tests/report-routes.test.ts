import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express, { type RequestHandler } from "express";
import { createServer, request as httpRequest, type Server as HttpServer } from "node:http";
import { and, eq, inArray, or } from "drizzle-orm";
import {
  challengeSubmissions,
  dailyChallenges,
  events,
  hubPosts,
  blockedUsers,
  privateRoomMessages,
  privateRoomRequests,
  privateRooms,
  profiles,
  reports,
  roomMessages,
  stories,
  storyBriciole,
  storyVotes,
  userSuspensions,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { runMigrations } from "../migrate.js";
import { createAdminAuthorizationMiddleware, registerBlockedUserRoute } from "../routes.js";
import {
  registerAdminReportListRoute,
  registerReportRemovalRoute,
  registerReportSubmissionRoute,
  registerReportSuspensionRoute,
} from "../report-routes.js";
import { DatabaseStorage } from "../storage.js";

const runId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createdProfileIds: string[] = [];
const createdUserIds: string[] = [];
const createdReportIds: string[] = [];
const createdRoomMessageIds: string[] = [];
const createdPrivateRoomMessageIds: string[] = [];
const createdPrivateRoomIds: string[] = [];
const createdPrivateRoomRequestIds: string[] = [];
const createdHubPostIds: string[] = [];
const createdEventIds: string[] = [];
const createdStoryIds: string[] = [];
const createdBriciolaIds: string[] = [];
const createdStoryVoteIds: string[] = [];
const createdChallengeIds: string[] = [];
const createdChallengeSubmissionIds: string[] = [];
const reportNotificationRequests: string[] = [];
let server: HttpServer;
const reportStorage = new DatabaseStorage();

const testAuthentication: RequestHandler = (req: any, res, next) => {
  const userId = req.header("x-test-user");
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.user = { claims: { sub: userId } };
  next();
};

const testAdminAuthorization = createAdminAuthorizationMiddleware(async (userId) => ({
  isAdmin: userId === "test-moderator",
  email: null,
}));

async function createProfile(label: string) {
  const userId = `__report_route_user_${label}_${runId}`;
  const [profile] = await db.insert(profiles).values({
    userId,
    name: `__report_route_${label}_${runId}`,
    age: 30,
    bio: "",
    imageUrl: "/images/test.png",
    location: "",
    interests: [],
    alienType: "test",
    isBot: false,
  }).returning({ id: profiles.id });
  createdProfileIds.push(profile.id);
  createdUserIds.push(userId);
  return { id: profile.id, userId };
}

async function requestJson(
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; body: any }> {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Report route test server is not listening");
  const serializedBody = body === undefined ? "" : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      path,
      method,
      headers: {
        Accept: "application/json",
        ...(serializedBody ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(serializedBody).toString(),
        } : {}),
        ...headers,
      },
    }, (response) => {
      let rawBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { rawBody += chunk; });
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(rawBody) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    if (serializedBody) request.write(serializedBody);
    request.end();
  });
}

before(async () => {
  await runMigrations();
  const app = express();
  app.use(express.json());
  registerReportSubmissionRoute(app, testAuthentication, (reportId) => {
    reportNotificationRequests.push(reportId);
  });
  registerBlockedUserRoute(app, testAuthentication, reportStorage, (reportId) => {
    reportNotificationRequests.push(reportId);
  });
  registerAdminReportListRoute(
    app,
    testAuthentication,
    testAdminAuthorization,
    () => reportStorage.getReports(),
  );
  registerReportRemovalRoute(app, testAuthentication, testAdminAuthorization, () => {});
  registerReportSuspensionRoute(app, testAuthentication, testAdminAuthorization, () => {});
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
});

after(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  if (createdUserIds.length) {
    await db.delete(userSuspensions).where(inArray(userSuspensions.userId, createdUserIds));
  }
  if (createdReportIds.length) {
    await db.delete(reports).where(inArray(reports.id, createdReportIds));
  }
  if (createdProfileIds.length) {
    await db.delete(blockedUsers).where(or(
      inArray(blockedUsers.blockerId, createdProfileIds),
      inArray(blockedUsers.blockedId, createdProfileIds),
    ));
  }
  if (createdRoomMessageIds.length) {
    await db.delete(roomMessages).where(inArray(roomMessages.id, createdRoomMessageIds));
  }
  if (createdPrivateRoomMessageIds.length) {
    await db.delete(privateRoomMessages).where(inArray(privateRoomMessages.id, createdPrivateRoomMessageIds));
  }
  if (createdPrivateRoomRequestIds.length) {
    await db.delete(privateRoomRequests).where(inArray(privateRoomRequests.id, createdPrivateRoomRequestIds));
  }
  if (createdPrivateRoomIds.length) {
    await db.delete(privateRooms).where(inArray(privateRooms.id, createdPrivateRoomIds));
  }
  if (createdStoryVoteIds.length) {
    await db.delete(storyVotes).where(inArray(storyVotes.id, createdStoryVoteIds));
  }
  if (createdBriciolaIds.length) {
    await db.delete(storyBriciole).where(inArray(storyBriciole.id, createdBriciolaIds));
  }
  if (createdStoryIds.length) {
    await db.delete(stories).where(inArray(stories.id, createdStoryIds));
  }
  if (createdChallengeSubmissionIds.length) {
    await db.delete(challengeSubmissions).where(inArray(challengeSubmissions.id, createdChallengeSubmissionIds));
  }
  if (createdChallengeIds.length) {
    await db.delete(dailyChallenges).where(inArray(dailyChallenges.id, createdChallengeIds));
  }
  if (createdHubPostIds.length) {
    await db.delete(hubPosts).where(inArray(hubPosts.id, createdHubPostIds));
  }
  if (createdEventIds.length) {
    await db.delete(events).where(inArray(events.id, createdEventIds));
  }
  if (createdProfileIds.length) {
    await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
  }
});

test("authenticated blocks create actionable profile reports, notify admins, and preserve evidence through moderation", async () => {
  const linkedReporter = await createProfile("block-linked-reporter");
  const linkedTarget = await createProfile("block-linked-target");
  await db.update(profiles).set({
    name: "Linked target profile",
    bio: "Evidence from the linked profile",
    imageUrl: "/linked-target-avatar.png",
    photos: ["/linked-target-photo.png"],
    profileVideoUrl: null,
  }).where(eq(profiles.id, linkedTarget.id));
  const [existingLinkedReport] = await db.insert(reports).values({
    reporterId: linkedReporter.id,
    reportedId: linkedTarget.id,
    reason: "Segnalazione preesistente",
    reportedContentType: "profile",
    reportedContentId: linkedTarget.id,
    reportedContentSnapshot: JSON.stringify({ id: linkedTarget.id, name: "Earlier snapshot" }),
  }).returning({ id: reports.id });
  createdReportIds.push(existingLinkedReport.id);

  const notificationsBeforeLinkedBlock = reportNotificationRequests.length;
  const linkedBlock = await requestJson(
    "/api/block",
    "POST",
    { blockedId: linkedTarget.id },
    { "x-test-user": linkedReporter.userId },
  );
  assert.equal(linkedBlock.statusCode, 200);
  assert.equal(linkedBlock.body.blockedId, linkedTarget.id);
  const linkedReports = await db.select({ id: reports.id })
    .from(reports)
    .where(and(
      eq(reports.reporterId, linkedReporter.id),
      eq(reports.reportedId, linkedTarget.id),
      eq(reports.status, "pending"),
      eq(reports.reportedContentType, "profile"),
    ));
  assert.deepEqual(linkedReports.map(({ id }) => id), [existingLinkedReport.id]);
  assert.equal(reportNotificationRequests.length, notificationsBeforeLinkedBlock);

  const unlinkedReporter = await createProfile("block-unlinked-reporter");
  const unlinkedTarget = await createProfile("block-unlinked-target");
  await db.update(profiles).set({
    name: "Block target profile",
    bio: "Profile evidence shown to moderators",
    imageUrl: "/block-target-avatar.png",
    photos: ["/block-target-photo.png"],
    profileVideoUrl: null,
  }).where(eq(profiles.id, unlinkedTarget.id));
  const [unrelatedReport] = await db.insert(reports).values({
    reporterId: unlinkedReporter.id,
    reportedId: unlinkedTarget.id,
    reason: "Segnalazione senza collegamento",
  }).returning({ id: reports.id });
  createdReportIds.push(unrelatedReport.id);

  const unlinkedBlock = await requestJson(
    "/api/block",
    "POST",
    { blockedId: unlinkedTarget.id },
    { "x-test-user": unlinkedReporter.userId },
  );
  assert.equal(unlinkedBlock.statusCode, 200);
  assert.equal(unlinkedBlock.body.blockedId, unlinkedTarget.id);

  const [actionableReport] = await db.select().from(reports)
    .where(and(
      eq(reports.reporterId, unlinkedReporter.id),
      eq(reports.reportedId, unlinkedTarget.id),
      eq(reports.reportedContentType, "profile"),
      eq(reports.reportedContentId, unlinkedTarget.id),
      eq(reports.status, "pending"),
    ))
    .limit(1);
  assert.ok(actionableReport, "blocking must create a linked pending profile report");
  createdReportIds.push(actionableReport.id);
  assert.equal(actionableReport.notificationStatus, "pending");
  assert.deepEqual(JSON.parse(actionableReport.reportedContentSnapshot ?? "null"), {
    id: unlinkedTarget.id,
    name: "Block target profile",
    bio: "Profile evidence shown to moderators",
    imageUrl: "/block-target-avatar.png",
    photos: ["/block-target-photo.png"],
    profileVideoUrl: null,
  });
  assert.ok(reportNotificationRequests.includes(actionableReport.id), "new block reports must trigger the admin notification queue");

  const adminReports = await requestJson(
    "/api/admin/reports",
    "GET",
    undefined,
    { "x-test-user": "test-moderator" },
  );
  assert.equal(adminReports.statusCode, 200);
  const adminVisibleReport = adminReports.body.find((report: any) => report.id === actionableReport.id);
  assert.ok(adminVisibleReport, "admins must be able to find the block report");
  assert.equal(adminVisibleReport.reportedContentType, "profile");
  assert.equal(adminVisibleReport.reportedContentId, unlinkedTarget.id);
  assert.equal(adminVisibleReport.status, "pending");
  assert.deepEqual(JSON.parse(adminVisibleReport.reportedContentSnapshot), {
    id: unlinkedTarget.id,
    name: "Block target profile",
    bio: "Profile evidence shown to moderators",
    imageUrl: "/block-target-avatar.png",
    photos: ["/block-target-photo.png"],
    profileVideoUrl: null,
  });

  const moderation = await requestJson(
    `/api/admin/reports/${encodeURIComponent(actionableReport.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(moderation.statusCode, 200);
  assert.equal(moderation.body.contentHidden, true);
  assert.equal(moderation.body.authorSuspended, true);
  const [hiddenTarget] = await db.select().from(profiles)
    .where(eq(profiles.id, unlinkedTarget.id))
    .limit(1);
  assert.equal(hiddenTarget.moderationHidden, true);
  const [resolvedReport] = await db.select().from(reports)
    .where(eq(reports.id, actionableReport.id))
    .limit(1);
  assert.equal(resolvedReport.status, "resolved");
  assert.equal(resolvedReport.moderationAction, "profile_hidden_and_suspended");
  assert.equal(resolvedReport.moderatedBy, "test-moderator");
  assert.ok(resolvedReport.reportedContentSnapshot, "moderation must preserve the review evidence");
  const [suspension] = await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, unlinkedTarget.userId))
    .limit(1);
  assert.ok(suspension, "the linked account must be suspended by the admin action");
});

test("room-message reports require authentication and the reported author; evidence comes from the server", async () => {
  const reporter = await createProfile("public-reporter");
  const author = await createProfile("public-author");
  const otherProfile = await createProfile("public-other");
  const [message] = await db.insert(roomMessages).values({
    roomId: `real-room-${runId}`,
    senderId: author.id,
    senderName: "Reported author",
    content: "The actual reported room message",
  }).returning();
  createdRoomMessageIds.push(message.id);

  const payload = {
    reportedId: author.id,
    reason: "Contenuto inappropriato",
    reportedContentType: "room_message",
    reportedContentId: message.id,
    roomId: "forged-room-id",
    reportedContentSnapshot: JSON.stringify({ content: "forged snapshot" }),
  };
  const notificationsBeforeReport = reportNotificationRequests.length;
  const unauthorized = await requestJson("/api/reports", "POST", payload);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(reportNotificationRequests.length, notificationsBeforeReport);

  const wrongAuthor = await requestJson("/api/reports", "POST", {
    ...payload,
    reportedId: otherProfile.id,
  }, { "x-test-user": reporter.userId });
  assert.equal(wrongAuthor.statusCode, 400);
  assert.equal(reportNotificationRequests.length, notificationsBeforeReport);

  const accepted = await requestJson("/api/reports", "POST", payload, {
    "x-test-user": reporter.userId,
  });
  assert.equal(accepted.statusCode, 200);
  createdReportIds.push(accepted.body.id);
  assert.deepEqual(
    reportNotificationRequests.slice(notificationsBeforeReport),
    [accepted.body.id],
    "only the accepted report's persisted ID must be passed to the moderator notification queue",
  );
  const [persistedReport] = await db.select().from(reports)
    .where(eq(reports.id, accepted.body.id))
    .limit(1);
  assert.ok(persistedReport, "the report must be persisted before its notification is queued");
  assert.equal(persistedReport.status, "pending");
  assert.equal(persistedReport.notificationStatus, "pending");
  assert.equal(accepted.body.reportedId, author.id);
  assert.equal(accepted.body.reportedContentId, message.id);
  const snapshot = JSON.parse(accepted.body.reportedContentSnapshot);
  assert.equal(snapshot.id, message.id);
  assert.equal(snapshot.roomId, message.roomId);
  assert.equal(snapshot.senderId, author.id);
  assert.equal(snapshot.content, message.content);
  assert.notEqual(snapshot.roomId, payload.roomId);
  assert.notEqual(snapshot.content, "forged snapshot");
});

test("remaining public-feed report types capture server evidence and reject forged authors", async () => {
  const reporter = await createProfile("remaining-feed-reporter");
  const author = await createProfile("remaining-feed-author");
  const wrongAuthor = await createProfile("remaining-feed-wrong-author");

  const [post] = await db.insert(hubPosts).values({
    id: `route-test-post-${runId}`,
    profileId: author.id,
    profileName: "Feed author",
    profileImageUrl: "/images/test.png",
    category: "casa",
    title: `Listing ${runId}`,
    description: "Exact listing report test",
  }).returning({ id: hubPosts.id });
  createdHubPostIds.push(post.id);
  const [event] = await db.insert(events).values({
    id: `route-test-event-${runId}`,
    profileId: author.id,
    profileName: "Feed author",
    profileImageUrl: "/images/test.png",
    city: "Roma",
    eventType: "community",
    title: `Event ${runId}`,
    description: "Exact event report test",
    eventDate: "2099-01-01",
  }).returning({ id: events.id });
  createdEventIds.push(event.id);
  const [story] = await db.insert(stories).values({
    id: `route-test-story-${runId}`,
    theme: `Story ${runId}`,
  }).returning({ id: stories.id });
  createdStoryIds.push(story.id);
  const [briciola] = await db.insert(storyBriciole).values({
    id: `route-test-briciola-${runId}`,
    storyId: story.id,
    profileId: author.id,
    content: "Exact story contribution report test",
  }).returning({ id: storyBriciole.id });
  createdBriciolaIds.push(briciola.id);
  const [vote] = await db.insert(storyVotes).values({
    id: `route-test-vote-${runId}`,
    briolaId: briciola.id,
    profileId: reporter.id,
    voteType: "up",
  }).returning({ id: storyVotes.id });
  createdStoryVoteIds.push(vote.id);
  const [challenge] = await db.insert(dailyChallenges).values({
    id: `route-test-challenge-${runId}`,
    title: `Challenge ${runId}`,
    description: "Approved challenge photo",
    isActive: true,
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  }).returning({ id: dailyChallenges.id });
  createdChallengeIds.push(challenge.id);
  const [submission] = await db.insert(challengeSubmissions).values({
    id: `route-test-submission-${runId}`,
    challengeId: challenge.id,
    profileId: author.id,
    imageUrl: `https://example.test/route-challenge-${runId}.jpg`,
    status: "approved",
  }).returning({ id: challengeSubmissions.id });
  createdChallengeSubmissionIds.push(submission.id);

  const targets = [
    { contentType: "hub_post", contentId: post.id },
    { contentType: "event", contentId: event.id },
    { contentType: "story_briciola", contentId: briciola.id },
    { contentType: "challenge_submission", contentId: submission.id },
  ];
  for (const target of targets) {
    const forged = await requestJson("/api/reports", "POST", {
      reportedId: wrongAuthor.id,
      reason: "Ownership validation",
      reportedContentType: target.contentType,
      reportedContentId: target.contentId,
      reportedContentSnapshot: "forged evidence must be ignored",
    }, { "x-test-user": reporter.userId });
    if (forged.body?.id) createdReportIds.push(forged.body.id);
    assert.equal(forged.statusCode, 400, `${target.contentType} must reject a report naming the wrong author`);

    const valid = await requestJson("/api/reports", "POST", {
      reportedId: author.id,
      reason: "Exact feed item validation",
      reportedContentType: target.contentType,
      reportedContentId: target.contentId,
      reportedContentSnapshot: "forged evidence must be ignored",
    }, { "x-test-user": reporter.userId });
    assert.equal(valid.statusCode, 200, `${target.contentType} should accept a valid exact item`);
    createdReportIds.push(valid.body.id);
    assert.equal(valid.body.reportedContentType, target.contentType);
    assert.equal(valid.body.reportedContentId, target.contentId);
    const snapshot = JSON.parse(valid.body.reportedContentSnapshot);
    assert.equal(snapshot.profileId, author.id, "the server snapshot must identify the actual author");
    assert.notEqual(valid.body.reportedContentSnapshot, "forged evidence must be ignored");
  }
});

test("private-room reports require current membership and still ignore client room IDs and snapshots", async () => {
  const outsider = await createProfile("private-outsider");
  const author = await createProfile("private-author");
  const [room] = await db.insert(privateRooms).values({
    ownerId: author.id,
    name: `__report_route_private_${runId}`,
  }).returning({ id: privateRooms.id });
  createdPrivateRoomIds.push(room.id);
  const [message] = await db.insert(privateRoomMessages).values({
    roomId: room.id,
    senderId: author.id,
    senderName: "Private author",
    content: "Private room evidence",
  }).returning();
  createdPrivateRoomMessageIds.push(message.id);

  const payload = {
    reportedId: author.id,
    reason: "Contenuto inappropriato",
    reportedContentType: "private_room_message",
    reportedContentId: message.id,
    roomId: "forged-private-room-id",
    reportedContentSnapshot: JSON.stringify({ content: "forged private snapshot" }),
  };
  const denied = await requestJson("/api/reports", "POST", payload, {
    "x-test-user": outsider.userId,
  });
  assert.equal(denied.statusCode, 403);

  const [approvedRequest] = await db.insert(privateRoomRequests).values({
    roomId: room.id,
    requesterId: outsider.id,
    status: "approved",
  }).returning({ id: privateRoomRequests.id });
  createdPrivateRoomRequestIds.push(approvedRequest.id);

  const accepted = await requestJson("/api/reports", "POST", payload, {
    "x-test-user": outsider.userId,
  });
  assert.equal(accepted.statusCode, 200);
  createdReportIds.push(accepted.body.id);
  const snapshot = JSON.parse(accepted.body.reportedContentSnapshot);
  assert.equal(snapshot.roomId, room.id);
  assert.equal(snapshot.id, message.id);
  assert.equal(snapshot.content, message.content);
  assert.notEqual(snapshot.roomId, payload.roomId);
  assert.notEqual(snapshot.content, "forged private snapshot");
});

test("admin moderation removes only the linked room message and retains its snapshot and 24-hour suspension", async () => {
  const reporter = await createProfile("moderation-reporter");
  const author = await createProfile("moderation-author");
  const [reportedMessage, siblingMessage] = await db.insert(roomMessages).values([
    {
      roomId: `moderation-room-${runId}`,
      senderId: author.id,
      senderName: "Author",
      content: "The exact linked message",
    },
    {
      roomId: `moderation-room-${runId}`,
      senderId: author.id,
      senderName: "Author",
      content: "A separate message that must remain",
    },
  ]).returning();
  createdRoomMessageIds.push(reportedMessage.id, siblingMessage.id);

  const reportResponse = await requestJson("/api/reports", "POST", {
    reportedId: author.id,
    reason: "Contenuto inappropriato",
    reportedContentType: "room_message",
    reportedContentId: reportedMessage.id,
  }, { "x-test-user": reporter.userId });
  assert.equal(reportResponse.statusCode, 200);
  createdReportIds.push(reportResponse.body.id);

  const regularUserAction = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": reporter.userId },
  );
  assert.equal(regularUserAction.statusCode, 403);
  const [unchangedReport] = await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id))
    .limit(1);
  assert.equal(unchangedReport.status, "pending");
  assert.equal(unchangedReport.moderatedBy, null);
  const [stillPresentMessage] = await db.select().from(roomMessages)
    .where(eq(roomMessages.id, reportedMessage.id))
    .limit(1);
  assert.ok(stillPresentMessage);
  assert.equal((await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))).length, 0);

  const missingReport = await requestJson(
    "/api/admin/reports/missing-report-id/remove-and-suspend",
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(missingReport.statusCode, 404);

  const requestStartedAt = Date.now();
  const moderation = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  const requestFinishedAt = Date.now();
  assert.equal(moderation.statusCode, 200);
  assert.equal(moderation.body.contentRemoved, true);
  assert.equal(moderation.body.contentWasAlreadyRemoved, false);
  assert.equal(moderation.body.authorSuspended, true);
  const expiresAt = Date.parse(moderation.body.suspensionExpiresAt);
  const oneDayMs = 24 * 60 * 60 * 1000;
  assert.ok(expiresAt >= requestStartedAt + oneDayMs);
  assert.ok(expiresAt <= requestFinishedAt + oneDayMs);

  const remainingMessages = await db.select({ id: roomMessages.id })
    .from(roomMessages)
    .where(inArray(roomMessages.id, [reportedMessage.id, siblingMessage.id]));
  assert.deepEqual(remainingMessages.map(({ id }) => id), [siblingMessage.id]);
  const [reviewedReport] = await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id))
    .limit(1);
  assert.equal(reviewedReport.status, "resolved");
  assert.ok(reviewedReport.reportedContentSnapshot);
  assert.equal(reviewedReport.moderationAction, "room_message_removed_and_suspended");
  assert.equal(reviewedReport.moderatedBy, "test-moderator");
  assert.ok(reviewedReport.moderatedAt instanceof Date);
  assert.ok(reviewedReport.moderatedAt.getTime() >= requestStartedAt);
  assert.ok(reviewedReport.moderatedAt.getTime() <= requestFinishedAt);
  assert.equal(reviewedReport.resolvedAt?.getTime(), reviewedReport.moderatedAt.getTime());
  const [suspension] = await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))
    .limit(1);
  assert.ok(suspension);
  assert.equal(suspension.isPermanent, false);
  assert.equal(suspension.expiresAt?.getTime(), expiresAt);

  const repeatedAction = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(repeatedAction.statusCode, 409);
  assert.equal((await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))).length, 1);
});

test("simultaneous moderation requests handle a room-message report only once", async () => {
  const reporter = await createProfile("concurrent-moderation-reporter");
  const author = await createProfile("concurrent-moderation-author");
  const [reportedMessage, siblingMessage] = await db.insert(roomMessages).values([
    {
      roomId: `concurrent-moderation-room-${runId}`,
      senderId: author.id,
      senderName: "Author",
      content: "The linked message must be removed once",
    },
    {
      roomId: `concurrent-moderation-room-${runId}`,
      senderId: author.id,
      senderName: "Author",
      content: "The unrelated message must remain",
    },
  ]).returning();
  createdRoomMessageIds.push(reportedMessage.id, siblingMessage.id);

  const reportResponse = await requestJson("/api/reports", "POST", {
    reportedId: author.id,
    reason: "Contenuto inappropriato",
    reportedContentType: "room_message",
    reportedContentId: reportedMessage.id,
  }, { "x-test-user": reporter.userId });
  assert.equal(reportResponse.statusCode, 200);
  createdReportIds.push(reportResponse.body.id);

  const actionPath =
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/remove-and-suspend`;
  const moderatorHeaders = { "x-test-user": "test-moderator" };
  const [firstAction, secondAction] = await Promise.all([
    requestJson(actionPath, "POST", {}, moderatorHeaders),
    requestJson(actionPath, "POST", {}, moderatorHeaders),
  ]);

  const successfulActions = [firstAction, secondAction].filter(({ statusCode }) => statusCode === 200);
  const conflictingActions = [firstAction, secondAction].filter(({ statusCode }) => statusCode === 409);
  assert.equal(successfulActions.length, 1);
  assert.equal(conflictingActions.length, 1);
  assert.equal(conflictingActions[0].body.error, "Report has already been handled");
  assert.equal(successfulActions[0].body.contentRemoved, true);
  assert.equal(successfulActions[0].body.authorSuspended, true);

  const remainingMessages = await db.select({ id: roomMessages.id })
    .from(roomMessages)
    .where(inArray(roomMessages.id, [reportedMessage.id, siblingMessage.id]));
  assert.deepEqual(remainingMessages.map(({ id }) => id), [siblingMessage.id]);

  const [reviewedReport] = await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id))
    .limit(1);
  assert.equal(reviewedReport.status, "resolved");
  assert.equal(reviewedReport.moderationAction, "room_message_removed_and_suspended");
  assert.equal(reviewedReport.moderatedBy, "test-moderator");

  const suspensions = await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId));
  assert.equal(suspensions.length, 1);
  assert.equal(suspensions[0].isPermanent, false);
  const expiresAt = Date.parse(successfulActions[0].body.suspensionExpiresAt);
  const suspensionDuration = 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(suspensions[0].expiresAt!.getTime() - expiresAt) < 1000);
  assert.ok(Math.abs(expiresAt - Date.now() - suspensionDuration) < 5000);
});

test("moderation rejects a report linked to a room message by another profile", async () => {
  const reporter = await createProfile("forged-moderation-reporter");
  const actualAuthor = await createProfile("forged-moderation-author");
  const wrongTarget = await createProfile("forged-moderation-target");
  const [message] = await db.insert(roomMessages).values({
    roomId: `forged-moderation-room-${runId}`,
    senderId: actualAuthor.id,
    senderName: "Actual author",
    content: "This message must remain",
  }).returning();
  createdRoomMessageIds.push(message.id);

  const [report] = await db.insert(reports).values({
    reporterId: reporter.id,
    reportedId: wrongTarget.id,
    reportedUserId: wrongTarget.userId,
    reason: "Contenuto inappropriato",
    reportedContentType: "room_message",
    reportedContentId: message.id,
    reportedContentSnapshot: JSON.stringify(message),
  }).returning({ id: reports.id });
  createdReportIds.push(report.id);

  const moderation = await requestJson(
    `/api/admin/reports/${encodeURIComponent(report.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(moderation.statusCode, 409);
  const suspension = await requestJson(
    `/api/admin/reports/${encodeURIComponent(report.id)}/suspend-user`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(suspension.statusCode, 409);
  const [remainingMessage] = await db.select().from(roomMessages)
    .where(eq(roomMessages.id, message.id))
    .limit(1);
  assert.equal(remainingMessage.senderId, actualAuthor.id);
  const [unchangedReport] = await db.select().from(reports)
    .where(eq(reports.id, report.id))
    .limit(1);
  assert.equal(unchangedReport.status, "pending");
  const suspensions = await db.select().from(userSuspensions)
    .where(inArray(userSuspensions.userId, [actualAuthor.userId, wrongTarget.userId]));
  assert.equal(suspensions.length, 0);
});

test("only admins can suspend an author from a pending profile report, once", async () => {
  const reporter = await createProfile("suspension-reporter");
  const author = await createProfile("suspension-author");
  const reportResponse = await requestJson("/api/reports", "POST", {
    reportedId: author.id,
    reason: "Segnalazione del profilo",
  }, { "x-test-user": reporter.userId });
  assert.equal(reportResponse.statusCode, 200);
  createdReportIds.push(reportResponse.body.id);

  const regularUserAction = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/suspend-user`,
    "POST",
    {},
    { "x-test-user": reporter.userId },
  );
  assert.equal(regularUserAction.statusCode, 403);
  assert.equal((await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id)).limit(1))[0].status, "pending");
  assert.equal((await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))).length, 0);

  const missingReport = await requestJson(
    "/api/admin/reports/missing-suspension-report-id/suspend-user",
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(missingReport.statusCode, 404);

  const startedAt = Date.now();
  const action = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/suspend-user`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  const finishedAt = Date.now();
  assert.equal(action.statusCode, 200);
  assert.equal(action.body.authorSuspended, true);

  const [reviewedReport] = await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id)).limit(1);
  assert.equal(reviewedReport.status, "resolved");
  assert.equal(reviewedReport.moderationAction, "author_suspended");
  assert.equal(reviewedReport.moderatedBy, "test-moderator");
  assert.ok(reviewedReport.moderatedAt instanceof Date);
  assert.ok(reviewedReport.moderatedAt.getTime() >= startedAt);
  assert.ok(reviewedReport.moderatedAt.getTime() <= finishedAt);
  assert.equal(reviewedReport.resolvedAt?.getTime(), reviewedReport.moderatedAt.getTime());

  const repeatedAction = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/suspend-user`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(repeatedAction.statusCode, 409);
  assert.equal((await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))).length, 1);
});

test("moderation still resolves a report whose exact room message was deleted earlier", async () => {
  const reporter = await createProfile("already-deleted-reporter");
  const author = await createProfile("already-deleted-author");
  const [message] = await db.insert(roomMessages).values({
    roomId: `already-deleted-room-${runId}`,
    senderId: author.id,
    senderName: "Author",
    content: "Evidence retained after deletion",
  }).returning();
  createdRoomMessageIds.push(message.id);

  const reportResponse = await requestJson("/api/reports", "POST", {
    reportedId: author.id,
    reason: "Contenuto inappropriato",
    reportedContentType: "room_message",
    reportedContentId: message.id,
  }, { "x-test-user": reporter.userId });
  assert.equal(reportResponse.statusCode, 200);
  createdReportIds.push(reportResponse.body.id);
  await db.delete(roomMessages).where(eq(roomMessages.id, message.id));

  const moderation = await requestJson(
    `/api/admin/reports/${encodeURIComponent(reportResponse.body.id)}/remove-and-suspend`,
    "POST",
    {},
    { "x-test-user": "test-moderator" },
  );
  assert.equal(moderation.statusCode, 200);
  assert.equal(moderation.body.contentRemoved, false);
  assert.equal(moderation.body.contentWasAlreadyRemoved, true);
  assert.equal(moderation.body.authorSuspended, true);

  const [reviewedReport] = await db.select().from(reports)
    .where(eq(reports.id, reportResponse.body.id))
    .limit(1);
  assert.equal(reviewedReport.status, "resolved");
  assert.ok(reviewedReport.reportedContentSnapshot);
  assert.equal(reviewedReport.moderationAction, "content_already_removed_and_suspended");
});