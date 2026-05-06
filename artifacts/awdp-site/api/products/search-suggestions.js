// FILE: artifacts/awdp-site/api/products/search-suggestions.js
// Vercel Serverless Function — /api/products/search-suggestions

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

  const { q } = req.query;
  if (!q || q.length < 2) return res.status(200).json([]);

  const db = getPool();
  if (!db) return res.status(200).json([]);

  try {
    const result = await db.query(
      `SELECT DISTINCT name FROM products
       WHERE LOWER(name) LIKE $1
       ORDER BY name ASC
       LIMIT 8`,
      [`%${q.toLowerCase()}%`]
    );
    return res.status(200).json(result.rows.map((r) => r.name));
  } catch (err) {
    console.error("[AWDP API] /api/products/search-suggestions error:", err);
    return res.status(200).json([]);
  }
}
