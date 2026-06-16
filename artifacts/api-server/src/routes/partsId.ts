import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { forwardContactEmail, forwardPartsIdEmail } from "../lib/email.js";
import { put } from "@vercel/blob";

const router: IRouter = Router();

function isValidSingleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    value.trim()
  );
}

router.post("/parts-identification", async (req, res) => {
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
      return res.status(400).json({
        error: "validation_error",
        message: "Name, email, and description are required",
      });
    }

    if (!isValidSingleEmail(email)) {
      return res.status(400).json({
        error: "validation_error",
        message: "A valid email address is required.",
      });
    }

    // -----------------------------
    // IMAGE VALIDATION + UPLOAD
    // -----------------------------
    let imageUrl: string | null = null;

    if (imageBase64) {
      const DATA_URI_RE = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i;
      const match = imageBase64.match(DATA_URI_RE);

      if (!match) {
        return res.status(400).json({
          error: "validation_error",
          message: "Image must be a valid base64-encoded data URI.",
        });
      }

      const mime = match[1];
      const base64Data = match[2];

      const ALLOWED_MIME = /^(image\/jpeg|image\/png|image\/webp|image\/gif)$/i;
      if (!ALLOWED_MIME.test(mime)) {
        return res.status(400).json({
          error: "validation_error",
          message: "Only JPEG, PNG, WebP, or GIF images are accepted.",
        });
      }

      const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3));
      if (base64Data.length > MAX_BASE64_CHARS) {
        return res.status(400).json({
          error: "validation_error",
          message: "Image must be smaller than 10 MB.",
        });
      }

      const buffer = Buffer.from(base64Data, "base64");

      const blob = await put(
        `parts-id/${randomUUID()}.${mime.split("/")[1]}`,
        buffer,
        {
          access: "public",
          contentType: mime,
        }
      );

      imageUrl = blob.url;
    }

    // -----------------------------
    // DATABASE INSERT
    // -----------------------------
    const ticketId = `AWDP-${Date.now().toString(36).toUpperCase()}`;

    const [row] = await db
      .insert(partsIdRequestsTable)
      .values({
        ticketId,
        name,
        email,
        phone: phone || null,
        description,
        windowDoorBrand: windowDoorBrand || null,
        windowDoorAge: windowDoorAge || null,
        imageUrl, // <-- STORED HERE
        status: "pending",
      })
      .returning();

    // -----------------------------
    // EMAIL FORWARDING
    // -----------------------------
    forwardPartsIdEmail({
      ticketId,
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageUrl,
      submissionId: row?.id,
      submittedAt: row?.createdAt,
    })
      .then(() => req.log.info("Parts ID email forwarded successfully"))
      .catch((err) =>
        req.log.error({ err }, "Failed to forward parts ID email")
      );

    // -----------------------------
    // RESPONSE
    // -----------------------------
    res.json({
      success: true,
      ticketId,
      message: `Your parts identification request has been submitted! Ticket ID: ${ticketId}. Our experts will review your request and respond within 2-3 business days.`,
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting parts ID request");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to submit request",
    });
  }
});

// -------------------------------------------------------------
// CONTACT FORM (unchanged)
// -------------------------------------------------------------
router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        error: "validation_error",
        message: "Name, email, and message are required",
      });
    }

    if (!isValidSingleEmail(email)) {
      return res.status(400).json({
        error: "validation_error",
        message: "A valid email address is required.",
      });
    }

    const [row] = await db
      .insert(contactSubmissionsTable)
      .values({
        name,
        email,
        phone: phone || null,
        subject: subject || null,
        message,
      })
      .returning();

    forwardContactEmail({
      name,
      email,
      phone,
      subject,
      message,
      submissionId: row?.id,
      submittedAt: row?.createdAt,
    })
      .then(() => req.log.info("Contact email forwarded successfully"))
      .catch((err) =>
        req.log.error({ err }, "Failed to forward contact email")
      );

    res.json({
      success: true,
      message:
        "Thank you for contacting us! We typically respond within 2-3 business days. You can also reach us directly at 785-533-0244.",
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting contact form");
    res.status(500).json({
      error: "internal_error",
      message: "Failed to submit contact form",
    });
  }
});

export default router;
