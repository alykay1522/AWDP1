/**
 * Shared Vercel → Express bootstrap (lives outside `/api` so it is not a public route).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveServerlessPath() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // Vercel recommends process.cwd() for assets added via includeFiles; dirname(import.meta.url)
  // breaks when this file is bundled into api/*/[...path].js (extra "api/..." segment).
  const candidates = [
    path.join(process.cwd(), "api-server/dist/serverless.mjs"),
    path.join(process.cwd(), "../api-server/dist/serverless.mjs"),
    path.resolve(here, "../../api-server/dist/serverless.mjs"),
    path.resolve(here, "../api-server/dist/serverless.mjs"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

const resolvedServerlessFsPath = resolveServerlessPath();
const SERVERLESS_HREF = pathToFileURL(resolvedServerlessFsPath).href;

let cachedHandler = null;

const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

function sendJson(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function errMessage(e) {
  return e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
}

function errStack(e) {
  return e && typeof e === "object" && "stack" in e && typeof e.stack === "string"
    ? e.stack.slice(0, 2000)
    : "";
}

function clientErrorPayload(code, message, detail) {
  const body = { error: message, code };
  if (!isProd && detail) body.detail = detail.slice(0, 500);
  return body;
}

export function createAwdpApiHandler(segment) {
  return async function awdpApiEntry(req, res) {
<<<<<<< Updated upstream
=======
    console.error(
      JSON.stringify({
        sessionId: "0e9545",
        hypothesisId: "H-route",
        msg: "awdp-api-segment-entry",
        segment,
        serverlessHref: SERVERLESS_HREF.slice(0, 200),
        resolvedFsPath: resolvedServerlessFsPath.slice(0, 300),
        cwd: typeof process.cwd === "function" ? process.cwd().slice(0, 200) : "",
        method: req.method,
        url: typeof req.url === "string" ? req.url.slice(0, 300) : "",
        ts: Date.now(),
      }),
    );

>>>>>>> Stashed changes
    try {
      console.error(
        JSON.stringify({
          level: "error",
          awdpBridge: true,
          msg: "awdp-api-segment-entry",
          segment,
          serverlessHref: SERVERLESS_HREF.slice(0, 200),
          method: req.method,
          url: typeof req.url === "string" ? req.url.slice(0, 300) : "",
          node: process.version,
          ts: Date.now(),
        }),
      );

      try {
        if (!cachedHandler) {
          const mod = await import(SERVERLESS_HREF);
          if (typeof mod.default !== "function") {
            throw new Error("serverless.mjs default export is not a function");
          }
          cachedHandler = mod.default;
          console.error(
            JSON.stringify({
              level: "error",
              awdpBridge: true,
              msg: "awdp-api-segment-import-ok",
              segment,
              ts: Date.now(),
            }),
          );
        }
      } catch (e) {
        const detail = errMessage(e);
        const stack = errStack(e);
        console.error(
          JSON.stringify({
            level: "error",
            awdpBridge: true,
            msg: "awdp-api-segment-import-fail",
            segment,
            detail: detail.slice(0, 500),
            stack: stack.slice(0, 2000),
            ts: Date.now(),
          }),
        );
        sendJson(
          res,
          503,
          clientErrorPayload(
            "AWDP_API_BUNDLE_LOAD",
            "API bundle failed to load (see Vercel function logs).",
            detail,
          ),
        );
        return;
      }

      try {
        await Promise.resolve(cachedHandler(req, res));
      } catch (e) {
        const detail = errMessage(e);
        const stack = errStack(e);
        console.error(
          JSON.stringify({
            level: "error",
            awdpBridge: true,
            msg: "awdp-api-segment-handler-throw",
            segment,
            detail: detail.slice(0, 500),
            stack: stack.slice(0, 2000),
            ts: Date.now(),
          }),
        );
        sendJson(
          res,
          502,
          clientErrorPayload(
            "AWDP_API_HANDLER",
            "API handler failed (see Vercel function logs).",
            detail,
          ),
        );
      }
    } catch (outer) {
      const detail = errMessage(outer);
      const stack = errStack(outer);
      console.error(
        JSON.stringify({
          level: "error",
          awdpBridge: true,
          msg: "awdp-api-segment-outer-fail",
          segment,
          detail: detail.slice(0, 500),
          stack: stack.slice(0, 2000),
          ts: Date.now(),
        }),
      );
      sendJson(
        res,
        500,
        clientErrorPayload(
          "AWDP_BRIDGE_UNEXPECTED",
          "Unexpected error in API bridge.",
          detail,
        ),
      );
    }
  };
}
