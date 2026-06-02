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
 * Send form submission email with proper error handling.
 * Only sends to thepolak@wefixitusa.com
 */
export async function sendFormEmail({ type, data }) {
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

    console.log(`[email] Successfully sent ${type} form to thepolak@wefixitusa.com (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error(`[email] Failed to send ${type} email:`, error);
    
    // Re-throw so the API route can handle it properly
    throw new Error(`Email delivery failed: ${error.message || 'Unknown error'}`);
  }
}
