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

    if (!data.name || !data.email || !data.message) {
      return res.status(400).json({ error: "Missing required fields (name, email, message)" });
    }

    const result = await sendFormEmail({ type: "contact", data });

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Message sent successfully",
        emailStatus: result.status,
        messageId: result.messageId,
        attempts: result.attempts,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Failed to send email notification",
        emailStatus: result.status,
        attempts: result.attempts,
      });
    }

  } catch (error) {
    console.error("[contact] Unexpected error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
