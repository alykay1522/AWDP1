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

  const {
    page = "1",
    limit = "24",
    sort = "newest",
    search,
    category,
    minPrice,
    maxPrice,
    inStockOnly,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  const db = getPool();
  if (!db) {
    console.warn("[AWDP API] DATABASE_URL not set");
    return res.status(200).json({
      products: [],
      total: 0,
      page: pageNum,
      limit: limitNum,
      totalPages: 0,
    });
  }

  try {
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(
        `(LOWER(name) LIKE $${paramIdx} OR LOWER(sku) LIKE $${paramIdx} OR LOWER(description) LIKE $${paramIdx})`
      );
      params.push(`%${search.toLowerCase()}%`);
      paramIdx++;
    }

    if (category) {
      conditions.push(`category = $${paramIdx}`);
      params.push(category);
      paramIdx++;
    }

    if (minPrice) {
      conditions.push(`CAST(price AS NUMERIC) >= $${paramIdx}`);
      params.push(parseFloat(minPrice));
      paramIdx++;
    }

    if (maxPrice) {
      conditions.push(`CAST(price AS NUMERIC) <= $${paramIdx}`);
      params.push(parseFloat(maxPrice));
      paramIdx++;
    }

    if (inStockOnly === "true") {
      conditions.push(`"inStock" = true`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderClause = 'ORDER BY "createdAt" DESC';
    if (sort === "price-asc") orderClause = "ORDER BY CAST(price AS NUMERIC) ASC";
    else if (sort === "price-desc") orderClause = "ORDER BY CAST(price AS NUMERIC) DESC";
    else if (sort === "name-asc") orderClause = "ORDER BY name ASC";

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM products ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);
    const totalPages = Math.ceil(total / limitNum);

    const result = await db.query(
      `SELECT id, sku, name, price, category, "inStock", "imageUrl",
              "originalPrice", description, supplier, subcategory,
              "compatibleBrands", specifications
       FROM products ${whereClause} ${orderClause}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitNum, offset]
    );

    console.log(`[AWDP API] /api/products — ${result.rows.length} of ${total} results`);

    return res.status(200).json({
      products: result.rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    });
  } catch (err) {
    console.error("[AWDP API] /api/products error:", err);
    return res.status(500).json({
      products: [],
      total: 0,
      page: pageNum,
      limit: limitNum,
      totalPages: 0,
      error: err.message,
    });
  }
}
