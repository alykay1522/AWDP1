import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { partsIdRequestsTable } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { forwardPartsIdEmail } from "../lib/email.js";
import { put } from "@vercel/blob";

const router: IRouter = Router();

function isValidSingleEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
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

    // ⭐ Upload image if provided
    if (imageBase64) {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const blob = await put(`parts-id/${submissionId}.png`, buffer, {
        access: "public",
        contentType: "image/png",
      });

      imageUrl = blob.url;
    }

    // ⭐ Save to database
    await db.insert(partsIdRequestsTable).values({
      ticketId,
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageUrl, // ⭐ Save image URL
      status: "pending",
    });

    // ⭐ Send email with image
    await forwardPartsIdEmail({
      ticketId,
      name,
      email,
      phone,
      description,
      windowDoorBrand,
      windowDoorAge,
      imageUrl,
      submissionId,
      submittedAt: new Date(),
    });

    return res.json({
      success: true,
      ticketId,
      imageUrl,
    });
  } catch (err) {
    console.error("❌ Parts ID Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
