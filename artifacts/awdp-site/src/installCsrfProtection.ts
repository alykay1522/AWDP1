const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_PATH = "/api/admin/csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfTokenPromise: Promise<string> | null = null;

function isBrowserRuntime(): boolean {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

function isUrl(input: RequestInfo | URL): input is URL {
  return typeof URL !== "undefined" && input instanceof URL;
}

function isRequest(input: RequestInfo | URL): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (isRequest(input)) return input.method.toUpperCase();
  return "GET";
}

function resolveSameOriginUrl(input: RequestInfo | URL): URL | null {
  try {
    return new URL(requestUrl(input), window.location.origin);
  } catch {
    return null;
  }
}

function targetsAdminApi(input: RequestInfo | URL): boolean {
  const url = resolveSameOriginUrl(input);
  if (!url) return false;

  return url.origin === window.location.origin && url.pathname.startsWith("/api/admin");
}

function targetsCsrfTokenEndpoint(input: RequestInfo | URL): boolean {
  const url = resolveSameOriginUrl(input);
  return !!url && url.origin === window.location.origin && url.pathname === CSRF_TOKEN_PATH;
}

function mergeHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(isRequest(input) ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

async function loadCsrfToken(fetchImpl: typeof fetch): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchImpl(CSRF_TOKEN_PATH, {
      credentials: "include",
      cache: "no-store",
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load CSRF token (${response.status})`);
        }
        const data = (await response.json()) as { csrfToken?: unknown };
        if (typeof data.csrfToken !== "string" || data.csrfToken.length < 32) {
          throw new Error("Invalid CSRF token response");
        }
        return data.csrfToken;
      })
      .catch((error) => {
        csrfTokenPromise = null;
        throw error;
      });
  }

  return csrfTokenPromise;
}

if (isBrowserRuntime()) {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const method = requestMethod(input, init);

    if (!SAFE_METHODS.has(method) && targetsAdminApi(input) && !targetsCsrfTokenEndpoint(input)) {
      const headers = mergeHeaders(input, init);

      if (!headers.has(CSRF_HEADER_NAME)) {
        headers.set(CSRF_HEADER_NAME, await loadCsrfToken(originalFetch));
      }

      const response = await originalFetch(input, {
        ...init,
        method,
        headers,
        credentials: init.credentials ?? "include",
      });

      if (response.status === 403) {
        csrfTokenPromise = null;
      }
      if (resolveSameOriginUrl(input)?.pathname === "/api/admin/logout") {
        csrfTokenPromise = null;
      }

      return response;
    }

    return originalFetch(input, init);
  };
}
