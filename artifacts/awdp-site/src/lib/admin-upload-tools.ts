import JSZip, { type JSZipObject } from "jszip";
import { upload } from "@vercel/blob/client";

export type CsvRow = Record<string, string>;

export type ProductMatch = {
  sku: string;
  imageUrl: string | null;
};

export type ProductImageLink = {
  sku: string;
  imageUrl: string;
};

export type ZipImageEntry = {
  path: string;
  basename: string;
  parent: string;
  stem: string;
  zipObject: JSZipObject;
};

export type AdminBlobResult = {
  url: string;
  downloadUrl?: string;
  pathname: string;
  contentType?: string;
};

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_ZIP_BYTES = 1024 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 20_000;
const MAX_DECLARED_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_FILE_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

function compactKey(value: string): string {
  return value.toLowerCase().replace(/[\s\-_.]+/g, "");
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function parseCsv(text: string): CsvRow[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index++) {
    const character = normalized[index];
    if (inQuotes) {
      if (character === '"' && normalized[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') inQuotes = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const result: CsvRow = {};
    headers.forEach((header, index) => {
      result[header] = values[index] ?? "";
    });
    return result;
  });
}

export function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function pickRowValue(row: CsvRow, aliases: string[]): string {
  const lookup = new Map(Object.entries(row).map(([key, value]) => [compactKey(key), value]));
  for (const alias of aliases) {
    const value = lookup.get(compactKey(alias));
    if (value?.trim()) return value.trim();
  }
  return "";
}

export function rawSkuFromRow(row: CsvRow): string {
  return pickRowValue(row, [
    "sku", "awdp sku", "part number", "part no", "part num", "item number", "item no",
    "catalog number", "catalog no", "code", "id", "number", "part", "item",
  ]);
}

export function normalizeSku(value: string): string {
  const cleaned = value.trim().toUpperCase();
  if (!cleaned) return "";
  return cleaned.startsWith("AWDP-") ? cleaned : `AWDP-${cleaned}`;
}

function archiveToken(value: string): string {
  return value
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/^awdp[-_ ]*/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeArchivePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").toLowerCase();
}

export function localImageReference(row: CsvRow): string {
  const aliases = new Set([
    "image", "imagefile", "imagepath", "imageurl", "imagelink", "photo", "photourl",
    "picture", "pictureurl", "thumbnail", "thumbnailurl", "img", "imgurl", "productimage",
    "productphoto", "productimageurl", "mainimage", "primaryimage",
  ]);
  for (const [key, value] of Object.entries(row)) {
    if (!aliases.has(compactKey(key))) continue;
    const trimmed = value.trim();
    if (!trimmed || /^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith("/api/")) continue;
    return trimmed;
  }
  return "";
}

export function prepareProductRow(row: CsvRow): CsvRow {
  const prepared = { ...row };
  const rawSku = rawSkuFromRow(row);
  if (rawSku) prepared.sku = normalizeSku(rawSku);

  for (const key of Object.keys(prepared)) {
    if (!/^(image|photo|picture|thumbnail|img|productimage|productphoto|mainimage|primaryimage)/i.test(compactKey(key))) continue;
    const value = prepared[key]?.trim() ?? "";
    if (value && !/^(https?:)?\/\//i.test(value) && !value.startsWith("/api/")) prepared[key] = "";
  }
  return prepared;
}

function imageExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function contentTypeFor(filename: string): string {
  return {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
  }[imageExtension(filename)] ?? "application/octet-stream";
}

function inspectZipCentralDirectory(buffer: ArrayBuffer): { entryCount: number; declaredTotal: number } {
  const view = new DataView(buffer);
  if (view.byteLength < 22) throw new Error("ZIP is truncated or invalid.");

  const earliestEocd = Math.max(0, view.byteLength - 22 - 0xffff);
  let eocdOffset = -1;
  for (let offset = view.byteLength - 22; offset >= earliestEocd; offset--) {
    if (view.getUint32(offset, true) !== ZIP_EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === view.byteLength) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIP central directory could not be found. The archive may be damaged.");

  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralSize = view.getUint32(eocdOffset + 12, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error("Multi-volume ZIP archives are not supported. Create a single ZIP file.");
  }
  if (entryCount === ZIP64_SENTINEL_16 || centralSize === ZIP64_SENTINEL_32 || centralOffset === ZIP64_SENTINEL_32) {
    throw new Error("ZIP64 archives are not supported by this browser importer. Split the archive into smaller standard ZIP files.");
  }
  if (entryCount > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP contains ${entryCount.toLocaleString()} entries; the safe limit is ${MAX_ZIP_ENTRIES.toLocaleString()}.`);
  }
  if (centralOffset + centralSize > view.byteLength) throw new Error("ZIP central directory is outside the archive bounds.");

  let offset = centralOffset;
  let declaredTotal = 0;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== ZIP_CENTRAL_FILE_SIGNATURE) {
      throw new Error(`ZIP central directory entry ${index + 1} is invalid.`);
    }

    const flags = view.getUint16(offset + 8, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    if ((flags & 0x0001) !== 0) throw new Error("Password-protected ZIP archives are not supported.");
    if (uncompressedSize === ZIP64_SENTINEL_32) {
      throw new Error("ZIP64 entries are not supported. Split the archive into smaller standard ZIP files.");
    }

    declaredTotal += uncompressedSize;
    if (declaredTotal > MAX_DECLARED_UNCOMPRESSED_BYTES) {
      throw new Error(`ZIP expands beyond ${formatBytes(MAX_DECLARED_UNCOMPRESSED_BYTES)}; split it into smaller archives.`);
    }

    const nextOffset = offset + 46 + filenameLength + extraLength + commentLength;
    if (nextOffset <= offset || nextOffset > view.byteLength) throw new Error("ZIP central directory contains an invalid entry length.");
    offset = nextOffset;
  }

  return { entryCount, declaredTotal };
}

export async function loadZipArchive(file: File): Promise<JSZip> {
  if (!file.name.toLowerCase().endsWith(".zip")) throw new Error("Choose a ZIP archive.");
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(`ZIP is ${formatBytes(file.size)}. Split archives larger than ${formatBytes(MAX_ZIP_BYTES)} into smaller packages.`);
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new Error(`Your browser could not load this ${formatBytes(file.size)} ZIP into memory. Split it into smaller archives and retry.`);
  }

  const inspection = inspectZipCentralDirectory(buffer);
  if (file.size > 0 && inspection.declaredTotal > 250 * 1024 * 1024 && inspection.declaredTotal / file.size > 200) {
    throw new Error("ZIP has a suspicious compression ratio and was rejected for safety.");
  }

  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error(`ZIP contains too many entries; the safe limit is ${MAX_ZIP_ENTRIES.toLocaleString()}.`);
  }
  return zip;
}

function imageRank(entry: ZipImageEntry): number {
  const lower = entry.basename.toLowerCase();
  let score = 0;
  if (/thumb|thumbnail|small|_sm|-sm|icon/.test(lower)) score += 100;
  if (/main|primary|hero|large|front/.test(lower)) score -= 20;
  const extension = imageExtension(lower);
  if (extension === "jpg" || extension === "jpeg") score += 0;
  else if (extension === "webp" || extension === "avif") score += 1;
  else if (extension === "png") score += 2;
  else score += 3;
  return score * 10_000 + lower.length;
}

export function buildZipImages(zip: JSZip): ZipImageEntry[] {
  return Object.values(zip.files)
    .filter((entry) => !entry.dir && !entry.name.startsWith("__MACOSX/") && !entry.name.endsWith(".DS_Store"))
    .map((entry) => {
      const normalizedPath = entry.name.replace(/\\/g, "/");
      const segments = normalizedPath.split("/").filter(Boolean);
      const basename = segments.pop() ?? normalizedPath;
      const extension = imageExtension(basename);
      if (!IMAGE_EXTENSIONS.has(extension)) return null;
      const parent = segments.pop() ?? basename.replace(/\.[^.]+$/, "");
      return {
        path: normalizedPath,
        basename,
        parent,
        stem: basename.replace(/\.[^.]+$/, ""),
        zipObject: entry,
      };
    })
    .filter((entry): entry is ZipImageEntry => entry !== null);
}

export function chooseImagesByFolder(images: ZipImageEntry[]): Map<string, ZipImageEntry> {
  const grouped = new Map<string, ZipImageEntry[]>();
  for (const image of images) {
    const folder = image.parent.replace(/\s*\(\d+\)\s*$/, "").trim();
    if (!folder) continue;
    const current = grouped.get(folder) ?? [];
    current.push(image);
    grouped.set(folder, current);
  }

  return new Map(
    [...grouped.entries()].map(([folder, entries]) => [folder, [...entries].sort((a, b) => imageRank(a) - imageRank(b))[0]]),
  );
}

export function findImageForRow(row: CsvRow, images: ZipImageEntry[]): ZipImageEntry | null {
  const rawSku = rawSkuFromRow(row);
  if (!rawSku) return null;
  const explicit = localImageReference(row);
  if (explicit) {
    const explicitPath = normalizeArchivePath(explicit);
    const byPath = images.find((image) => normalizeArchivePath(image.path) === explicitPath);
    if (byPath) return byPath;
    const explicitBase = explicitPath.split("/").pop();
    const byBase = images.find((image) => image.basename.toLowerCase() === explicitBase);
    if (byBase) return byBase;
  }

  const tokens = new Set([archiveToken(rawSku), archiveToken(normalizeSku(rawSku))].filter(Boolean));
  const candidates = images.filter((image) => tokens.has(archiveToken(image.parent)) || tokens.has(archiveToken(image.stem)));
  return candidates.length ? [...candidates].sort((a, b) => imageRank(a) - imageRank(b))[0] : null;
}

function safeFilename(filename: string): string {
  const sanitized = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "product-image.jpg";
}

export async function uploadAdminImage(
  body: Blob,
  filename: string,
  options: { sku?: string; onProgress?: (percentage: number) => void } = {},
): Promise<AdminBlobResult> {
  if (!body.size) throw new Error(`${filename} is empty.`);
  if (body.size > MAX_IMAGE_BYTES) {
    throw new Error(`${filename} is ${formatBytes(body.size)}; the per-image limit is ${formatBytes(MAX_IMAGE_BYTES)}.`);
  }
  const extension = imageExtension(filename);
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${filename} is not a supported image. Use JPEG, PNG, WebP, GIF, or AVIF.`);
  }

  const cleanSku = options.sku ? normalizeSku(options.sku).replace(/[^A-Z0-9_-]/g, "-") : "unassigned";
  const pathname = `product-images/${cleanSku}/${Date.now()}-${safeFilename(filename)}`;
  const result = await upload(pathname, body, {
    access: "public",
    handleUploadUrl: "/api/admin/images/client-upload",
    contentType: contentTypeFor(filename),
    multipart: body.size >= 5 * 1024 * 1024,
    onUploadProgress(event) {
      options.onProgress?.(Math.max(0, Math.min(100, Math.round(event.percentage))));
    },
  });

  const registerResponse = await fetch("/api/admin/images/register-blob", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, pathname: result.pathname, url: result.url }),
  });
  const registerBody = await registerResponse.json().catch(() => ({}));
  if (!registerResponse.ok) {
    throw new Error(registerBody.error ?? `Uploaded ${filename}, but could not register it in the image library.`);
  }

  return result as AdminBlobResult;
}

export async function uploadZipImage(
  sku: string,
  entry: ZipImageEntry,
  onProgress?: (percentage: number) => void,
): Promise<AdminBlobResult> {
  const blob = await entry.zipObject.async("blob");
  return uploadAdminImage(blob, entry.basename, { sku, onProgress });
}

export async function matchProducts(skus: string[]): Promise<Map<string, ProductMatch>> {
  const unique = [...new Set(skus.map(normalizeSku).filter(Boolean))];
  const matches = new Map<string, ProductMatch>();
  for (let index = 0; index < unique.length; index += 500) {
    const response = await fetch("/api/admin/images/match-products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skus: unique.slice(index, index + 500) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Unable to match image folders to products.");
    for (const product of Array.isArray(body.products) ? body.products : []) {
      matches.set(String(product.sku), { sku: String(product.sku), imageUrl: product.imageUrl ? String(product.imageUrl) : null });
    }
  }
  return matches;
}

export async function linkProductImages(links: ProductImageLink[]): Promise<{ updated: number; notFound: number; errors: string[] }> {
  const unique = [...new Map(links.map((link) => [normalizeSku(link.sku), { sku: normalizeSku(link.sku), imageUrl: link.imageUrl }])).values()];
  const totals = { updated: 0, notFound: 0, errors: [] as string[] };
  for (let index = 0; index < unique.length; index += 100) {
    const response = await fetch("/api/admin/images/link-products", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links: unique.slice(index, index + 100) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Unable to link uploaded images to products.");
    totals.updated += Number(body.updated ?? 0);
    totals.notFound += Number(body.notFound ?? 0);
    if (Array.isArray(body.errors)) totals.errors.push(...body.errors.map(String));
  }
  return totals;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => runner()));
  return results;
}
