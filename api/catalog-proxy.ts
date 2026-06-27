import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../artifacts/api-server/src/serverlessRecovery";

export const config = {
  api: {
    bodyParser: false,
  },
};

type RequestWithUrl = IncomingMessage & { url?: string };

export default async function catalogProxy(
  req: RequestWithUrl,
  res: ServerResponse,
) {
  const requestUrl = new URL(req.url || "/api/catalog-proxy", "https://www.allwindowdoorparts.com");
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
