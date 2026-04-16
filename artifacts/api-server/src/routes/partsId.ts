import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/parts-identification", async (req, res) => {
  try {
    const { name, email, phone, description, windowDoorBrand, windowDoorAge, imageFileName, imageBase64 } = req.body;

    if (!name || !email || !description) {
      res.status(400).json({ error: "validation_error", message: "Name, email, and description are required" });
      return;
    }

    // Server-side image validation
    if (imageBase64) {
      // Must be a valid data URI with image MIME type
      const mimeMatch = (imageBase64 as string).match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (!mime.startsWith("image/")) {
          res.status(400).json({ error: "validation_error", message: "Only image files (JPEG, PNG, WebP, GIF) are accepted." });
          return;
        }
      }
      // Guard against oversized payloads: base64 of a 10 MB file ≈ 13.3 MB chars
      const MAX_BASE64_CHARS = Math.ceil(10 * 1024 * 1024 * (4 / 3));
      const raw = (imageBase64 as string).replace(/^data:[^;]+;base64,/, "");
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

    await db.insert(contactSubmissionsTable).values({
      name,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
    });

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
