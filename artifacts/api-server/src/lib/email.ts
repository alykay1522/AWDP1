import { Resend } from "resend";
import { adminPortalUrl } from "./adminSiteUrl.js";
import { getContactForwardEmails } from "./notifyRecipients.js";

const FROM_ADDRESS = "All Window Door Parts <info@allwindowdoorparts.com>";

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping outbound mail");
    return null;
  }
  return new Resend(apiKey);
}

function formatSubmittedAt(iso?: string | Date | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
  submittedAt?: string | Date | null;
  submissionId?: number | null;
}

export async function forwardContactEmail(sub: ContactSubmission): Promise<void> {
  const to = getContactForwardEmails();
  if (!to.length) { console.warn("[email] No forward addresses configured"); return; }
  const resend = getResend();
  if (!resend) return;

  const when = formatSubmittedAt(sub.submittedAt);
  const adminLink = adminPortalUrl("/admin/contacts");
  const subjectLine = sub.subject ? `Contact Form: ${sub.subject}` : `New Contact Message from ${sub.name}`;

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <h2 style="color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px">New Contact Form Submission</h2>
    <p style="background:#f0f4ff;border-left:4px solid #1e3a5f;padding:10px 14px;font-size:13px">
      <strong>Submitted:</strong> ${esc(when)}${sub.submissionId != null ? `<br><strong>Record #:</strong> ${sub.submissionId}` : ""}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;width:130px">Name</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed">${esc(sub.name)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Email</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed"><a href="mailto:${esc(sub.email)}">${esc(sub.email)}</a></td></tr>
      ${sub.phone ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed"><a href="tel:${esc(sub.phone)}">${esc(sub.phone)}</a></td></tr>` : ""}
      ${sub.subject ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Subject</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed">${esc(sub.subject)}</td></tr>` : ""}
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;vertical-align:top">Message</td><td style="padding:8px 12px;white-space:pre-wrap">${esc(sub.message)}</td></tr>
    </table>
    <p><a href="${esc(adminLink)}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">View in Admin Portal</a></p>
    <hr style="border:none;border-top:1px solid #e8eaed;margin:24px 0">
    <p style="color:#666;font-size:12px;margin:0">Submitted via allwindowdoorparts.com contact form. Reply to respond to ${esc(sub.name)}.</p>
  </div>`;

  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, reply_to: sub.email, subject: subjectLine, html });
  if (error) throw new Error(`Resend error (contact): ${JSON.stringify(error)}`);
}

export interface PartsIdSubmission {
  ticketId: string;
  name: string;
  email: string;
  phone?: string | null;
  description: string;
  windowDoorBrand?: string | null;
  windowDoorAge?: string | null;
  imageFileName?: string | null;
  imageBase64?: string | null;
  submittedAt?: string | Date | null;
  submissionId?: number | null;
}

export async function forwardPartsIdEmail(sub: PartsIdSubmission): Promise<void> {
  const to = getContactForwardEmails();
  if (!to.length) { console.warn("[email] No forward addresses configured"); return; }
  const resend = getResend();
  if (!resend) return;

  const when = formatSubmittedAt(sub.submittedAt);
  const adminLink = adminPortalUrl("/admin/parts-id");

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <h2 style="color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px">New Parts Identification Request</h2>
    <p style="background:#f0f4ff;border-left:4px solid #1e3a5f;padding:10px 14px;font-weight:bold">Ticket: ${esc(sub.ticketId)}</p>
    <p style="background:#f5f7fa;padding:8px 14px;font-size:13px"><strong>Submitted:</strong> ${esc(when)}${sub.submissionId != null ? `<br><strong>Record #:</strong> ${sub.submissionId}` : ""}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;width:160px">Name</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed">${esc(sub.name)}</td></tr>
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Email</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed"><a href="mailto:${esc(sub.email)}">${esc(sub.email)}</a></td></tr>
      ${sub.phone ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed"><a href="tel:${esc(sub.phone)}">${esc(sub.phone)}</a></td></tr>` : ""}
      ${sub.windowDoorBrand ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Brand</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed">${esc(sub.windowDoorBrand)}</td></tr>` : ""}
      ${sub.windowDoorAge ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold">Age</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed">${esc(sub.windowDoorAge)}</td></tr>` : ""}
      <tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;vertical-align:top">Description</td><td style="padding:8px 12px;white-space:pre-wrap">${esc(sub.description)}</td></tr>
    </table>
    ${sub.imageFileName ? `<div style="margin:16px 0;padding:10px 14px;background:#f0f4ff;border-left:4px solid #1e3a5f"><strong>Photo attached:</strong> ${esc(sub.imageFileName)}</div>` : ""}
    <p><a href="${esc(adminLink)}" style="display:inline-block;background:#1e3a5f;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">View in Admin Portal</a></p>
    <hr style="border:none;border-top:1px solid #e8eaed;margin:24px 0">
    <p style="color:#666;font-size:12px;margin:0">Submitted via allwindowdoorparts.com. Reply to respond to ${esc(sub.name)}.</p>
  </div>`;

  const attachments: Array<{ filename: string; content: string }> = [];
  if (sub.imageBase64) {
    const m = sub.imageBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (m) {
      const ext = m[1].split("/")[1] ?? "jpg";
      attachments.push({ filename: sub.imageFileName ?? `photo.${ext}`, content: m[2] });
    }
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS, to, reply_to: sub.email,
    subject: `Parts ID Request [${sub.ticketId}] from ${sub.name}`,
    html, attachments,
  });
  if (error) throw new Error(`Resend error (parts-id): ${JSON.stringify(error)}`);
}
