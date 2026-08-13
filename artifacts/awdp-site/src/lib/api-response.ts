/**
 * Parse API responses without assuming JSON (Vercel/proxies may return plain text
 * e.g. "Request Entity Too Large" on HTTP 413).
 */
export type ParsedApiBody = {
  json: Record<string, unknown> | null;
  text: string;
};

export async function parseApiResponseBody(res: Response): Promise<ParsedApiBody> {
  const text = await res.text().catch(() => "");
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return { json: null, text };
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { json: parsed as Record<string, unknown>, text };
    }
    return { json: null, text };
  } catch {
    return { json: null, text };
  }
}

/**
 * Read a numeric field from an untrusted JSON body.
 * Returns `fallback` for missing/non-finite values, and coerces numeric strings,
 * so callers can safely do arithmetic without `+=` silently producing a string.
 */
export function readNumberField(
  body: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
): number {
  const raw = body?.[key];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : fallback;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** Read a string[] field from an untrusted JSON body, dropping non-string entries. */
export function readStringArrayField(
  body: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const raw = body?.[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/** Read a string field from an untrusted JSON body. */
export function readStringField(
  body: Record<string, unknown> | null | undefined,
  key: string,
  fallback = "",
): string {
  const raw = body?.[key];
  return typeof raw === "string" ? raw : fallback;
}

export function readApiErrorMessage(
  res: Response,
  body: ParsedApiBody,
  fallback: string,
): string {
  const { json, text } = body;
  if (json?.error) return String(json.error);
  if (json?.detail) return String(json.detail);
  if (json?.message) return String(json.message);
  if (json?.code) {
    return `${String(json.code)}: ${json.error ?? fallback}`;
  }

  const plain = text.trim();
  if (plain) {
    return plain.length > 500 ? `${plain.slice(0, 497)}…` : plain;
  }

  if (res.status === 401) {
    return "Session expired — sign in again at /admin/login";
  }
  if (res.status === 413) {
    return "Upload too large (HTTP 413). The server rejected the batch — try a smaller CSV or trim very long description columns.";
  }
  if (res.status === 504 || res.status === 408) {
    return `Request timed out (HTTP ${res.status}). Try a smaller CSV or retry.`;
  }
  return `${fallback} (HTTP ${res.status})`;
}

/** @deprecated Use parseApiResponseBody + readApiErrorMessage */
export async function readImportApiError(res: Response, fallback: string): Promise<string> {
  const body = await parseApiResponseBody(res);
  return readApiErrorMessage(res, body, fallback);
}
