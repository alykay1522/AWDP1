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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
 * Send form submission email with structured delivery status tracking.
 * Returns { success, status, messageId, attempts, error? }
 */
export async function sendFormEmail({ type, data }) {
  const maxRetries = 3;
  let lastError = null;
  let messageId = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = getTransporter();

      const to = 'thepolak@wefixitusa.com';
      const from = process.env.SMTP_FROM || 'info@allwindowdoorparts.com';

      let subject, text;

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

      messageId = info.messageId;

      console.log(`[EMAIL_DELIVERY] type=${type} status=success messageId=${messageId} attempts=${attempt} to=thepolak@wefixitusa.com`);

      return {
        success: true,
        status: 'sent',
        messageId,
        attempts: attempt,
      };

    } catch (error) {
      lastError = error;
      console.warn(`[EMAIL_DELIVERY] type=${type} status=retry attempt=${attempt} error=${error.message}`);

      if (attempt < maxRetries && isTransientError(error)) {
        const backoff = Math.pow(2, attempt) * 1000;
        await sleep(backoff);
        continue;
      }

      break;
    }
  }

  // Final failure
  console.error(`[EMAIL_DELIVERY] type=${type} status=failed attempts=${maxRetries} error=${lastError?.message}`);

  // Best-effort admin alert
  try {
    const alertTransporter = getTransporter();
    await alertTransporter.sendMail({
      from: process.env.SMTP_FROM || 'info@allwindowdoorparts.com',
      to: 'thepolak@wefixitusa.com',
      subject: `⚠️ EMAIL DELIVERY FAILED: ${type}`,
      text: `Type: ${type}
Attempts: ${maxRetries}
Error: ${lastError?.message}

Form Data:
${JSON.stringify(data, null, 2)}`,
    });
  } catch (alertErr) {
    console.error(`[EMAIL_DELIVERY] Admin alert failed:`, alertErr.message);
  }

  return {
    success: false,
    status: 'failed',
    error: lastError?.message || 'Unknown SMTP error',
    attempts: maxRetries,
  };
}
