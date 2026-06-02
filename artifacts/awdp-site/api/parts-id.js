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

    if (!data.name || !data.email || !data.description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await sendFormEmail({
      type: "parts-id",
      data,
    });

    return res.status(200).json({ success: true, message: "Parts ID request sent" });
  } catch (error) {
    console.error("Parts ID form error:", error);
    return res.status(500).json({ error: "Failed to send request" });
  }
}
