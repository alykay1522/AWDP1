import { Router, type IRouter, type Response } from "express";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-labelledby="title description">
  <title id="title">Product image unavailable</title>
  <desc id="description">A neutral replacement window and door hardware image placeholder.</desc>
  <rect width="800" height="800" fill="#f8fafc"/>
  <rect x="150" y="150" width="500" height="500" rx="28" fill="#ffffff" stroke="#cbd5e1" stroke-width="10"/>
  <path d="M270 500l95-110 75 75 70-90 95 125H270z" fill="#cbd5e1"/>
  <circle cx="330" cy="300" r="42" fill="#94a3b8"/>
  <text x="400" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#64748b">Image unavailable</text>
</svg>`;

function sendPlaceholder(res: Response, reason: string) {
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.setHeader("X-Robots-Tag", "noindex, noimageindex");
  res.setHeader("X-AWDP-Image-Fallback", reason);
  return res.status(200).send(PLACEHOLDER_SVG);
}

// Public compatibility route for product records that still reference the old GCS proxy.
// It is mounted before authenticated admin routes so catalog images never become 401/500 pages.
router.get("/admin/images/serve/*objectName", async (req, res) => {
  const raw = req.params.objectName;
  const objectName = Array.isArray(raw) ? raw.join("/") : raw;
  if (!objectName || !objectName.startsWith("product-images/") || objectName.includes("..")) {
    return sendPlaceholder(res, "invalid-object-name");
  }

  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) return sendPlaceholder(res, "legacy-storage-unconfigured");

  try {
    const file = objectStorageClient.bucket(bucketId).file(objectName);
    const [exists] = await file.exists();
    if (!exists) return sendPlaceholder(res, "legacy-object-missing");

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", String(metadata.contentType || "image/jpeg"));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return file.createReadStream()
      .on("error", (error) => {
        logger.warn({ err: error, objectName }, "Legacy product image stream failed");
        if (!res.headersSent) sendPlaceholder(res, "legacy-stream-error");
        else res.destroy(error as Error);
      })
      .pipe(res);
  } catch (error) {
    logger.warn({ err: error, objectName }, "Legacy product image lookup failed");
    return sendPlaceholder(res, "legacy-storage-error");
  }
});

export default router;
