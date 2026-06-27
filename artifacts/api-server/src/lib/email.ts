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

function esc(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSubmittedAt(date: string | Date): string {
  try {
    return format(new Date(date), "MMMM dd, yyyy hh:mm a");
  } catch {
    return String(date);
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function senderAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "info@allwindowdoorparts.com";
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
  const mailOptions = {
    from: `"All Window Door Parts" <${senderAddress()}>`,
    to: recipient,
    replyTo: submission.email,
    subject: "New Contact Form Submission",
    html,
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
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

  const internalInfo = await transporter.sendMail({
    from: `"All Window Door Parts" <${senderAddress()}>`,
    to: recipient,
    replyTo: submission.email,
    subject: `New Parts ID Request — ${submission.ticketId}`,
    html,
    attachments,
  });

  // Send the customer a confirmation so they know the request and photo were received.
  await transporter.sendMail({
    from: `"All Window Door Parts" <${senderAddress()}>`,
    to: submission.email,
    subject: `We received your Parts ID request — ${submission.ticketId}`,
    html: `
      <h2>We received your Parts ID request</h2>
      <p>Hi ${esc(submission.name)},</p>
      <p>Your request has been received under ticket <strong>${esc(submission.ticketId)}</strong>.</p>
      <p>${submission.imageFileName ? "Your uploaded photo was included with the request." : "No photo was attached. You can reply to this email with photos if needed."}</p>
      <p>Our team will review the information and contact you with the best available match.</p>
      <p>All Window Door Parts<br>785-533-0244</p>
    `,
  });

  return internalInfo;
}
