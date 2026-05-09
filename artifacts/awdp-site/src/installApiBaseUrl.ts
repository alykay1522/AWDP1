import { setBaseUrl } from "@workspace/api-client-react";

// Vercel: if the project root is the monorepo (not `artifacts/awdp-site`), `/api/*` serverless
// under `artifacts/awdp-site/api/` is not deployed — set VITE_API_BASE_URL at build time to
// your hosted API origin (e.g. Express on Railway) so `/api/...` fetches resolve to JSON, not index.html.
// If VITE_API_BASE_URL is unset, same-origin `/api/admin/*` is proxied by `api/admin/[...slug].js` using
// API_SERVER_ORIGIN, EXPRESS_API_ORIGIN, or VITE_API_BASE_URL on the server (see that file).
const raw = import.meta.env.VITE_API_BASE_URL?.trim();
const base = raw ? raw.replace(/\/+$/, "") : "";

if (base) {
  setBaseUrl(base);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api")) {
      return nativeFetch(base + input, init);
    }
    return nativeFetch(input, init);
  };
}
