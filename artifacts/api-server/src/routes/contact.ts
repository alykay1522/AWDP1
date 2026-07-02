import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable } from "@workspace/db/schema";
import { forwardContactEmail } from "../lib/email.js";
import { logger } from "../lib/logger";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body ?? {};
    const cleanName = typeof name === "string" ? name.trim().slice(0, 150) : "";
    const cleanEmail = typeof email === "string" ? email.trim().slice(0, 320) : "";
    const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 80) : undefined;
    const cleanSubject = typeof subject === "string" ? subject.trim().slice(0, 200) : undefined;
    const cleanMessage = typeof message === "string" ? message.trim().slice(0, 5000) : "";

    if (!cleanName || !cleanEmail || !cleanMessage || !cleanEmail.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid name, email address, and message." });
    }

    const submittedAt = new Date();
    const [saved] = await db
      .insert(contactSubmissionsTable)
      .values({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || undefined,
        subject: cleanSubject || undefined,
        message: cleanMessage,
        createdAt: submittedAt,
      })
      .returning({ id: contactSubmissionsTable.id });

    let notificationDelivered = false;
    try {
      await forwardContactEmail({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || undefined,
        subject: cleanSubject || undefined,
        message: cleanMessage,
        submissionId: saved?.id ? String(saved.id) : undefined,
        submittedAt,
      });
      notificationDelivered = true;
    } catch (emailError) {
      logger.error({ err: emailError, submissionId: saved?.id }, "Contact notification email failed after save");
    }

    return res.status(201).json({
      success: true,
      notificationDelivered,
      message: notificationDelivered
        ? "Contact message submitted successfully."
        : "Your message was saved successfully. Email notification is temporarily delayed.",
    });
  } catch (error) {
    logger.error({ err: error }, "Contact form submission failed");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
