import nodemailer from "nodemailer";
import { format } from "date-fns";

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string;
  message: string;
  submittedAt: string | Date;
}

export interface PartsIdSubmission {
  ticketId: string;
  name: string;
  email: string;
  phone?: string;
  description: string;
  windowDoorBrand?: string;
  windowDoorAge?: string;
  imageUrl?: string | null;
  imageFileName?: string | null;
  imageBuffer?: Buffer | null;
  imageContentType?: string | null;
  submissionId: string;
  submittedAt: string | Date;
}

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface OutboundMessage {
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

function esc(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSubmittedAt(date: string | Date): string {
  try {
    return format(new Date(date), "MMMM dd, yyyy hh:mm a");
  } catch {
    return String(date);
  }
}

const smtpTimeoutMs = Math.max(3000, Number(process.env.SMTP_TIMEOUT_MS || 7000));
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
  connectionTimeout: smtpTimeoutMs,
  greetingTimeout: smtpTimeoutMs,
  socketTimeout: smtpTimeoutMs,
});

function senderAddress(): string {
  return process.env.SMTP_FROM || process.env.RESEND_FROM || process.env.SMTP_USER || "info@allwindowdoorparts.com";
}

function normalizeRecipients(value: string): string[] {
  return value
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

async function sendWithResend(message: OutboundMessage) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), smtpTimeoutMs);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: `All Window Door Parts <${senderAddress()}>`,
        to: normalizeRecipients(message.to),
        reply_to: message.replyTo,
        subject: message.subject,
        html: message.html,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content.toString("base64"),
          content_type: attachment.contentType,
        })),
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Resend returned ${response.status}${details ? `: ${details.slice(0, 300)}` : ""}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function sendMessage(message: OutboundMessage) {
  if (process.env.RESEND_API_KEY) {
    return sendWithResend(message);
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.");
  }

  return transporter.sendMail({
    from: `"All Window Door Parts" <${senderAddress()}>`,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    html: message.html,
    attachments: message.attachments,
  });
}

export async function forwardContactEmail(submission: ContactSubmission) {
  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Message:</strong><br>${esc(submission.message).replace(/\n/g, "<br>")}</p>
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  const recipient = process.env.CONTACT_RECIPIENTS || senderAddress();
  return sendMessage({
    to: recipient,
    replyTo: submission.email,
    subject: "New Contact Form Submission",
    html,
  });
}

export async function forwardPartsIdEmail(submission: PartsIdSubmission) {
  const imageBlock = submission.imageUrl
    ? `<p><strong>Uploaded Photo:</strong> <a href="${esc(submission.imageUrl)}">Open full-size image</a></p>
       <p><a href="${esc(submission.imageUrl)}"><img src="${esc(submission.imageUrl)}" alt="Customer uploaded part" style="max-width:600px;max-height:500px;border:1px solid #ddd;border-radius:8px"></a></p>`
    : submission.imageFileName
      ? `<p><strong>Uploaded Photo:</strong> ${esc(submission.imageFileName)} (attached to this email)</p>`
      : `<p><strong>Uploaded Photo:</strong> None</p>`;

  const html = `
    <h2>New Parts ID Request</h2>
    <p><strong>Ticket:</strong> ${esc(submission.ticketId)}</p>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Window / Door Brand:</strong> ${esc(submission.windowDoorBrand)}</p>
    <p><strong>Approximate Age:</strong> ${esc(submission.windowDoorAge)}</p>
    <p><strong>Description:</strong><br>${esc(submission.description).replace(/\n/g, "<br>")}</p>
    ${imageBlock}
    <p><strong>Submission ID:</strong> ${esc(submission.submissionId)}</p>
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  const recipient = process.env.PARTSID_RECIPIENTS || process.env.CONTACT_RECIPIENTS || senderAddress();
  const attachments = submission.imageBuffer && submission.imageFileName
    ? [{
        filename: submission.imageFileName,
        content: submission.imageBuffer,
        contentType: submission.imageContentType || undefined,
      }]
    : undefined;

  const internalMessage: OutboundMessage = {
    to: recipient,
    replyTo: submission.email,
    subject: `New Parts ID Request — ${submission.ticketId}`,
    html,
    attachments,
  };

  const confirmationMessage: OutboundMessage = {
    to: submission.email,
    subject: `We received your Parts ID request — ${submission.ticketId}`,
    html: `
      <h2>We received your Parts ID request</h2>
      <p>Hi ${esc(submission.name)},</p>
      <p>Your request has been received under ticket <strong>${esc(submission.ticketId)}</strong>.</p>
      <p>${submission.imageFileName ? "Your uploaded photo was saved with the request." : "No photo was attached. You can reply to this email with photos if needed."}</p>
      <p>Our team will review the information and contact you with the best available match.</p>
      <p>All Window Door Parts<br>785-533-0244</p>
    `,
  };

  const [internalInfo] = await Promise.all([
    sendMessage(internalMessage),
    sendMessage(confirmationMessage),
  ]);

  return internalInfo;
}
