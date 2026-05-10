/**
 * Vercel serverless — GET /api/catalog/stats
 * Mirrors Express `artifacts/api-server/src/routes/products.ts` (catalog stats).
 * The admin dashboard and generated client call this path; without this file,
 * Vercel returns 404 for /api/catalog/stats (the rewrite excludes /api/*).
 */
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getPool();
  if (!db) {
    return res.status(503).json({
      error: "internal_error",
      message: "DATABASE_URL is not configured on this deployment.",
    });
  }

  try {
    const [totalProducts, totalCategories, supplierResult, topCatResult] = await Promise.all([
      db.query(`SELECT COUNT(*)::bigint AS c FROM products`),
      db.query(`SELECT COUNT(*)::bigint AS c FROM categories`),
      db.query(`
        SELECT supplier, COUNT(*)::bigint AS c
        FROM products
        GROUP BY supplier
      `),
      db.query(`
        SELECT category, COUNT(*)::bigint AS c
        FROM products
        GROUP BY category
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `),
    ]);

    return res.status(200).json({
      totalProducts: Number(totalProducts.rows[0]?.c ?? 0),
      totalCategories: Number(totalCategories.rows[0]?.c ?? 0),
      supplierBreakdown: supplierResult.rows.map((r) => ({
        supplier: r.supplier,
        count: Number(r.c),
      })),
      topCategories: topCatResult.rows.map((r) => ({
        category: r.category,
        count: Number(r.c),
      })),
    });
  } catch (err) {
    console.error("[AWDP API] /api/catalog/stats error:", err);
    return res.status(500).json({
      error: "internal_error",
      message: "Failed to fetch stats",
    });
  }
}
