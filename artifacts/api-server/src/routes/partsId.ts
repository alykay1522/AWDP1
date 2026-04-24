import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { forwardContactEmail, forwardPartsIdEmail } from "../lib/email.js";

const router: IRouter = Router();

function isValidSingleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Reject characters used for header injection, address lists, or URI query manipulation
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value.trim());
}

router.post("/parts-identification", async (req, res) => {
  try {
    const { name, email, phone, description, windowDoorBrand, windowDoorAge, imageFileName, imageBase64 } = req.body;

    if (!name || !email || !description) {
      res.status(400).json({ error: "validation_error", message: "Name, email, and description are required" });
      return;
    }

    if (!isValidSingleEmail(email)) {
      res.status(400).json({ error: "validation_error", message: "A valid email address is required." });
      return;
    }

    // Server-side image validation — imageBase64 MUST be a strict data URI with an image MIME type
    // and its payload must contain only valid base64 characters.
    if (imageBase64) {
      const ALLOWED_MIME = /^(image\/jpeg|image\/png|image\/webp|image\/gif)$/;
      const DATA_URI_RE = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/;
      const mimeMatch = (imageBase64 as string).match(DATA_URI_RE);
      if (!mimeMatch) {
        res.status(400).json({ error: "validation_error", message: "Image must be provided as a valid base64-encoded data URI." });
        return;
      }
      const mime = mimeMatch[1];
      if (!ALLOWED_MIME.test(mime)) {
        res.status(400).json({ error: "validation_error", message: "Only image files (JPEG, PNG, WebP, GIF) are accepted." });
        return;
      }
      // Guard against oversized payloads: base64 of a 10 MB file ≈ 13.3 MB chars
      const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3));
      const raw = mimeMatch[2];
      if (raw.length > MAX_BASE64_CHARS) {
        res.status(400).json({ error: "validation_error", message: "Image must be smaller than 10 MB." });
        return;
      }
    }

    const ticketId = `AWDP-${Date.now().toString(36).toUpperCase()}`;

    await db.insert(partsIdRequestsTable).values({
      ticketId,
      name,
      email,
      phone: phone || null,
      description,
      windowDoorBrand: windowDoorBrand || null,
      windowDoorAge: windowDoorAge || null,
      imageFileName: imageFileName || null,
      status: "pending",
    });

    forwardPartsIdEmail({ ticketId, name, email, phone, description, windowDoorBrand, windowDoorAge, imageFileName, imageBase64: imageBase64 || null })
      .then(() => req.log.info("Parts ID email forwarded successfully"))
      .catch((err) => req.log.error({ err }, "Failed to forward parts ID email"));

    res.json({
      success: true,
      ticketId,
      message: `Your parts identification request has been submitted! Ticket ID: ${ticketId}. Our experts will review your request and respond within 1 business day.`,
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting parts ID request");
    res.status(500).json({ error: "internal_error", message: "Failed to submit request" });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      res.status(400).json({ error: "validation_error", message: "Name, email, and message are required" });
      return;
    }

    if (!isValidSingleEmail(email)) {
      res.status(400).json({ error: "validation_error", message: "A valid email address is required." });
      return;
    }

    await db.insert(contactSubmissionsTable).values({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
    });

    forwardContactEmail({ name, email, phone, subject, message })
      .then(() => req.log.info("Contact email forwarded successfully"))
      .catch((err) => req.log.error({ err }, "Failed to forward contact email"));

    res.json({
      success: true,
      message: "Thank you for contacting us! We typically respond within 1 business day. You can also reach us directly at 785-533-0244.",
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting contact form");
    res.status(500).json({ error: "internal_error", message: "Failed to submit contact form" });
  }
});

export default router;
