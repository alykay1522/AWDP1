import { setBaseUrl } from "@workspace/api-client-react";

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
