// FILE: artifacts/awdp-site/api/login.js
// Vercel Serverless Function — /api/login
// Admin login endpoint — checks password against ADMIN_PASSWORD env var.

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD) {
    console.error("[AWDP API] ADMIN_PASSWORD env var is not set");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password === process.env.ADMIN_PASSWORD) {
    console.log("[AWDP API] Admin login successful");
    return res.status(200).json({ success: true });
  } else {
    console.warn("[AWDP API] Admin login failed — invalid password");
    return res.status(401).json({ error: "Invalid password" });
  }
}
