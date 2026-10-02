import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express, { type RequestHandler } from "express";
import { createServer, request as httpRequest, type Server as HttpServer } from "node:http";
import { eq, inArray } from "drizzle-orm";
import {
  privateRoomMessages,
  privateRoomRequests,
  privateRooms,
  profiles,
  reports,
  roomMessages,
  userSuspensions,
} from "../../shared/schema.js";
import { db } from "../db.js";
import { runMigrations } from "../migrate.js";
import { createAdminAuthorizationMiddleware } from "../routes.js";
import {
  registerReportRemovalRoute,
  registerReportSubmissionRoute,
} from "../report-routes.js";

const runId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const createdProfileIds: string[] = [];
const createdUserIds: string[] = [];
const createdReportIds: string[] = [];
const createdRoomMessageIds: string[] = [];
const createdPrivateRoomMessageIds: string[] = [];
const createdPrivateRoomIds: string[] = [];
const createdPrivateRoomRequestIds: string[] = [];
let server: HttpServer;

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
  registerReportSubmissionRoute(app, testAuthentication, () => {});
  registerReportRemovalRoute(app, testAuthentication, testAdminAuthorization, () => {});
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
  if (createdProfileIds.length) {
    await db.delete(profiles).where(inArray(profiles.id, createdProfileIds));
  }
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
  const unauthorized = await requestJson("/api/reports", "POST", payload);
  assert.equal(unauthorized.statusCode, 401);

  const wrongAuthor = await requestJson("/api/reports", "POST", {
    ...payload,
    reportedId: otherProfile.id,
  }, { "x-test-user": reporter.userId });
  assert.equal(wrongAuthor.statusCode, 400);

  const accepted = await requestJson("/api/reports", "POST", payload, {
    "x-test-user": reporter.userId,
  });
  assert.equal(accepted.statusCode, 200);
  createdReportIds.push(accepted.body.id);
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
  const [suspension] = await db.select().from(userSuspensions)
    .where(eq(userSuspensions.userId, author.userId))
    .limit(1);
  assert.ok(suspension);
  assert.equal(suspension.isPermanent, false);
  assert.equal(suspension.expiresAt?.getTime(), expiresAt);
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