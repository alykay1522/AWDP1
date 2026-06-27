import type { IncomingMessage, ServerResponse } from "node:http";
import handler from "../artifacts/api-server/src/serverless";
import { ensureCatalogPostNormalized } from "../artifacts/api-server/src/lib/catalogPostNormalize";
import { ensureCatalogSkuGuardV2 } from "../artifacts/api-server/src/lib/catalogSkuGuardV2";

export const config = { api: { bodyParser: false } };

type RequestWithUrl = IncomingMessage & { url?: string };

export default async function catalogNormalizeProxy(
  req: RequestWithUrl,
  res: ServerResponse,
) {
  await ensureCatalogPostNormalized();
  await ensureCatalogSkuGuardV2();

  const requestUrl = new URL(req.url || "/api/catalog-normalize-proxy", "https://www.allwindowdoorparts.com");
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
