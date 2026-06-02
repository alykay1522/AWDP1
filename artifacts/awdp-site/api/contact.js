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

    // Send email - this will throw on failure
    const result = await sendFormEmail({
      type: "contact",
      data,
    });

    return res.status(200).json({ 
      success: true, 
      message: "Message sent successfully",
      messageId: result.messageId 
    });

  } catch (error) {
    console.error("[contact] Email sending failed:", error);
    
    return res.status(500).json({ 
      error: "Failed to send message. Please try again or call 785-533-0244.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
