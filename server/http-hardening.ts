import type { NextFunction, Request, RequestHandler, Response } from "express";

const CLIENT_ERROR_TYPES = new Set([
  "AggregateError",
  "DOMException",
  "Error",
  "EvalError",
  "NetworkError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);

const SAFE_SERVER_ERROR_TYPES = new Set([
  "AggregateError",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);

/** Keep useful error categories in logs without storing messages or stack data. */
export function safeErrorType(error: unknown): string {
  const name = error && typeof error === "object"
    ? (error as { name?: unknown }).name
    : undefined;
  return typeof name === "string" && SAFE_SERVER_ERROR_TYPES.has(name) ? name : "Error";
}

const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev https://*.replit.app",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://accounts.google.com https://appleid.cdn-apple.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: https://*.tile.openstreetmap.org",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' ws: wss: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.googleapis.com https://storage.googleapis.com https://*.storage.googleapis.com https://app.trysoro.com",
  "frame-src 'self' https://open.spotify.com https://accounts.google.com https://appleid.apple.com",
  "worker-src 'self' blob:",
].join("; ");

/**
 * Return a fixed, non-identifying summary of a client error payload.
 * Error text, URLs, user agents, and stack traces are intentionally discarded.
 */
export function summarizeClientError(body: unknown): {
  scope: "render" | "optional-feature" | "other";
  type: string;
} {
  const input = body && typeof body === "object"
    ? body as Record<string, unknown>
    : {};
  const rawScope = input.scope;
  const scope = rawScope === "render error"
    ? "render"
    : typeof rawScope === "string" && rawScope.startsWith("optional feature ")
      ? "optional-feature"
      : "other";
  const rawName = input.name;
  const type = typeof rawName === "string" && CLIENT_ERROR_TYPES.has(rawName)
    ? rawName
    : "Error";

  return { scope, type };
}

/**
 * Log only the route template, method, status, and duration for API requests.
 * Never inspect or serialize request or response bodies.
 */
export function createApiRequestLogger(
  writeLog: (message: string) => void,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      if (req.path !== "/api" && !req.path.startsWith("/api/")) return;

      const routePath = (req as Request & { route?: { path?: unknown } }).route?.path;
      const safeRoute = typeof routePath === "string" && routePath.startsWith("/api")
        ? routePath
        : "/api/<unmatched>";
      const duration = Date.now() - startedAt;
      writeLog(`${req.method} ${safeRoute} ${res.statusCode} in ${duration}ms`);
    });

    next();
  };
}

/**
 * Apply low-risk security headers immediately and send CSP in report-only mode
 * while the app's inline scripts and third-party resources are checked.
 */
export function createSecurityHeadersMiddleware(
  isProduction = process.env.NODE_ENV === "production",
): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=(self), payment=()",
    );
    res.setHeader("Content-Security-Policy-Report-Only", REPORT_ONLY_CSP);

    // Production is served over HTTPS. Keep these out of development previews,
    // which may be embedded by Replit and can use a different origin.
    if (isProduction) {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
    }

    next();
  };
}
