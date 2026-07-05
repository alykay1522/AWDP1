import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.VERCEL ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
  max: 2,
  connectionTimeoutMillis: 15000,
});

try {
  const result = await pool.query(`
    WITH visible AS (
      SELECT * FROM products
      WHERE in_stock = true
        AND image_url IS NOT NULL
        AND image_url <> ''
        AND (price::numeric = 0 OR price::numeric >= 35)
    ), duplicate_names AS (
      SELECT LOWER(TRIM(name)) AS name_key
      FROM visible
      GROUP BY 1
      HAVING COUNT(*) > 1
    )
    SELECT p.sku, p.name, p.description, p.price, p.category, p.image_url,
      p.variant_group_id, p.variant_label
    FROM visible p
    JOIN duplicate_names d ON LOWER(TRIM(p.name)) = d.name_key
    ORDER BY LOWER(TRIM(p.name)), p.sku
  `);
  console.log("[public-name-audit] RESULT_BEGIN");
  console.log(JSON.stringify(result.rows, null, 2));
  console.log("[public-name-audit] RESULT_END");
} finally {
  await pool.end();
}
