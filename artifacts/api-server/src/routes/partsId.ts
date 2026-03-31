import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/parts-identification", async (req, res) => {
  try {
    const { name, email, phone, description, windowDoorBrand, windowDoorAge, imageFileName } = req.body;

    if (!name || !email || !description) {
      res.status(400).json({ error: "validation_error", message: "Name, email, and description are required" });
      return;
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
