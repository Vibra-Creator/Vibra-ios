import assert from "node:assert/strict";
import test from "node:test";
import { createAdminAuthorizationMiddleware } from "../routes.js";
import { isAdminEmail, shouldPromoteVerifiedAdmin } from "../admin-access";

test("the existing admin email allowlist matches case and surrounding whitespace", () => {
  assert.equal(isAdminEmail("famax61@gmail.com"), true);
  assert.equal(isAdminEmail("  FAMAX61@GMAIL.COM  "), true);
  assert.equal(isAdminEmail("someone@example.test"), false);
  assert.equal(isAdminEmail(null), false);
});

test("automatic admin promotion requires a verified allowlisted account", () => {
  assert.equal(shouldPromoteVerifiedAdmin({
    email: "famax61@gmail.com",
    emailVerified: true,
    isAdmin: false,
  }), true);

  assert.equal(shouldPromoteVerifiedAdmin({
    email: "famax61@gmail.com",
    emailVerified: false,
    isAdmin: false,
  }), false);

  assert.equal(shouldPromoteVerifiedAdmin({
    email: "someone@example.test",
    emailVerified: true,
    isAdmin: false,
  }), false);

  assert.equal(shouldPromoteVerifiedAdmin({
    email: "famax61@gmail.com",
    emailVerified: true,
    isAdmin: true,
  }), false);
});

test("admin routes promote only verified allowlisted accounts", async () => {
  const users = new Map([
    ["verified", { email: "famax61@gmail.com", emailVerified: true, isAdmin: false }],
    ["unverified", { email: "famax61@gmail.com", emailVerified: false, isAdmin: false }],
  ]);
  const promoted: string[] = [];
  const middleware = createAdminAuthorizationMiddleware(
    async (userId) => users.get(userId),
    async (userId) => {
      promoted.push(userId);
      const user = users.get(userId);
      if (user) user.isAdmin = true;
    },
  );

  async function check(userId: string) {
    const response: {
      statusCode: number;
      body?: unknown;
      status(code: number): typeof response;
      json(body: unknown): typeof response;
    } = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let nextCalled = false;
    await middleware(
      { user: { claims: { sub: userId } } } as never,
      response as never,
      () => {
        nextCalled = true;
      },
    );
    return { response, nextCalled };
  }

  const verifiedResult = await check("verified");
  assert.equal(verifiedResult.nextCalled, true);
  assert.equal(users.get("verified")?.isAdmin, true);

  const unverifiedResult = await check("unverified");
  assert.equal(unverifiedResult.response.statusCode, 403);
  assert.equal(unverifiedResult.nextCalled, false);
  assert.deepEqual(promoted, ["verified"]);
});
