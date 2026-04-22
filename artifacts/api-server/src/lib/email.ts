import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FORWARD_TO = "thepolak@wefixitusa.com";
const FROM_ADDRESS = "noreply@allwindowdoorparts.com";

export interface ContactSubmission {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
}

export async function forwardContactEmail(submission: ContactSubmission): Promise<void> {
  const { name, email, phone, subject, message } = submission;
  const subjectLine = subject
    ? `Contact Form: ${subject}`
    : `New Contact Message from ${name}`;

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
      <hr style="border: none; border-top: 1px solid #e8eaed; margin: 24px 0;" />
      <p style="color: #666; font-size: 12px; margin: 0;">
        Submitted via allwindowdoorparts.com contact form.<br/>
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: FORWARD_TO,
    replyTo: email,
    subject: subjectLine,
    html,
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
