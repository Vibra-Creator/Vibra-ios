import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import {
  createApiRequestLogger,
  createSecurityHeadersMiddleware,
  safeErrorType,
  summarizeClientError,
} from "../http-hardening";
import { createColdMessageCleanupState, markColdMessageCleanupFailed } from "../cold-message-cleanup";
import { createReportCleanupState, markReportCleanupFailed } from "../report-cleanup";

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

test("cleanup health stores an error category, not private exception text", () => {
  const error = new Error("database failure for alice@example.com and private message body");
  const reportState = markReportCleanupFailed(createReportCleanupState(), error);
  const coldMessageState = markColdMessageCleanupFailed(createColdMessageCleanupState(), error);

  assert.equal(reportState.lastError, "Error");
  assert.equal(coldMessageState.lastError, "Error");
  assert.doesNotMatch(JSON.stringify([reportState, coldMessageState]), /alice@example\.com|private message body/);
});

test("enforced CSP allows Replit preview framing and blocks inline scripts", () => {
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
  const csp = headers.get("Content-Security-Policy") || "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'.*https:\/\/\*\.replit\.dev/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /script-src[^;]*unsafe-inline/);
  assert.equal(headers.has("Content-Security-Policy-Report-Only"), false);
  assert.equal(headers.has("X-Frame-Options"), false);
  assert.equal(headers.has("Strict-Transport-Security"), false);
});

test("production CSP restricts framing and includes HTTPS protections", () => {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
  } as unknown as Response;

  createSecurityHeadersMiddleware(true)(
    {} as Request,
    res,
    (() => {}) as NextFunction,
  );

  const csp = headers.get("Content-Security-Policy") || "";
  assert.match(csp, /frame-ancestors 'self'(;|$)/);
  assert.doesNotMatch(csp, /frame-ancestors[^;]*replit/i);
  assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
  assert.match(csp, /https:\/\/www\.tiktok\.com/);
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=31536000");
});

test("the inline script hash matches the static JSON-LD block", () => {
  const html = readFileSync(new URL("../../client/index.html", import.meta.url), "utf8");
  const jsonLd = html.match(/<script\s+type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  assert.ok(jsonLd, "JSON-LD block should remain available to crawlers");
  const hash = `'sha256-${createHash("sha256").update(jsonLd).digest("base64")}'`;
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
  } as unknown as Response;
  createSecurityHeadersMiddleware(true)({} as Request, res, (() => {}) as NextFunction);
  assert.ok((headers.get("Content-Security-Policy") || "").includes(hash));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>/i);
});
