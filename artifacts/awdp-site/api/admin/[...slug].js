/**
 * Vercel: proxies every /api/admin/* request to the Express API (API_SERVER_ORIGIN).
 * The old api/admin/login.js only checked ADMIN_PASSWORD and never set express-session cookies,
 * so auth-check and the rest of admin could never work on same-origin Vercel + separate API.
 *
 * Vercel env (server): API_SERVER_ORIGIN = https://your-express-host (no trailing slash)
 * Alternative: set VITE_API_BASE_URL at build so the browser hits Express directly (no proxy).
 * If storefront and API are on different sites, set SESSION_COOKIE_SAME_SITE=none on the API.
 */
import { Readable } from "node:stream";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function readBodyBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const base = process.env.API_SERVER_ORIGIN?.trim()?.replace(/\/+$/, "");
  if (!base) {
    return res.status(503).json({
      error:
        "Admin API not configured: set API_SERVER_ORIGIN on Vercel to your Express API origin, or build with VITE_API_BASE_URL so /api calls go to Express.",
    });
  }

  const pathWithQuery = req.url || "/";
  if (!pathWithQuery.startsWith("/api/admin")) {
    return res.status(500).json({ error: "Invalid proxy path" });
  }

  const target = `${base}${pathWithQuery}`;
  const headers = new Headers();

  for (const [key, val] of Object.entries(req.headers)) {
    if (!val) continue;
    const lk = key.toLowerCase();
    if (HOP.has(lk)) continue;
    if (typeof val === "string") headers.set(key, val);
    else for (const v of val) headers.append(key, v);
  }

  headers.set("host", new URL(base).host);

  const xfProto = req.headers["x-forwarded-proto"];
  const xfHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (xfProto) headers.set("x-forwarded-proto", Array.isArray(xfProto) ? xfProto[0] : xfProto);
  if (xfHost) headers.set("x-forwarded-host", Array.isArray(xfHost) ? xfHost[0] : xfHost);

  let body;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    body = await readBodyBuffer(req);
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length ? body : undefined,
      redirect: "manual",
    });
  } catch (e) {
    console.error("[admin proxy] fetch error:", e);
    return res.status(502).json({ error: "Upstream API unreachable" });
  }

  for (const c of upstream.headers.getSetCookie?.() ?? []) {
    res.append("Set-Cookie", c);
  }
  upstream.headers.forEach((value, key) => {
    const lk = key.toLowerCase();
    if (lk === "set-cookie" || HOP.has(lk)) return;
    res.setHeader(key, value);
  });

  res.status(upstream.status);

  if (upstream.status === 304 || upstream.status === 204 || req.method === "HEAD") {
    return res.end();
  }

  if (!upstream.body) {
    return res.end();
  }

  const from = Readable.fromWeb(upstream.body);
  from.on("error", (err) => {
    console.error("[admin proxy] stream error:", err);
    if (!res.writableEnded) res.destroy(err);
  });
  from.pipe(res);
}
