import { Router } from "express";
import { Readable } from "stream";
import { db } from "@workspace/db";
import { productImagesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { objectStorageClient, signObjectURL } from "../lib/objectStorage";

const router = Router();

function getBucketId(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("Object storage not configured — DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return bucketId;
}

// GET /api/admin/images — list all uploaded product images
router.get("/admin/images", async (_req, res) => {
  try {
    const images = await db
      .select()
      .from(productImagesTable)
      .orderBy(desc(productImagesTable.uploadedAt));
    res.json({ images });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/images/serve/* — proxy-stream an image from GCS (no signing needed)
// This is used as the stable public URL for product images.
router.get("/admin/images/serve/*objectName", async (req, res) => {
  try {
    const bucketId = getBucketId();
    const raw = req.params.objectName;
    const objectName = Array.isArray(raw) ? raw.join("/") : raw;
    if (!objectName) return res.status(400).json({ error: "objectName required" });

    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: "Image not found" });

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    file.createReadStream().pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/images/request-upload
// Returns a Replit-sidecar-signed PUT URL so the browser can upload directly to GCS
router.post("/admin/images/request-upload", async (req, res) => {
  try {
    const { name, contentType } = req.body as { name?: string; contentType?: string };
    if (!name || !contentType) {
      return res.status(400).json({ error: "name and contentType are required" });
    }

    const bucketId = getBucketId();
    const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectName = `product-images/${Date.now()}-${sanitized}`;

    const uploadURL = await signObjectURL({
      bucketName: bucketId,
      objectName,
      method: "PUT",
      ttlSec: 15 * 60, // 15 minutes
    });

    res.json({ uploadURL, objectName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/images — save image metadata after a successful upload
// The stored URL points to our own proxy route so no signed read URL is needed.
router.post("/admin/images", async (req, res) => {
  try {
    const { filename, objectName } = req.body as { filename?: string; objectName?: string };
    if (!filename || !objectName) {
      return res.status(400).json({ error: "filename and objectName are required" });
    }

    // Verify the file actually landed in GCS
    const bucketId = getBucketId();
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(422).json({ error: "File not found in storage — upload may have failed" });
    }

    // Stable proxy URL — never expires, served through our API
    const url = `/api/admin/images/serve/${objectName}`;

    const [image] = await db
      .insert(productImagesTable)
      .values({ filename, objectName, url })
      .returning();

    res.status(201).json({ image });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/images/:id
router.delete("/admin/images/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.id, id))
      .limit(1);

    if (!row) return res.status(404).json({ error: "Image not found" });

    // Try to delete from GCS (best effort)
    try {
      const bucketId = getBucketId();
      await objectStorageClient.bucket(bucketId).file(row.objectName).delete();
    } catch {
      // ignore GCS errors — still remove from DB
    }

    await db.delete(productImagesTable).where(eq(productImagesTable.id, id));
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
