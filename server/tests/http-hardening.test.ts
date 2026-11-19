import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  createApiRequestLogger,
  createSecurityHeadersMiddleware,
  safeErrorType,
  summarizeClientError,
} from "../http-hardening";

test("API request logger emits only a route template and response metadata", () => {
  const messages: string[] = [];
  const req = {
    method: "GET",
    path: "/api/messages/private-user-id",
    route: { path: "/api/messages/:matchId" },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: 200 }) as unknown as Response;

  createApiRequestLogger((message) => messages.push(message))(
    req,
    res,
    (() => {}) as NextFunction,
  );
  res.emit("finish");

  assert.equal(messages.length, 1);
  assert.match(messages[0], /^GET \/api\/messages\/:matchId 200 in \d+ms$/);
  assert.doesNotMatch(messages[0], /private-user-id|message body|profile email/i);
});

test("API logger never falls back to a raw request path", () => {
  const messages: string[] = [];
  const req = {
    method: "GET",
    path: "/api/profiles/private-user-id",
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), { statusCode: 404 }) as unknown as Response;

  createApiRequestLogger((message) => messages.push(message))(
    req,
    res,
    (() => {}) as NextFunction,
  );
  res.emit("finish");

  assert.equal(messages.length, 1);
  assert.match(messages[0], /^GET \/api\/<unmatched> 404 in \d+ms$/);
  assert.doesNotMatch(messages[0], /private-user-id/);
});

test("client error summaries discard message, URL, user agent, and stack content", () => {
  const summary = summarizeClientError({
    scope: "optional feature private-user@example.com",
    name: "TypeError",
    message: "private message body",
    path: "/profile/private-user",
    userAgent: "private device",
    stack: "private stack",
    componentStack: "private component stack",
  });

  assert.deepEqual(summary, { scope: "optional-feature", type: "TypeError" });
  assert.doesNotMatch(JSON.stringify(summary), /private|example\.com/i);
});

test("server error summaries keep only a known error type", () => {
  const summary = safeErrorType(Object.assign(
    new Error("private message for alice@example.com"),
    { stack: "private stack with token" },
  ));

  assert.equal(summary, "Error");
  assert.equal(safeErrorType({ name: "private-user@example.com", message: "secret" }), "Error");
  assert.equal(safeErrorType(new TypeError("private input")), "TypeError");
});

test("security headers are set without breaking Replit development framing", () => {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
  } as unknown as Response;
  let nextCalled = false;

  createSecurityHeadersMiddleware(false)(
    {} as Request,
    res,
    (() => { nextCalled = true; }) as NextFunction,
  );

  assert.equal(nextCalled, true);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("Content-Security-Policy-Report-Only") || "", /default-src 'self'/);
  assert.equal(headers.has("X-Frame-Options"), false);
  assert.equal(headers.has("Strict-Transport-Security"), false);
});

test("production security headers include framing and HTTPS protections", () => {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
  } as unknown as Response;

  createSecurityHeadersMiddleware(true)(
    {} as Request,
    res,
    (() => {}) as NextFunction,
  );

  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=31536000");
});
