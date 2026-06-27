import handler from "../artifacts/api-server/dist/serverless.mjs";

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Vercel rewrite target for all same-origin API requests.
 *
 * The SPA fallback must never handle /api requests. vercel.json forwards the
 * original API path in __awdp_path; restore it before handing the request to
 * the Express serverless bundle so its existing /api routes continue to work.
 */
export default async function proxy(req, res) {
  const requestUrl = new URL(req.url || "/api/proxy", "https://allwindowdoorparts.com");
  const apiPath = requestUrl.searchParams.get("__awdp_path");
  const rootPath = requestUrl.searchParams.get("__awdp_root");

  requestUrl.searchParams.delete("__awdp_path");
  requestUrl.searchParams.delete("__awdp_root");

  const query = requestUrl.searchParams.toString();
  const restoredPath = rootPath
    ? `/${rootPath.replace(/^\/+/, "")}`
    : `/api/${(apiPath || "").replace(/^\/+/, "")}`;

  req.url = query ? `${restoredPath}?${query}` : restoredPath;

  return handler(req, res);
}
