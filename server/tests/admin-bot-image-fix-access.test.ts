import assert from "node:assert/strict";
import { createServer } from "node:http";
import express, { type RequestHandler } from "express";
import { test } from "node:test";
import { createAdminAuthorizationMiddleware } from "../routes.js";
import {
  ADMIN_BOT_IMAGE_FIX_PATH,
  registerAdminBotImageFixRoute,
} from "../admin-bot-image-fix.js";

test("only admins can reach the bot image fix handler", async () => {
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
    (_req, res) => {
      handlerCalls += 1;
      res.json({ success: true });
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
    const admin = await fetch(url, {
      headers: { "x-test-user": "admin-1" },
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(nonAdmin.status, 403);
    assert.equal(admin.status, 200);
    assert.deepEqual(await admin.json(), { success: true });
    assert.equal(handlerCalls, 1, "only the admin should reach the handler");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});