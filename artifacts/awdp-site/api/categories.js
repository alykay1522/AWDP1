// FILE: artifacts/awdp-site/api/categories.js
// Vercel Serverless Function — /api/categories
// Returns distinct product categories from the database.

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
    return res.status(200).json([]);
  }

  try {
    const result = await db.query(
      `SELECT DISTINCT category, COUNT(*) AS count
       FROM products
       WHERE category IS NOT NULL AND category != ''
       GROUP BY category
       ORDER BY category ASC`
    );
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("[AWDP API] /api/categories error:", err);
    return res.status(200).json([]);
  }
}
