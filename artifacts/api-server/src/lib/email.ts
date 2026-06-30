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
  name: string;
  email: string;
  phone?: string;
  windowBrand?: string;
  operatorType?: string;
  balanceType?: string;
  lockType?: string;
  rollerType?: string;
  weatherstripType?: string;
  additionalInfo?: string;
  submittedAt: string | Date;
}

function esc(value?: string | null): string {
  return value ? value.replace(/[<>]/g, "") : "";
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
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function forwardContactEmail(submission: ContactSubmission) {
  const html = `
    <h2>New Contact Form Submission</h2>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Message:</strong><br>${esc(submission.message)}</p>
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  const mailOptions = {
    from: `"All Window Door Parts" <${process.env.SMTP_FROM}>`,
    to: process.env.CONTACT_RECIPIENTS,
    subject: "New Contact Form Submission",
    html,
  };

  console.log("📨 Sending contact email to:", process.env.CONTACT_RECIPIENTS);

  const info = await transporter.sendMail(mailOptions);

  console.log("✅ Contact email sent:", info);

  return info;
}

export async function forwardPartsIdEmail(submission: PartsIdSubmission) {
  const html = `
    <h2>New Parts ID Request</h2>
    <p><strong>Name:</strong> ${esc(submission.name)}</p>
    <p><strong>Email:</strong> ${esc(submission.email)}</p>
    <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
    <p><strong>Window Brand:</strong> ${esc(submission.windowBrand)}</p>
    <p><strong>Operator Type:</strong> ${esc(submission.operatorType)}</p>
    <p><strong>Balance Type:</strong> ${esc(submission.balanceType)}</p>
    <p><strong>Lock Type:</strong> ${esc(submission.lockType)}</p>
    <p><strong>Roller Type:</strong> ${esc(submission.rollerType)}</p>
    <p><strong>Weatherstrip Type:</strong> ${esc(submission.weatherstripType)}</p>
    <p><strong>Additional Info:</strong><br>${esc(submission.additionalInfo)}</p>
    <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
  `;

  const mailOptions = {
    from: `"All Window Door Parts" <${process.env.SMTP_FROM}>`,
    to: process.env.PARTSID_RECIPIENTS,
    subject: "New Parts ID Request",
    html,
  };

  console.log("📨 Sending Parts ID email:", mailOptions);

  const info = await transporter.sendMail(mailOptions);

  console.log("✅ Parts ID email sent:", info);

  return info;
}
