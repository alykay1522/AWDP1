export const config = {
  api: {
    bodyParser: false,
  },
};

let cachedHandler = null;

function sendJson(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function awdpAdminEntry(req, res) {
  // #region agent log (Vercel Runtime Logs — always search for "awdp-admin-entry")
  console.error(
    JSON.stringify({
      sessionId: "0e9545",
      hypothesisId: "H-entry",
      msg: "awdp-admin-entry",
      method: req.method,
      url: typeof req.url === "string" ? req.url.slice(0, 300) : "",
      ts: Date.now(),
    }),
  );
  // #endregion

  try {
    if (!cachedHandler) {
      const mod = await import("../../../api-server/dist/serverless.mjs");
      if (typeof mod.default !== "function") {
        throw new Error("serverless.mjs default export is not a function");
      }
      cachedHandler = mod.default;
      console.error(
        JSON.stringify({
          sessionId: "0e9545",
          hypothesisId: "H-import",
          msg: "awdp-admin-import-ok",
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
        msg: "awdp-admin-import-fail",
        detail: detail.slice(0, 500),
        ts: Date.now(),
      }),
    );
    sendJson(res, 503, {
      error: "Admin API bundle failed to load",
      detail: detail.slice(0, 500),
    });
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
        msg: "awdp-admin-handler-throw",
        detail: detail.slice(0, 500),
        ts: Date.now(),
      }),
    );
    sendJson(res, 500, {
      error: "Admin API handler threw",
      detail: detail.slice(0, 500),
    });
  }
}
