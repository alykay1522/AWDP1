/**
 * Vercel: proxies every /api/admin/* request to the Express API (API_SERVER_ORIGIN).
 * The old api/admin/login.js only checked ADMIN_PASSWORD and never set express-session cookies,
 * so auth-check and the rest of admin could never work on same-origin Vercel + separate API.
 *
 * Server env (first non-empty wins for the primary upstream):
 *   API_SERVER_ORIGIN, EXPRESS_API_ORIGIN, or VITE_API_BASE_URL
 * (same value as the Express origin, no trailing slash). Vercel often sets only VITE_* for
 * the build — add the same URL under Production env so serverless can read it for this proxy.
 * If storefront and API are on different sites, set SESSION_COOKIE_SAME_SITE=none on the API.
 *
 * Optional: API_SERVER_ORIGIN_FALLBACK — second origin (no trailing slash). If the primary
 * host fails DNS (ENOTFOUND), the proxy retries once against this origin so you can point
 * production at a working URL (e.g. Railway) while fixing or removing a bad api.* subdomain.
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

function resolveExpressOrigin() {
  for (const key of ["API_SERVER_ORIGIN", "EXPRESS_API_ORIGIN", "VITE_API_BASE_URL"]) {
    const v = process.env[key]?.trim()?.replace(/\/+$/, "");
    if (v) return { origin: v, envKey: key };
  }
  return { origin: "", envKey: "" };
}

function resolveFallbackOrigin() {
  const v = process.env.API_SERVER_ORIGIN_FALLBACK?.trim()?.replace(/\/+$/, "");
  return v || "";
}

/** @param {unknown} e */
function fetchErrorMessage(e) {
  if (e instanceof Error && e.cause instanceof Error && e.cause.message) {
    return e.cause.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

function dnsFailureHint(host, envKey, isFallbackCandidate) {
  if (isFallbackCandidate) {
    return (
      `DNS could not resolve ${host}. Set API_SERVER_ORIGIN_FALLBACK to a hostname that exists in public DNS ` +
      `(your Express HTTPS origin), or fix the primary API_SERVER_ORIGIN / VITE_API_BASE_URL.`
    );
  }
  return (
    `DNS could not resolve ${host}. Either add a public DNS record for that hostname (e.g. CNAME to your API host), ` +
    `or change ${envKey} (and VITE_API_BASE_URL if used for builds) on Vercel to the real HTTPS origin where Express runs ` +
    `(for example your platform URL). Optional: set API_SERVER_ORIGIN_FALLBACK to a working origin for an automatic retry.`
  );
}

export default async function handler(req, res) {
  const { origin: base, envKey } = resolveExpressOrigin();
  if (!base) {
    return res.status(503).json({
      error:
        "Admin API not configured: set API_SERVER_ORIGIN (or EXPRESS_API_ORIGIN, or VITE_API_BASE_URL) on Vercel to your Express API origin (no trailing slash). Ensure the variable is available to Serverless Functions, not only the build. Alternatively build with VITE_API_BASE_URL so the browser calls Express directly.",
    });
  }

  const fallbackBase = resolveFallbackOrigin();
  const originCandidates = [base];
  if (fallbackBase && fallbackBase !== base) originCandidates.push(fallbackBase);

  let originUrl;
  try {
    originUrl = new URL(originCandidates[0]);
  } catch {
    return res.status(503).json({
      error:
        "API_SERVER_ORIGIN is not a valid URL. Use the full origin, e.g. https://your-api.example.com (no trailing slash, no /api path).",
    });
  }
  if (originUrl.pathname !== "/" && originUrl.pathname !== "") {
    return res.status(503).json({
      error:
        "API_SERVER_ORIGIN must be origin only (e.g. https://api.example.com), not a URL with a path. Put /api routes in the request path, not in this variable.",
    });
  }

  const pathWithQuery = req.url || "/";
  if (!pathWithQuery.startsWith("/api/admin")) {
    return res.status(500).json({ error: "Invalid proxy path" });
  }

  const target = `${originUrl.origin}${pathWithQuery}`;
  const headers = new Headers();

  for (const [key, val] of Object.entries(req.headers)) {
    if (!val) continue;
    const lk = key.toLowerCase();
    if (HOP.has(lk)) continue;
    if (typeof val === "string") headers.set(key, val);
    else for (const v of val) headers.append(key, v);
  }

  headers.set("host", originUrl.host);

  const xfProto = req.headers["x-forwarded-proto"];
  const xfHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (xfProto) headers.set("x-forwarded-proto", Array.isArray(xfProto) ? xfProto[0] : xfProto);
  if (xfHost) headers.set("x-forwarded-host", Array.isArray(xfHost) ? xfHost[0] : xfHost);

  let body;
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
    body = await readBodyBuffer(req);
  }

  let upstream;
  let lastErr;
  for (let i = 0; i < originCandidates.length; i++) {
    const cand = originCandidates[i];
    let candUrl;
    try {
      candUrl = new URL(cand);
    } catch {
      continue;
    }
    if (candUrl.pathname !== "/" && candUrl.pathname !== "") continue;

    const targetUrl = `${candUrl.origin}${pathWithQuery}`;
    const h = new Headers(headers);
    h.set("host", candUrl.host);

    try {
      upstream = await fetch(targetUrl, {
        method: req.method,
        headers: h,
        body: body && body.length ? body : undefined,
        redirect: "manual",
      });
      lastErr = undefined;
      break;
    } catch (e) {
      lastErr = e;
      const detail = fetchErrorMessage(e);
      const isDns = /ENOTFOUND|getaddrinfo/i.test(detail);
      console.error("[admin proxy] fetch error:", {
        host: candUrl.host,
        candidateIndex: i,
        detail,
        err: e,
      });
      if (isDns && i + 1 < originCandidates.length) continue;
      const safe = detail.length > 280 ? `${detail.slice(0, 280)}…` : detail;
      let detailOut = safe;
      if (isDns) {
        detailOut = `${safe} ${dnsFailureHint(candUrl.host, i === 0 ? envKey : "API_SERVER_ORIGIN_FALLBACK")}`;
      }
      return res.status(502).json({
        error: "Upstream API unreachable",
        detail: detailOut,
      });
    }
  }

  if (!upstream) {
    const detail = lastErr ? fetchErrorMessage(lastErr) : "No valid upstream origin";
    return res.status(502).json({
      error: "Upstream API unreachable",
      detail,
    });
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
