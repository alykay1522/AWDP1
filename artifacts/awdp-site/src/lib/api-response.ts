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
