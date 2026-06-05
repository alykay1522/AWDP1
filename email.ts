import { Resend } from "resend";
import { adminPortalUrl } from "./adminSiteUrl.js";
import { getContactForwardEmails } from "./notifyRecipients.js";

const FROM_ADDRESS = "All Window Door Parts <info@allwindowdoorparts.com>";

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping outbound mail");
    return null;
  }
  return new Resend(apiKey);
}

function formatSubmittedAt(iso?: string | Date | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  return d.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

export async function forwardContactEmail(submission: ContactSubmission): Promise<void> {
  const forwardTo = getContactForwardEmails();
  if (forwardTo.length === 0) {
    console.warn("[email] No valid staff forward addresses — skipping contact forward");
    return;
  }

  const resend = getResendClient();
  if (!resend) return;

  const { name, email, phone, subject, message, submittedAt, submissionId } = submission;
  const subjectLine = subject
    ? `Contact Form: ${subject}`
    : `New Contact Message from ${name}`;
  const adminLink = adminPortalUrl("/admin/contacts");
  const when = formatSubmittedAt(submittedAt);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">
        New Contact Form Submission
      </h2>
      <p style="background: #f0f4ff; border-left: 4px solid #1e3a5f; padding: 10px 14px; margin: 0 0 16px; font-size: 13px;">
        <strong>Submitted:</strong> ${escapeHtml(when)}
        ${submissionId != null ? `<br/><strong>Record ID:</strong> #${submissionId}` : ""}
      </p>
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
        ${phone ? `
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Phone</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="tel:${escapeHtml(phone)}" style="color: #1e3a5f;">${escapeHtml(phone)}</a>
          </td>
        </tr>` : ""}
        ${subject ? `
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Subject</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(subject)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Message</td>
          <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(message)}</td>
        </tr>
      </table>
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(adminLink)}" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View in Admin Portal
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e8eaed; margin: 24px 0;" />
      <p style="color: #666; font-size: 12px; margin: 0;">
        Submitted via allwindowdoorparts.com contact form.<br/>
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: forwardTo,
    reply_to: email,
    subject: subjectLine,
    html,
  });

  if (error) {
    throw new Error(`Resend failed (contact): ${JSON.stringify(error)}`);
  }
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

export async function forwardPartsIdEmail(submission: PartsIdSubmission): Promise<void> {
  const forwardTo = getContactForwardEmails();
  if (forwardTo.length === 0) {
    console.warn("[email] No valid staff forward addresses — skipping parts ID forward");
    return;
  }

  const resend = getResendClient();
  if (!resend) return;

  const {
    ticketId,
    name,
    email,
    phone,
    description,
    windowDoorBrand,
    windowDoorAge,
    imageFileName,
    imageBase64,
    submittedAt,
    submissionId,
  } = submission;

  const adminLink = adminPortalUrl("/admin/parts-id");
  const when = formatSubmittedAt(submittedAt);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">
        New Parts Identification Request
      </h2>
      <p style="background: #f0f4ff; border-left: 4px solid #1e3a5f; padding: 10px 14px; margin: 0 0 16px; font-weight: bold;">
        Ticket ID: ${escapeHtml(ticketId)}
      </p>
      <p style="background: #f5f7fa; padding: 8px 14px; margin: 0 0 16px; font-size: 13px;">
        <strong>Submitted:</strong> ${escapeHtml(when)}
        ${submissionId != null ? `<br/><strong>Record ID:</strong> #${submissionId}` : ""}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; width: 160px; vertical-align: top;">Name</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Email</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="mailto:${escapeHtml(email)}" style="color: #1e3a5f;">${escapeHtml(email)}</a>
          </td>
        </tr>
        ${phone ? `
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Phone</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="tel:${escapeHtml(phone)}" style="color: #1e3a5f;">${escapeHtml(phone)}</a>
          </td>
        </tr>` : ""}
        ${windowDoorBrand ? `
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Brand</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(windowDoorBrand)}</td>
        </tr>` : ""}
        ${windowDoorAge ? `
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Age</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(windowDoorAge)}</td>
        </tr>` : ""}
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Description</td>
          <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(description)}</td>
        </tr>
      </table>
      ${imageFileName ? `
      <div style="margin: 16px 0; padding: 10px 14px; background: #f0f4ff; border-left: 4px solid #1e3a5f;">
        <p style="margin: 0; font-weight: bold; color: #1e3a5f;">Photo attached: ${escapeHtml(imageFileName)}</p>
        <p style="margin: 4px 0 0; font-size: 12px; color: #555;">See the attached image file in this email.</p>
      </div>
      ` : ""}
      <p style="margin: 16px 0;">
        <a href="${escapeHtml(adminLink)}" style="display: inline-block; background: #1e3a5f; color: #fff; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          View in Admin Portal
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e8eaed; margin: 24px 0;" />
      <p style="color: #666; font-size: 12px; margin: 0;">
        Submitted via allwindowdoorparts.com parts identification form.<br/>
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;

  // Build attachments array for Resend
  const attachments: Array<{ filename: string; content: string }> = [];
  if (imageBase64) {
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      const mimeType = match[1];
      const base64Data = match[2];
      const ext = mimeType.split("/")[1] ?? "jpg";
      const filename = imageFileName ?? `photo.${ext}`;
      attachments.push({ filename, content: base64Data });
    }
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: forwardTo,
    reply_to: email,
    subject: `Parts ID Request [${ticketId}] from ${name}`,
    html,
    attachments,
  });

  if (error) {
    throw new Error(`Resend failed (parts ID): ${JSON.stringify(error)}`);
  }
}
