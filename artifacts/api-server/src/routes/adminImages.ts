import { Router } from "express";
import { db } from "@workspace/db";
import { productImagesTable } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("Object storage not configured — DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return objectStorageClient.bucket(bucketId);
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

// POST /api/admin/images/request-upload
// Returns a presigned PUT URL so the browser can upload directly to GCS
router.post("/admin/images/request-upload", async (req, res) => {
  try {
    const { name, contentType } = req.body as { name?: string; contentType?: string };
    if (!name || !contentType) {
      return res.status(400).json({ error: "name and contentType are required" });
    }

    const bucket = getBucket();
    const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectName = `product-images/${Date.now()}-${sanitized}`;
    const file = bucket.file(objectName);

    const [uploadURL] = await file.getSignedUrl({
      action: "write",
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
    });

    res.json({ uploadURL, objectName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/images — save image metadata after a successful upload
router.post("/admin/images", async (req, res) => {
  try {
    const { filename, objectName } = req.body as { filename?: string; objectName?: string };
    if (!filename || !objectName) {
      return res.status(400).json({ error: "filename and objectName are required" });
    }

    const bucket = getBucket();
    const file = bucket.file(objectName);

    // Generate a long-lived signed read URL (5 years)
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 5 * 365 * 24 * 60 * 60 * 1000,
    });

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
      const bucket = getBucket();
      await bucket.file(row.objectName).delete();
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
