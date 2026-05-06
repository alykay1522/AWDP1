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
    console.warn("[AWDP API] DATABASE_URL not set");
    return res.status(200).json([]);
  }

  try {
    const result = await db.query(
      `SELECT id, sku, name, price, category, "inStock", "imageUrl",
              "originalPrice", description, supplier, subcategory,
              "compatibleBrands", specifications
       FROM products
       WHERE "inStock" = true
       ORDER BY "createdAt" DESC
       LIMIT 8`
    );

    console.log(`[AWDP API] /api/products/featured - ${result.rows.length} products`);
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error("[AWDP API] /api/products/featured error:", err);
    return res.status(200).json([]);
  }
}
