import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is transient (worth retrying)
 */
function isTransientError(error) {
  const message = error.message?.toLowerCase() || '';
  const code = error.code || '';

  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('temporarily') ||
    message.includes('try again') ||
    message.includes('rate limit')
  );
}

/**
 * Send form submission email with retry logic + admin notification on failure.
 */
export async function sendFormEmail({ type, data }) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = getTransporter();

      const to = 'thepolak@wefixitusa.com';
      const from = process.env.SMTP_FROM || 'info@allwindowdoorparts.com';

      let subject;
      let text;

      if (type === 'contact') {
        subject = `New Contact Form: ${data.subject || data.name}`;
        text = `Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Subject: ${data.subject || 'N/A'}

Message:
${data.message}`;
      } else if (type === 'parts-id') {
        subject = `Parts ID Request from ${data.name}`;
        text = `Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || 'N/A'}
Description: ${data.description}
Brand: ${data.windowDoorBrand || 'N/A'}
Age: ${data.windowDoorAge || 'N/A'}

Image: ${data.imageFileName || 'None attached'}`;
      } else {
        subject = `New form submission (${type})`;
        text = JSON.stringify(data, null, 2);
      }

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        replyTo: data.email,
      });

      console.log(`[email] Successfully sent ${type} form to thepolak@wefixitusa.com (attempt ${attempt}, MessageId: ${info.messageId})`);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      lastError = error;
      console.warn(`[email] Attempt ${attempt}/${maxRetries} failed for ${type}:`, error.message);

      if (attempt < maxRetries && isTransientError(error)) {
        const backoff = Math.pow(2, attempt) * 1000; // exponential backoff
        console.log(`[email] Retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }

      // Non-transient error or max retries reached
      break;
    }
  }

  // All retries failed - notify admin (best effort)
  console.error(`[email] CRITICAL: Failed to send ${type} email after ${maxRetries} attempts`, lastError);

  // Best-effort admin alert (don't throw if this also fails)
  try {
    const alertTransporter = getTransporter();
    await alertTransporter.sendMail({
      from: process.env.SMTP_FROM || 'info@allwindowdoorparts.com',
      to: 'thepolak@wefixitusa.com',
      subject: `⚠️ EMAIL FAILURE: ${type} form submission failed`,
      text: `Failed to deliver ${type} form after ${maxRetries} attempts.

Error: ${lastError?.message || 'Unknown error'}

Form data:
${JSON.stringify(data, null, 2)}`,
    });
    console.log(`[email] Admin alert sent for failed ${type} submission`);
  } catch (alertError) {
    console.error(`[email] Failed to send admin alert:`, alertError.message);
  }

  throw new Error(`Email delivery failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}
