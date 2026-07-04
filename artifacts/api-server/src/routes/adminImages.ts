import { Router, type Request, type Response } from "express";
import { del, head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@workspace/db";
import { productImagesTable, productsTable } from "@workspace/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { objectStorageClient, signObjectURL } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_MATCH_SKUS = 500;
const MAX_LINKS = 100;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

function getBucketId(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("Object storage not configured — DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return bucketId;
}

function normalizeSku(value: unknown): string {
  const cleaned = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!cleaned) return "";
  return cleaned.startsWith("AWDP-") ? cleaned : `AWDP-${cleaned}`;
}

function safeFilename(value: unknown): string {
  if (typeof value !== "string") return "product-image.jpg";
  const cleaned = value.trim().slice(0, 180).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "product-image.jpg";
}

function isVercelBlobUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function isProductImagePath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("product-images/") && !value.includes("..");
}

function messageForError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendStorageError(res: Response, error: unknown, operation: string) {
  const message = messageForError(error);
  logger.error({ err: error, operation }, "Admin image storage operation failed");

  if (/BLOB_READ_WRITE_TOKEN|No token|store.*not.*found|not configured/i.test(message)) {
    return res.status(503).json({
      error: "Image storage is not configured",
      detail: "Connect a Vercel Blob store to the project so BLOB_READ_WRITE_TOKEN is available, then redeploy.",
    });
  }

  if (/too large|maximum.*size|size.*limit/i.test(message)) {
    return res.status(413).json({
      error: "Image is too large",
      detail: `Each image must be ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB or smaller. ZIP files must be opened and uploaded by the browser import tool.`,
    });
  }

  return res.status(500).json({
    error: `${operation} failed`,
    ...(process.env.NODE_ENV === "production" ? {} : { detail: message }),
  });
}

// GET /api/admin/images — list all uploaded product images.
router.get("/admin/images", async (_req, res) => {
  try {
    const images = await db.select().from(productImagesTable).orderBy(desc(productImagesTable.uploadedAt));
    res.json({ images });
  } catch (error) {
    logger.error({ err: error }, "Unable to list admin images");
    res.status(500).json({ error: "Unable to load the image library" });
  }
});

// GET /api/admin/images/storage-status — safe diagnostics for the admin UI.
router.get("/admin/images/storage-status", (_req, res) => {
  res.json({
    provider: process.env.BLOB_READ_WRITE_TOKEN ? "vercel-blob" : process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ? "legacy-gcs" : "unconfigured",
    directClientUploads: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    maximumImageBytes: MAX_IMAGE_BYTES,
    maximumImageMegabytes: Math.round(MAX_IMAGE_BYTES / 1024 / 1024),
    zipProcessing: "browser",
  });
});

// POST /api/admin/images/client-upload
// Generates a short-lived Vercel Blob client token. The file body goes directly
// from the browser to Blob and never passes through the Vercel Function request limit.
router.post("/admin/images/client-upload", async (req: Request, res: Response) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      error: "Vercel Blob is not configured",
      detail: "Connect a Blob store to this Vercel project and redeploy before uploading images.",
    });
  }

  try {
    const response = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!isProductImagePath(pathname)) {
          throw new Error("Uploads are restricted to the product-images folder.");
        }
        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return res.json(response);
  } catch (error) {
    return sendStorageError(res, error, "Preparing the direct image upload");
  }
});

// POST /api/admin/images/register-blob
// Records metadata only after Blob confirms the uploaded object exists.
router.post("/admin/images/register-blob", async (req, res) => {
  const filename = safeFilename(req.body?.filename);
  const pathname = req.body?.pathname;
  const url = req.body?.url;

  if (!isProductImagePath(pathname) || !isVercelBlobUrl(url)) {
    return res.status(400).json({ error: "A valid product-image Blob URL and pathname are required." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Vercel Blob is not configured." });
  }

  try {
    const metadata = await head(url);
    if (!metadata || metadata.pathname !== pathname) {
      return res.status(422).json({ error: "Uploaded image could not be verified in storage." });
    }
    if (metadata.size > MAX_IMAGE_BYTES) {
      await del(url).catch(() => undefined);
      return res.status(413).json({ error: "Uploaded image exceeds the 50 MB limit." });
    }
    if (metadata.contentType && !ALLOWED_IMAGE_TYPES.includes(metadata.contentType)) {
      await del(url).catch(() => undefined);
      return res.status(415).json({ error: "Uploaded file is not a supported image type." });
    }

    const [existing] = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.url, url))
      .limit(1);
    if (existing) return res.json({ image: existing, duplicate: true });

    const [image] = await db
      .insert(productImagesTable)
      .values({ filename, objectName: pathname, url })
      .returning();

    return res.status(201).json({ image });
  } catch (error) {
    return sendStorageError(res, error, "Registering the uploaded image");
  }
});

// POST /api/admin/images/match-products — small JSON-only lookup used by browser ZIP analysis.
router.post("/admin/images/match-products", async (req, res) => {
  const rawSkus = Array.isArray(req.body?.skus) ? req.body.skus : [];
  const skus = [...new Set(rawSkus.map(normalizeSku).filter(Boolean))].slice(0, MAX_MATCH_SKUS);
  if (skus.length === 0) return res.json({ products: [], requested: 0 });

  try {
    const products = await db
      .select({ sku: productsTable.sku, imageUrl: productsTable.imageUrl })
      .from(productsTable)
      .where(inArray(productsTable.sku, skus));
    return res.json({ products, requested: skus.length });
  } catch (error) {
    logger.error({ err: error }, "Unable to match image ZIP folders to products");
    return res.status(500).json({ error: "Unable to match image folders to products." });
  }
});

// POST /api/admin/images/link-products — links already-uploaded Blob URLs to product SKUs.
router.post("/admin/images/link-products", async (req, res) => {
  const rawLinks = Array.isArray(req.body?.links) ? req.body.links : [];
  if (rawLinks.length === 0) return res.status(400).json({ error: "At least one image link is required." });
  if (rawLinks.length > MAX_LINKS) {
    return res.status(413).json({ error: `Send no more than ${MAX_LINKS} image links per request.` });
  }

  const links = rawLinks
    .map((entry: unknown) => {
      const value = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      return { sku: normalizeSku(value.sku), imageUrl: value.imageUrl };
    })
    .filter((entry: { sku: string; imageUrl: unknown }): entry is { sku: string; imageUrl: string } => Boolean(entry.sku) && isVercelBlobUrl(entry.imageUrl));

  if (links.length !== rawLinks.length) {
    return res.status(400).json({ error: "Every row must contain a valid SKU and Vercel Blob image URL." });
  }

  try {
    const existing = await db
      .select({ sku: productsTable.sku })
      .from(productsTable)
      .where(inArray(productsTable.sku, links.map((entry) => entry.sku)));
    const existingSkus = new Set(existing.map((entry) => entry.sku));
    let updated = 0;
    const errors: string[] = [];

    for (const link of links) {
      if (!existingSkus.has(link.sku)) continue;
      try {
        await db.update(productsTable).set({ imageUrl: link.imageUrl }).where(eq(productsTable.sku, link.sku));
        updated++;
      } catch (error) {
        errors.push(`${link.sku}: ${messageForError(error)}`);
      }
    }

    return res.json({
      updated,
      notFound: links.length - existingSkus.size,
      failed: errors.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    logger.error({ err: error }, "Unable to link uploaded images to products");
    return res.status(500).json({ error: "Unable to link uploaded images to products." });
  }
});

// Legacy GCS image proxy retained so existing catalog URLs continue to work.
router.get("/admin/images/serve/*objectName", async (req, res) => {
  try {
    const bucketId = getBucketId();
    const raw = req.params.objectName;
    const objectName = Array.isArray(raw) ? raw.join("/") : raw;
    if (!objectName) return res.status(400).json({ error: "objectName required" });

    const file = objectStorageClient.bucket(bucketId).file(objectName);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: "Image not found" });

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    file.createReadStream().pipe(res);
  } catch (error) {
    logger.error({ err: error }, "Unable to serve legacy GCS image");
    res.status(500).json({ error: "Unable to serve image" });
  }
});

// Legacy request-upload endpoint. On Vercel, direct Blob upload is mandatory.
router.post("/admin/images/request-upload", async (req, res) => {
  if (process.env.VERCEL || process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(410).json({
      error: "This upload method has been replaced.",
      detail: "Refresh the admin page and use the direct Vercel Blob uploader.",
    });
  }

  try {
    const { name, contentType } = req.body as { name?: string; contentType?: string };
    if (!name || !contentType) return res.status(400).json({ error: "name and contentType are required" });
    const bucketId = getBucketId();
    const sanitized = safeFilename(name);
    const objectName = `product-images/${Date.now()}-${sanitized}`;
    const uploadURL = await signObjectURL({ bucketName: bucketId, objectName, method: "PUT", ttlSec: 15 * 60 });
    return res.json({ uploadURL, objectName });
  } catch (error) {
    return sendStorageError(res, error, "Preparing the legacy image upload");
  }
});

// Legacy GCS metadata endpoint retained for non-Vercel development environments.
router.post("/admin/images", async (req, res) => {
  try {
    const { filename, objectName } = req.body as { filename?: string; objectName?: string };
    if (!filename || !objectName) return res.status(400).json({ error: "filename and objectName are required" });
    const bucketId = getBucketId();
    const file = objectStorageClient.bucket(bucketId).file(objectName);
    const [exists] = await file.exists();
    if (!exists) return res.status(422).json({ error: "File not found in storage — upload may have failed" });

    const url = `/api/admin/images/serve/${objectName}`;
    const [image] = await db.insert(productImagesTable).values({ filename, objectName, url }).returning();
    return res.status(201).json({ image });
  } catch (error) {
    return sendStorageError(res, error, "Saving the legacy image record");
  }
});

router.delete("/admin/images/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid image ID" });

  try {
    const [row] = await db.select().from(productImagesTable).where(eq(productImagesTable.id, id)).limit(1);
    if (!row) return res.status(404).json({ error: "Image not found" });

    try {
      if (isVercelBlobUrl(row.url)) {
        if (process.env.BLOB_READ_WRITE_TOKEN) await del(row.url);
      } else if (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
        await objectStorageClient.bucket(getBucketId()).file(row.objectName).delete();
      }
    } catch (error) {
      logger.warn({ err: error, imageId: id }, "Image object deletion failed; removing stale database row");
    }

    await db.delete(productImagesTable).where(eq(productImagesTable.id, id));
    return res.json({ deleted: true });
  } catch (error) {
    logger.error({ err: error, imageId: id }, "Unable to delete admin image");
    return res.status(500).json({ error: "Unable to delete image" });
  }
});

export default router;
