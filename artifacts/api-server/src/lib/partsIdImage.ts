const STORED_IMAGE_PREFIX = "awdp-image-json:";
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/i;

export interface StoredPartsIdImage {
  source: string | null;
  name: string;
  contentType: string | null;
  available: boolean;
}

interface StoredPartsIdImagePayload {
  source: string;
  name: string;
  contentType: string;
}

function cleanFileName(value: unknown): string {
  if (typeof value !== "string") return "part-photo.jpg";
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return cleaned || "part-photo.jpg";
}

function isAllowedBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname.endsWith(".public.blob.vercel-storage.com") ||
      url.hostname.endsWith(".blob.vercel-storage.com") ||
      url.hostname === "blob.vercel-storage.com"
    );
  } catch {
    return false;
  }
}

export function serializeStoredPartsIdImage(input: {
  source: string;
  name: string;
  contentType: string;
}): string {
  const payload: StoredPartsIdImagePayload = {
    source: input.source,
    name: cleanFileName(input.name),
    contentType: input.contentType,
  };
  return `${STORED_IMAGE_PREFIX}${JSON.stringify(payload)}`;
}

export function parseStoredPartsIdImage(value: unknown): StoredPartsIdImage | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();

  if (raw.startsWith(STORED_IMAGE_PREFIX)) {
    try {
      const payload = JSON.parse(raw.slice(STORED_IMAGE_PREFIX.length)) as Partial<StoredPartsIdImagePayload>;
      const source = typeof payload.source === "string" ? payload.source.trim() : "";
      const dataMatch = DATA_URL_PATTERN.exec(source);
      const available = Boolean(dataMatch || isAllowedBlobUrl(source));
      return {
        source: available ? source : null,
        name: cleanFileName(payload.name),
        contentType: dataMatch?.[1]?.toLowerCase() || (typeof payload.contentType === "string" ? payload.contentType : null),
        available,
      };
    } catch {
      return null;
    }
  }

  const dataMatch = DATA_URL_PATTERN.exec(raw);
  if (dataMatch) {
    return {
      source: raw,
      name: `part-photo.${dataMatch[1].split("/")[1].replace("jpeg", "jpg")}`,
      contentType: dataMatch[1].toLowerCase(),
      available: true,
    };
  }

  if (isAllowedBlobUrl(raw)) {
    const pathname = new URL(raw).pathname;
    return {
      source: raw,
      name: cleanFileName(pathname.split("/").pop()),
      contentType: null,
      available: true,
    };
  }

  return {
    source: null,
    name: cleanFileName(raw),
    contentType: null,
    available: false,
  };
}

export function decodeInlineImage(source: string): { buffer: Buffer; contentType: string } | null {
  const match = DATA_URL_PATTERN.exec(source.trim());
  if (!match) return null;
  return {
    contentType: match[1].toLowerCase(),
    buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64"),
  };
}
