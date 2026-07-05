import pg from "pg";
import sharp from "sharp";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[catalog-audit] DATABASE_URL is unavailable during build; skipping.");
  process.exit(0);
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" || process.env.VERCEL
    ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" }
    : undefined,
  max: 3,
  connectionTimeoutMillis: 15000,
});

function originalCandidate(url) {
  try {
    const parsed = new URL(url);
    const marker = "/sites/default/files/styles/uc_product_list/public/";
    if (!parsed.pathname.includes(marker)) return null;
    parsed.pathname = parsed.pathname.replace(marker, "/sites/default/files/");
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function inspect(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return { ok: false, status: response.status };
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer, { failOn: "none" }).metadata();
    return { ok: true, width: metadata.width, height: metadata.height, bytes: buffer.length, format: metadata.format };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

try {
  const summary = await pool.query(`
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(DISTINCT sku)::int AS distinct_skus,
      COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '')::int AS missing_images,
      COUNT(*) FILTER (WHERE image_url LIKE '%/styles/uc_product_list/%')::int AS thumbnail_style_images
    FROM products
  `);

  const normalized = await pool.query(`
    WITH grouped AS (
      SELECT
        LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '', 'g')) AS key,
        COUNT(*)::int AS count,
        ARRAY_AGG(sku ORDER BY sku) AS skus,
        ARRAY_AGG(name ORDER BY sku) AS names,
        ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS variant_groups
      FROM products
      GROUP BY 1
    )
    SELECT * FROM grouped WHERE count > 1 ORDER BY count DESC, key LIMIT 100
  `);

  const exact = await pool.query(`
    SELECT LOWER(TRIM(name)) AS name, price, COALESCE(image_url, '') AS image_url,
      COUNT(*)::int AS count, ARRAY_AGG(sku ORDER BY sku) AS skus,
      ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS variant_groups
    FROM products
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
    ORDER BY count DESC, name
    LIMIT 100
  `);

  const duplicateImages = await pool.query(`
    SELECT image_url, COUNT(*)::int AS count, ARRAY_AGG(sku ORDER BY sku) AS skus,
      ARRAY_AGG(name ORDER BY sku) AS names,
      ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS variant_groups
    FROM products
    WHERE image_url IS NOT NULL AND image_url <> ''
    GROUP BY image_url
    HAVING COUNT(*) > 1
    ORDER BY count DESC, image_url
    LIMIT 100
  `);

  const hostCounts = await pool.query(`
    SELECT CASE WHEN image_url IS NULL OR image_url = '' THEN '(missing)'
      ELSE REGEXP_REPLACE(image_url, '^https?://([^/]+).*$', '\\1') END AS host,
      COUNT(*)::int AS count
    FROM products GROUP BY 1 ORDER BY count DESC
  `);

  const samples = await pool.query(`
    SELECT sku, name, image_url FROM products
    WHERE image_url IS NOT NULL AND image_url <> ''
    ORDER BY id DESC LIMIT 12
  `);

  const imageSamples = [];
  for (const row of samples.rows) {
    const originalUrl = originalCandidate(row.image_url);
    imageSamples.push({
      sku: row.sku,
      sourceUrl: row.image_url,
      source: await inspect(row.image_url),
      originalUrl,
      original: originalUrl ? await inspect(originalUrl) : null,
    });
  }

  const suspiciousNormalized = normalized.rows.filter((row) => {
    const nonEmpty = new Set((row.variant_groups || []).filter(Boolean));
    return nonEmpty.size !== 1;
  });

  console.log("[catalog-audit] RESULT_BEGIN");
  console.log(JSON.stringify({
    summary: summary.rows[0],
    normalized_name_groups: normalized.rows.length,
    suspicious_normalized_groups: suspiciousNormalized,
    exact_listing_groups: exact.rows,
    duplicate_image_groups: duplicateImages.rows,
    image_hosts: hostCounts.rows,
    image_samples: imageSamples,
  }, null, 2));
  console.log("[catalog-audit] RESULT_END");
} finally {
  await pool.end();
}
