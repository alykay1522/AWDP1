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
  submissionId: string;
  name: string;
  email: string;
  phone?: string;
  description: string;
  windowDoorBrand?: string;
  windowDoorAge?: string;
  imageUrl?: string | null;
  submittedAt: string | Date;
}

function esc(value?: string | null): string {
  if (!value) return "";
  const map: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

function formatSubmittedAt(date: string | Date): string {
  try {
    return format(new Date(date), "MMMM dd, yyyy hh:mm a");
  } catch {
    return String(date);
  }
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT ?? "465");

  if (!host || !user || !pass || !Number.isInteger(port) || port <= 0 || port > 65535) {
    console.warn("[email] SMTP is not fully configured; skipping notification");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
  });
}

export async function forwardContactEmail(submission: ContactSubmission) {
  const transporter = createTransporter();
  if (!transporter) return null;

  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Message:</strong><br>${esc(submission.message)}</p>
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  return transporter.sendMail({
    from: `"All Window Door Parts" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: process.env.CONTACT_RECIPIENTS,
    replyTo: submission.email,
    subject: "New Contact Form Submission",
    html,
  });
}

export async function forwardPartsIdEmail(submission: PartsIdSubmission) {
  const transporter = createTransporter();
  if (!transporter) return null;

  const imageHtml = submission.imageUrl
    ? `<p><strong>Image:</strong> <a href="${esc(submission.imageUrl)}">View uploaded image</a></p>`
    : "";

  const html = `
    <h2>New Parts ID Request</h2>
    <p><strong>Ticket ID:</strong> ${esc(submission.ticketId)}</p>
    <p><strong>Submission ID:</strong> ${esc(submission.submissionId)}</p>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Description:</strong><br>${esc(submission.description)}</p>
    <p><strong>Window/Door Brand:</strong> ${esc(submission.windowDoorBrand)}</p>
    <p><strong>Window/Door Age:</strong> ${esc(submission.windowDoorAge)}</p>
    ${imageHtml}
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  return transporter.sendMail({
    from: `"All Window Door Parts" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: process.env.PARTSID_RECIPIENTS || process.env.CONTACT_RECIPIENTS,
    replyTo: submission.email,
    subject: `New Parts ID Request — ${submission.ticketId}`,
    html,
  });
}
