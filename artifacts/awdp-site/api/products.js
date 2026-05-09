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

/** Match Express `visiblePrice`: show $0 or price >= $35 */
const VISIBLE_PRICE_SQL = `(CAST(price AS NUMERIC) = 0 OR CAST(price AS NUMERIC) >= 35)`;

const SEARCH_ALIASES = [
  [/^sash locks?$/i, "lock"],
  [/^cam locks?$/i, "lock"],
  [/^sweep locks?$/i, "lock"],
  [/^window locks?$/i, "lock"],
  [/^lock keeper(?:s)?$/i, "keeper"],
  [/^tilt latch(?:es)?$/i, "latch"],
  [/^window latch(?:es)?$/i, "latch"],
  [/^window cranks?$/i, "operator"],
  [/^cranks?$/i, "operator"],
  [/^channel balances?$/i, "balance"],
  [/^window balances?$/i, "balance"],
  [/^patio door rollers?$/i, "roller"],
];

const CATEGORY_ALIASES = [
  [/^weather\s?strips?$/i, "Window Glazing and Weatherstrip"],
  [/^weatherstripping$/i, "Window Glazing and Weatherstrip"],
  [/^seals?$/i, "Window Glazing and Weatherstrip"],
];

function normalizeSearch(raw, existingCategory) {
  if (!raw || !String(raw).trim()) return { category: existingCategory };
  const term = String(raw).trim();
  for (const [pattern, cat] of CATEGORY_ALIASES) {
    if (pattern.test(term)) return { category: cat };
  }
  for (const [pattern, canonical] of SEARCH_ALIASES) {
    if (pattern.test(term)) return { search: canonical, category: existingCategory };
  }
  return { search: term, category: existingCategory };
}

function dedupOrderFragments(sort) {
  const innerDefault =
    "CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 0 ELSE 1 END, id DESC";
  const inner =
    sort === "price-asc"
      ? "CAST(price AS NUMERIC) ASC NULLS LAST"
      : sort === "price-desc"
        ? "CAST(price AS NUMERIC) DESC NULLS FIRST"
        : innerDefault;
  const outer =
    sort === "price-asc"
      ? "CAST(price AS NUMERIC) ASC NULLS LAST"
      : sort === "price-desc"
        ? "CAST(price AS NUMERIC) DESC NULLS FIRST"
        : sort === "name-asc"
          ? "name ASC"
          : "CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 0 ELSE 1 END, id DESC";
  return { inner, outer };
}

function mapRowToProduct(r) {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    description: r.description,
    price: r.price,
    originalPrice: r.original_price ?? r.originalPrice ?? null,
    category: r.category,
    subcategory: r.subcategory,
    supplier: r.supplier,
    inStock: r.in_stock ?? r.inStock,
    imageUrl: r.image_url ?? r.imageUrl ?? null,
    tags: r.tags,
    specifications: r.specifications,
    compatibleBrands: r.compatible_brands ?? r.compatibleBrands ?? null,
    variantGroupId: r.variant_group_id ?? r.variantGroupId ?? null,
    variantLabel: r.variant_label ?? r.variantLabel ?? null,
    attributes: r.attributes,
    soldAs: r.sold_as ?? r.soldAs ?? null,
    createdAt: r.created_at ?? r.createdAt ?? null,
    variantCount:
      r.variantCount != null
        ? Number(r.variantCount)
        : r.variantcount != null
          ? Number(r.variantcount)
          : undefined,
  };
}

function buildWhereParts({ search, category, minPrice, maxPrice }) {
  const parts = [`in_stock = true`, VISIBLE_PRICE_SQL];
  const params = [];
  let i = 1;

  if (search) {
    parts.push(
      `(LOWER(name) LIKE $${i} OR LOWER(sku) LIKE $${i} OR LOWER(description) LIKE $${i})`,
    );
    params.push(`%${String(search).toLowerCase()}%`);
    i++;
  }
  if (category) {
    parts.push(`category = $${i}`);
    params.push(category);
    i++;
  }
  if (minPrice != null && minPrice !== "" && !Number.isNaN(Number(minPrice))) {
    parts.push(`CAST(price AS NUMERIC) >= $${i}`);
    params.push(Number(minPrice));
    i++;
  }
  if (maxPrice != null && maxPrice !== "" && !Number.isNaN(Number(maxPrice))) {
    parts.push(`CAST(price AS NUMERIC) <= $${i}`);
    params.push(Number(maxPrice));
    i++;
  }

  return { whereSql: parts.join(" AND "), params, nextIdx: i };
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
    search: rawSearch,
    category: rawCategory,
    minPrice,
    maxPrice,
  } = req.query;

  const dedup = req.query.dedup === "true";
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 24));
  const offset = (pageNum - 1) * limitNum;

  const { search, category } = normalizeSearch(rawSearch, rawCategory);

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

  const { whereSql, params: whereParams } = buildWhereParts({
    search,
    category,
    minPrice,
    maxPrice,
  });

  try {
    if (dedup) {
      const { inner, outer } = dedupOrderFragments(sort);
      const countSql = `
        SELECT COUNT(*)::int AS count FROM (
          SELECT DISTINCT ON (COALESCE(variant_group_id, sku)) id
          FROM products
          WHERE ${whereSql}
          ORDER BY COALESCE(variant_group_id, sku)
        ) deduped`;
      const listSql = `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(variant_group_id, sku)) *,
            COUNT(*) OVER (PARTITION BY COALESCE(variant_group_id, sku))::int AS "variantCount"
          FROM products
          WHERE ${whereSql}
          ORDER BY COALESCE(variant_group_id, sku), ${inner}
        ) deduped
        ORDER BY ${outer}
        LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`;

      const [countResult, listResult] = await Promise.all([
        db.query(countSql, whereParams),
        db.query(listSql, [...whereParams, limitNum, offset]),
      ]);

      const total = Number(countResult.rows[0]?.count ?? 0);
      const products = listResult.rows.map(mapRowToProduct).map((p) => ({
        ...p,
        variantCount: p.variantCount != null ? p.variantCount : 1,
      }));

      return res.status(200).json({
        products,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 0,
      });
    }

    const orderNewest =
      "CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 0 ELSE 1 END, id DESC";
    const orderClause =
      sort === "price-asc"
        ? "ORDER BY CAST(price AS NUMERIC) ASC NULLS LAST"
        : sort === "price-desc"
          ? "ORDER BY CAST(price AS NUMERIC) DESC NULLS FIRST"
          : sort === "name-asc"
            ? "ORDER BY name ASC"
            : `ORDER BY ${orderNewest}`;

    const countSql = `SELECT COUNT(*)::int AS total FROM products WHERE ${whereSql}`;
    const listSql = `
      SELECT
        id, sku, name, description, price,
        original_price AS "originalPrice",
        category, subcategory, supplier,
        in_stock AS "inStock",
        image_url AS "imageUrl",
        tags,
        specifications,
        compatible_brands AS "compatibleBrands",
        variant_group_id AS "variantGroupId",
        variant_label AS "variantLabel",
        attributes,
        sold_as AS "soldAs",
        created_at AS "createdAt"
      FROM products
      WHERE ${whereSql}
      ${orderClause}
      LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`;

    const countResult = await db.query(countSql, whereParams);
    const total = Number(countResult.rows[0]?.total ?? 0);
    const listResult = await db.query(listSql, [...whereParams, limitNum, offset]);

    return res.status(200).json({
      products: listResult.rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 0,
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
