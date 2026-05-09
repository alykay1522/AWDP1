// Vercel serverless — POST /api/contact (same path as Express partsId router)
import pg from "pg";
import nodemailer from "nodemailer";

const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) return null;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

function isValidSingleEmail(value) {
  if (typeof value !== "string") return false;
  if (/[,;\r\n\t?&#%]/.test(value)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(
    value.trim(),
  );
}

function isValidSingleForwardEmail(value) {
  const s = value.trim();
  if (!s) return false;
  if (/[,;\r\n\t?&#%]/.test(s)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(s);
}

function getContactForwardEmails() {
  const raw = process.env.CONTACT_FORWARD_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidSingleForwardEmail);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FROM_ADDRESS = "info@allwindowdoorparts.com";

async function forwardContactEmail({ name, email, phone, subject, message }) {
  const forwardTo = getContactForwardEmails();
  if (forwardTo.length === 0) {
    console.warn("[AWDP API] /api/contact — no CONTACT_FORWARD_EMAILS; skipping staff forward");
    return;
  }
  const password = process.env.EMAIL_APP_PASSWORD;
  if (!password) {
    console.warn("[AWDP API] /api/contact — EMAIL_APP_PASSWORD unset; skipping staff forward");
    return;
  }
  const subjectLine = subject ? `Contact Form: ${subject}` : `New Contact Message from ${name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">
        New Contact Form Submission
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; width: 130px; vertical-align: top;">Name</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Email</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="mailto:${escapeHtml(email)}" style="color: #1e3a5f;">${escapeHtml(email)}</a>
          </td>
        </tr>
        ${
          phone
            ? `<tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Phone</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="tel:${escapeHtml(phone)}" style="color: #1e3a5f;">${escapeHtml(phone)}</a>
          </td>
        </tr>`
            : ""
        }
        ${
          subject
            ? `<tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Subject</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(subject)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Message</td>
          <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(message)}</td>
        </tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e8eaed; margin: 24px 0;" />
      <p style="color: #666; font-size: 12px; margin: 0;">
        Submitted via allwindowdoorparts.com contact form.<br/>
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;
  const transporter = nodemailer.createTransport({
    host: "mail.allwindowdoorparts.com",
    port: 465,
    secure: true,
    auth: { user: FROM_ADDRESS, pass: password },
    tls: { rejectUnauthorized: true },
  });
  await transporter.sendMail({
    from: `"All Window Door Parts" <${FROM_ADDRESS}>`,
    to: forwardTo,
    replyTo: email,
    subject: subjectLine,
    html,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getPool();
  if (!db) {
    console.error("[AWDP API] /api/contact — DATABASE_URL not set");
    return res.status(500).json({ error: "internal_error", message: "Failed to submit contact form" });
  }

  const { name, email, phone, subject, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: "validation_error", message: "Name, email, and message are required" });
  }
  if (!isValidSingleEmail(email)) {
    return res.status(400).json({ error: "validation_error", message: "A valid email address is required." });
  }

  try {
    await db.query(
      `INSERT INTO contact_submissions (name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, phone || null, subject || null, message],
    );
  } catch (err) {
    console.error("[AWDP API] /api/contact — DB error:", err);
    return res.status(500).json({ error: "internal_error", message: "Failed to submit contact form" });
  }

  forwardContactEmail({ name, email, phone: phone || null, subject: subject || null, message }).catch((err) =>
    console.error("[AWDP API] /api/contact — email forward failed:", err),
  );

  return res.status(200).json({
    success: true,
    message:
      "Thank you for contacting us! We typically respond within 2-3 business days. You can also reach us directly at 785-533-0244.",
  });
}
