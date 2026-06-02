import { sendFormEmail } from "../lib/email.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const data = req.body;

    // Basic validation
    if (!data.name || !data.email || !data.message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Send email to thepolak@wefixitusa.com
    await sendFormEmail({
      type: "contact",
      data,
    });

    return res.status(200).json({ success: true, message: "Message sent" });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
}
