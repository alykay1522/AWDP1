import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { forwardPartsIdEmail } from "../lib/email.js";
import { put } from "@vercel/blob";
import { logger } from "../lib/logger";
import { serializeStoredPartsIdImage } from "../lib/partsIdImage.js";

const router: IRouter = Router();
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp|gif|heic|heif));base64,([A-Za-z0-9+/=\s]+)$/i;

function isValidSingleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

function cleanOptionalText(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, maxLength);
  return cleaned || undefined;
}

function safeFileName(value: unknown, contentType: string): string {
  const extension = contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const fallback = `part-photo.${extension}`;
  if (typeof value !== "string" || !value.trim()) return fallback;

  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return sanitized || fallback;
}

async function handlePartsId(req: Request, res: Response) {
  try {
    const {
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageBase64,
      imageFileName,
    } = req.body ?? {};

    const cleanName = cleanOptionalText(name, 150);
    const cleanDescription = cleanOptionalText(description, 5000);

    if (!cleanName || !email || !cleanDescription) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!isValidSingleEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const ticketId = `PID-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const submissionId = randomUUID();

    let imageUrl: string | null = null;
    let uploadedFileName: string | null = null;
    let imageBuffer: Buffer | null = null;
    let imageContentType: string | null = null;
    let storedImageReference: string | null = null;

    if (typeof imageBase64 === "string" && imageBase64.trim()) {
      const normalizedImageData = imageBase64.trim();
      const match = DATA_URL_PATTERN.exec(normalizedImageData);
      if (!match) {
        return res.status(400).json({ error: "Invalid image data. Please upload a JPEG, PNG, WebP, GIF, HEIC, or HEIF image." });
      }

      imageContentType = match[1].toLowerCase();
      imageBuffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");

      if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "Image must be smaller than 5MB." });
      }

      uploadedFileName = safeFileName(imageFileName, imageContentType);

      if (process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          const blob = await put(`parts-id/${submissionId}/${uploadedFileName}`, imageBuffer, {
            access: "public",
            contentType: imageContentType,
            addRandomSuffix: true,
          });
          imageUrl = blob.url;
        } catch (uploadError) {
          logger.error({ err: uploadError, ticketId }, "Parts ID blob upload failed; storing the validated photo in the database instead");
        }
      } else {
        logger.warn({ ticketId }, "BLOB_READ_WRITE_TOKEN is not configured; storing the validated Parts ID image in the database");
      }

      // Prefer Vercel Blob, but retain a durable inline fallback so an uploaded photo is
      // never lost when storage or email delivery is temporarily unavailable.
      storedImageReference = serializeStoredPartsIdImage({
        source: imageUrl ?? normalizedImageData,
        name: uploadedFileName,
        contentType: imageContentType,
      });
    }

    await db.insert(partsIdRequestsTable).values({
      ticketId,
      name: cleanName,
      email: email.trim(),
      phone: cleanOptionalText(phone, 80),
      description: cleanDescription,
      windowDoorBrand: cleanOptionalText(windowDoorBrand, 150),
      windowDoorAge: cleanOptionalText(windowDoorAge, 80),
      imageFileName: storedImageReference,
      status: "pending",
    });

    let notificationDelivered = false;
    try {
      await forwardPartsIdEmail({
        ticketId,
        name: cleanName,
        email: email.trim(),
        phone: cleanOptionalText(phone, 80),
        description: cleanDescription,
        windowDoorBrand: cleanOptionalText(windowDoorBrand, 150),
        windowDoorAge: cleanOptionalText(windowDoorAge, 80),
        imageUrl,
        imageFileName: uploadedFileName,
        imageBuffer,
        imageContentType,
        submissionId,
        submittedAt: new Date(),
      });
      notificationDelivered = true;
    } catch (emailError) {
      // The request and photo are already safely stored. A mail outage must not discard
      // the customer's submission or make the form appear to have failed.
      logger.error({ err: emailError, ticketId }, "Parts ID notification email failed after request and image were saved");
    }

    return res.status(201).json({
      success: true,
      ticketId,
      imageStored: Boolean(storedImageReference),
      notificationDelivered,
      message: notificationDelivered
        ? "Parts identification request submitted successfully."
        : "Your request and uploaded photo were saved successfully. Email notification is temporarily delayed.",
    });
  } catch (err) {
    logger.error({ err }, "Parts ID request failed");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Keep the legacy endpoint working, and support the endpoint generated from openapi.yaml.
router.post("/parts-identification", handlePartsId);
router.post("/parts-id", handlePartsId);

export default router;
