import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type RequestHandler } from "express";
import { test } from "node:test";
import { createAdminAuthorizationMiddleware } from "../routes.js";
import {
  ADMIN_BOT_IMAGE_FIX_PATH,
  createAdminBotImageFixHandler,
  registerAdminBotImageFixRoute,
  type BotImageFixProfile,
  type BotImageFixUpdates,
} from "../admin-bot-image-fix.js";

test("only admins can fix bot images and non-bot profiles remain unchanged", async () => {
  const users = new Map([
    ["member-1", { isAdmin: false, email: "member@example.test" }],
    ["admin-1", { isAdmin: true, email: "admin@example.test" }],
  ]);
  const isAdmin = createAdminAuthorizationMiddleware(
    async (userId) => users.get(userId),
    async () => {
      throw new Error("the isolated test must not write to the database");
    },
  );
  const profiles: BotImageFixProfile[] = [
    {
      id: "bot-1",
      isBot: true,
      imageUrl: "/images/bots/bot1.png",
      photos: ["/images/bots/bot1_extra.jpg", "/images/bots/bot1_alt.webp"],
    },
    {
      id: "member-profile-1",
      isBot: false,
      imageUrl: "/images/bots/bot-real-user.png",
      photos: ["/uploads/member-photo.jpg"],
    },
  ];
  const originalProfiles = structuredClone(profiles);
  let profileReads = 0;
  let databaseWrites = 0;
  const imageFixHandler = createAdminBotImageFixHandler({
    getProfiles: async () => {
      profileReads += 1;
      return profiles;
    },
    updateProfile: async (profileId, updates: BotImageFixUpdates) => {
      databaseWrites += 1;
      const profile = profiles.find((candidate) => candidate.id === profileId);
      assert.ok(profile);
      Object.assign(profile, updates);
    },
    countFixedBotImages: async () =>
      profiles.filter(
        (profile) =>
          profile.isBot &&
          profile.imageUrl?.startsWith("/images/bots/bot") &&
          profile.imageUrl.endsWith(".webp"),
      ).length,
  });
  const testAuthentication: RequestHandler = (req, _res, next) => {
    const userId = req.get("x-test-user");
    if (userId) {
      (req as any).user = { claims: { sub: userId } };
    }
    next();
  };
  let handlerCalls = 0;
  const app = express();
  registerAdminBotImageFixRoute(
    app,
    testAuthentication,
    isAdmin as RequestHandler,
    (req, res, next) => {
      handlerCalls += 1;
      return imageFixHandler(req, res, next);
    },
  );

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}${ADMIN_BOT_IMAGE_FIX_PATH}`;

    const unauthenticated = await fetch(url);
    const nonAdmin = await fetch(url, {
      headers: { "x-test-user": "member-1" },
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(nonAdmin.status, 403);
    assert.equal(profileReads, 0, "rejected requests must not read profile data");
    assert.equal(databaseWrites, 0, "rejected requests must not write profile data");
    assert.deepEqual(profiles, originalProfiles);

    const admin = await fetch(url, {
      headers: { "x-test-user": "admin-1" },
    });
    assert.equal(admin.status, 200);
    assert.deepEqual(await admin.json(), { success: true, botsWebp: 1 });
    assert.equal(handlerCalls, 1, "only the admin should reach the handler");
    assert.equal(profileReads, 1);
    assert.equal(databaseWrites, 1, "only the bot profile should be updated");
    assert.deepEqual(profiles, [
      {
        id: "bot-1",
        isBot: true,
        imageUrl: "/images/bots/bot1.webp",
        photos: ["/images/bots/bot1_extra.webp", "/images/bots/bot1_alt.webp"],
      },
      originalProfiles[1],
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});