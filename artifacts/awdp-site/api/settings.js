// FILE: artifacts/awdp-site/api/settings.js
// Vercel Serverless Function — /api/settings
// Returns site content/settings (hero text, etc.)

import pg from "pg";
const { Pool } = pg;

let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) return null;
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = getPool();
  if (!db) {
    // Return defaults when no DB is configured
    return res.status(200).json({ settings: {} });
  }

  try {
    // Try reading from a settings table if it exists
    const result = await db.query(
      `SELECT key, value FROM settings`
    );
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return res.status(200).json({ settings });
  } catch (err) {
    // Table may not exist — return empty defaults
    console.warn("[AWDP API] /api/settings — table not found or error:", err.message);
    return res.status(200).json({ settings: {} });
  }
}
