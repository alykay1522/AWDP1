import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { forwardPartsIdEmail } from "../lib/email.js";
import { put } from "@vercel/blob";

const router: IRouter = Router();
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = {
  png: { mime: "image/png", extension: "png" },
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  jpg: { mime: "image/jpeg", extension: "jpg" },
  webp: { mime: "image/webp", extension: "webp" },
} as const;

function isValidSingleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

function decodeImageDataUri(value: unknown):
  | { buffer: Buffer; mime: string; extension: string }
  | null {
  if (typeof value !== "string") return null;

  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;

  const type = IMAGE_TYPES[match[1].toLowerCase() as keyof typeof IMAGE_TYPES];
  const payload = match[2];
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const estimatedBytes = Math.floor((payload.length * 3) / 4) - padding;
  if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) return null;

  const buffer = Buffer.from(payload, "base64");
  if (buffer.length <= 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  return { buffer, mime: type.mime, extension: type.extension };
}

router.post(["/parts-id", "/parts-identification"], async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageBase64,
    } = req.body;

    if (!name || !email || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!isValidSingleEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const ticketId = `PID-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const submissionId = randomUUID();
    let imageUrl: string | null = null;

    if (imageBase64 !== undefined && imageBase64 !== null && imageBase64 !== "") {
      const image = decodeImageDataUri(imageBase64);
      if (!image) {
        return res.status(400).json({
          error: "Image must be a valid PNG, JPEG, or WebP data URI no larger than 8 MB",
        });
      }

      const blob = await put(
        `parts-id/${submissionId}.${image.extension}`,
        image.buffer,
        { access: "public", contentType: image.mime },
      );
      imageUrl = blob.url;
    }

    await db.insert(partsIdRequestsTable).values({
      ticketId,
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageUrl,
      status: "pending",
    });

    try {
      await forwardPartsIdEmail({
        ticketId,
        submissionId,
        name,
        email,
        phone,
        description,
        windowDoorBrand,
        windowDoorAge,
        imageUrl,
        submittedAt: new Date(),
      });
    } catch (emailError) {
      console.error("Parts ID request saved, but notification email failed:", emailError);
    }

    return res.json({ success: true, ticketId, imageUrl });
  } catch (err) {
    console.error("Parts ID Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
