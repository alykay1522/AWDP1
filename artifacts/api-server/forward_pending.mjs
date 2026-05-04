import nodemailer from "nodemailer";
import pg from "pg";

const FROM_ADDRESS = "info@allwindowdoorparts.com";
const DEFAULT_FORWARD_EMAILS = "thepolak@wefixitusa.com,alyshameade.1522@gmail.com";

function isValidSingleForwardEmail(value) {
  const s = value.trim();
  if (!s) return false;
  if (/[,;\r\n\t?&#%]/.test(s)) return false;
  return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(s);
}

/** Same as src/lib/notifyRecipients.ts — CONTACT_FORWARD_EMAILS comma-separated override. */
function getContactForwardEmails() {
  const raw = process.env.CONTACT_FORWARD_EMAILS?.trim();
  const src = raw && raw.length > 0 ? raw : DEFAULT_FORWARD_EMAILS;
  const list = src
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidSingleForwardEmail);
  if (list.length > 0) return list;
  const fromDefault = DEFAULT_FORWARD_EMAILS.split(",")
    .map((s) => s.trim())
    .filter(isValidSingleForwardEmail);
  if (fromDefault.length > 0) return fromDefault;
  return ["thepolak@wefixitusa.com", "alyshameade.1522@gmail.com"];
}

const transporter = nodemailer.createTransport({
  host: "mail.allwindowdoorparts.com",
  port: 465,
  secure: true,
  auth: { user: FROM_ADDRESS, pass: process.env.EMAIL_APP_PASSWORD },
  tls: { rejectUnauthorized: false },
});

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query(`
  SELECT ticket_id, name, email, phone, description, window_door_brand, window_door_age, image_file_name, created_at
  FROM parts_id_requests
  ORDER BY created_at ASC
`);

console.log(`Found ${rows.length} parts ID requests to forward`);

let sent = 0, failed = 0;

for (const row of rows) {
  const { ticket_id, name, email, phone, description, window_door_brand, window_door_age, image_file_name, created_at } = row;
  const submittedAt = new Date(created_at).toLocaleString("en-US", { timeZone: "America/Chicago" });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px;">
        Parts Identification Request (Forwarded)
      </h2>
      <p style="background: #f0f4ff; border-left: 4px solid #1e3a5f; padding: 10px 14px; margin: 0 0 16px; font-weight: bold;">
        Ticket ID: ${escapeHtml(ticket_id)}
      </p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; width: 160px;">Submitted</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(submittedAt)} (CT)</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold;">Name</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold;">Email</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e8eaed;">
            <a href="mailto:${escapeHtml(email)}" style="color:#1e3a5f;">${escapeHtml(email)}</a>
          </td>
        </tr>
        ${phone ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Phone</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ""}
        ${window_door_brand ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Brand</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed;">${escapeHtml(window_door_brand)}</td></tr>` : ""}
        ${window_door_age ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Age</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed;">${escapeHtml(window_door_age)}</td></tr>` : ""}
        ${image_file_name ? `<tr><td style="padding:8px 12px;background:#f5f7fa;font-weight:bold;">Image File</td><td style="padding:8px 12px;border-bottom:1px solid #e8eaed;">${escapeHtml(image_file_name)} (image not available — view in admin panel)</td></tr>` : ""}
        <tr>
          <td style="padding: 8px 12px; background: #f5f7fa; font-weight: bold; vertical-align: top;">Description</td>
          <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(description)}</td>
        </tr>
      </table>
      <hr style="border:none;border-top:1px solid #e8eaed;margin:24px 0;" />
      <p style="color:#666;font-size:12px;margin:0;">
        This is a forwarded copy of a pending parts ID request from allwindowdoorparts.com.<br/>
        Reply directly to this email to respond to ${escapeHtml(name)}.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"All Window Door Parts" <${FROM_ADDRESS}>`,
      to: getContactForwardEmails(),
      replyTo: email,
      subject: `[FORWARDED] Parts ID Request [${ticket_id}] from ${name}`,
      html,
    });
    console.log(`✓ Sent: ${ticket_id} (${name} / ${email})`);
    sent++;
  } catch (err) {
    console.error(`✗ Failed: ${ticket_id} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${sent} sent, ${failed} failed`);
await client.end();
