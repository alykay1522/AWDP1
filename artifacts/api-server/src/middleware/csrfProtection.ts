import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export const CSRF_HEADER_NAME = "x-csrf-token";

const CSRF_COOKIE_NAME = "awdp_csrf";
const CSRF_SESSION_KEY = "csrfToken";
const CSRF_TOKEN_BYTES = 32;
const CSRF_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: isProductionRuntime(),
    sameSite: "lax" as const,
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
    path: "/api/admin",
  };
}

export function getOrCreateCsrfToken(req: Request): string {
  const session = req.session as unknown as Record<string, unknown>;
  const existing = session[CSRF_SESSION_KEY];

  if (typeof existing === "string" && existing.length >= 32) {
    return existing;
  }

  const token = crypto.randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
  session[CSRF_SESSION_KEY] = token;
  return token;
}

export function setCsrfCookie(res: Response, token: string) {
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
}

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/api/admin" });
}

function configuredAllowedOrigins(): Set<string> {
  const values = [
    process.env.SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.AWDP_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    ...(process.env.CORS_ORIGINS?.split(/[\s,]+/) ?? []),
  ];

  const origins = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    try {
      origins.add(new URL(value).origin);
    } catch {
      // Ignore malformed environment values; CORS setup handles those separately.
    }
  }
  return origins;
}

function requestOrigin(req: Request): string | null {
  const host = req.get("host");
  if (!host) return null;
  return `${req.protocol}://${host}`;
}

function originFromHeaderValue(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isAllowedOriginValue(req: Request, value: string): boolean {
  const origin = originFromHeaderValue(value);
  if (!origin) return false;

  const sameOrigin = requestOrigin(req);
  if (sameOrigin && origin === sameOrigin) return true;

  return configuredAllowedOrigins().has(origin);
}

function hasTrustedBrowserOrigin(req: Request): boolean {
  const origin = req.get("origin");
  if (origin) return isAllowedOriginValue(req, origin);

  const referer = req.get("referer");
  if (referer) return isAllowedOriginValue(req, referer);

  // Non-browser clients may omit both headers. They still need the CSRF token.
  return true;
}

function safeTokenEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function submittedCsrfToken(req: Request): string | null {
  const headerToken = req.get(CSRF_HEADER_NAME) || req.get("x-xsrf-token");
  if (headerToken) return headerToken;

  const body = req.body as unknown;
  if (body && typeof body === "object" && typeof (body as Record<string, unknown>)._csrf === "string") {
    return (body as Record<string, string>)._csrf;
  }

  return null;
}

export function requireAdminCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return next();

  // Product images are intentionally public and are served under /api/admin/images/serve/*.
  if (req.path.startsWith("/images/serve/")) return next();

  if (!hasTrustedBrowserOrigin(req)) {
    return res.status(403).json({ error: "CSRF validation failed", detail: "Untrusted request origin." });
  }

  const session = req.session as unknown as Record<string, unknown>;
  const expectedToken = session[CSRF_SESSION_KEY];
  const token = submittedCsrfToken(req);

  if (typeof expectedToken !== "string" || typeof token !== "string" || !safeTokenEqual(expectedToken, token)) {
    return res.status(403).json({ error: "CSRF validation failed", detail: "Missing or invalid CSRF token." });
  }

  return next();
}
