/**
 * Shared Vercel → Express bootstrap (lives outside `/api` so it is not a public route).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const SERVERLESS_HREF = pathToFileURL(
  path.resolve(rootDir, "../api-server/dist/serverless.mjs"),
).href;

let cachedHandler = null;

function sendJson(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export function createAwdpApiHandler(segment) {
  return async function awdpApiEntry(req, res) {
    console.error(
      JSON.stringify({
        sessionId: "0e9545",
        hypothesisId: "H-route",
        msg: "awdp-api-segment-entry",
        segment,
        serverlessHref: SERVERLESS_HREF.slice(0, 200),
        method: req.method,
        url: typeof req.url === "string" ? req.url.slice(0, 300) : "",
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
            sessionId: "0e9545",
            hypothesisId: "H-import",
            msg: "awdp-api-segment-import-ok",
            segment,
            ts: Date.now(),
          }),
        );
      }
    } catch (e) {
      const detail = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
      console.error(
        JSON.stringify({
          sessionId: "0e9545",
          hypothesisId: "H-import",
          msg: "awdp-api-segment-import-fail",
          segment,
          detail: detail.slice(0, 500),
          ts: Date.now(),
        }),
      );
      sendJson(res, 503, { error: "API bundle failed to load", detail: detail.slice(0, 500) });
      return;
    }

    try {
      await Promise.resolve(cachedHandler(req, res));
    } catch (e) {
      const detail = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
      console.error(
        JSON.stringify({
          sessionId: "0e9545",
          hypothesisId: "H-handler",
          msg: "awdp-api-segment-handler-throw",
          segment,
          detail: detail.slice(0, 500),
          ts: Date.now(),
        }),
      );
      sendJson(res, 500, { error: "API handler threw", detail: detail.slice(0, 500) });
    }
  };
}
