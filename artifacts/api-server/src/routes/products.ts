import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, ilike, and, or, sql, count, asc, desc, type SQL } from "drizzle-orm";
import { publicListingCondition, publicProductCondition } from "../lib/catalogVisibility";

const router: IRouter = Router();

const SEARCH_ALIASES: Array<[RegExp, string]> = [
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

const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/^weather\s?strips?$/i, "Window Glazing and Weatherstrip"],
  [/^weatherstripping$/i, "Window Glazing and Weatherstrip"],
  [/^seals?$/i, "Window Glazing and Weatherstrip"],
];

function normalizeSearch(raw: string | undefined, existingCategory: string | undefined): { search?: string; category?: string } {
  if (!raw?.trim()) return { category: existingCategory };
  const term = raw.trim();
  for (const [pattern, category] of CATEGORY_ALIASES) {
    if (pattern.test(term)) return { category };
  }
  for (const [pattern, canonical] of SEARCH_ALIASES) {
    if (pattern.test(term)) return { search: canonical, category: existingCategory };
  }
  return { search: term, category: existingCategory };
}

function toPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

router.get("/products/featured", async (req, res) => {
  try {
    const featured = await db
      .select()
      .from(productsTable)
      .where(and(publicListingCondition, sql`${productsTable.price}::numeric >= 50`))
      .orderBy(sql`RANDOM()`)
      .limit(8);
    return res.json(featured);
  } catch (error) {
    req.log.error({ err: error }, "Error fetching featured products");
    return res.status(503).json({ error: "catalog_unavailable", message: "Featured products are temporarily unavailable" });
  }
});

router.get("/products/search-suggestions", async (req, res) => {
  try {
    const rawQuery = String(req.query.q || "").trim();
    if (rawQuery.length < 2) return res.json([]);
    const { search, category } = normalizeSearch(rawQuery, undefined);

    const condition = !search && category
      ? and(publicListingCondition, eq(productsTable.category, category))
      : and(publicListingCondition, ilike(productsTable.name, `%${search ?? rawQuery}%`));

    const results = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(condition)
      .orderBy(asc(productsTable.name))
      .limit(8);
    return res.json([...new Set(results.map((result) => result.name))]);
  } catch (error) {
    req.log.error({ err: error }, "Error fetching search suggestions");
    return res.status(503).json({ error: "catalog_unavailable", message: "Search suggestions are temporarily unavailable" });
  }
});

router.get("/products/:sku/variants", async (req, res) => {
  try {
    const { sku } = req.params;
    const [product] = await db
      .select({ variantGroupId: productsTable.variantGroupId })
      .from(productsTable)
      .where(and(eq(productsTable.sku, sku), publicProductCondition))
      .limit(1);

    if (!product?.variantGroupId) return res.json({ variants: [] });

    const rows = await db.execute(sql`
      SELECT DISTINCT ON (COALESCE(variant_label, sku))
        sku,
        name,
        variant_label AS "variantLabel",
        price,
        in_stock AS "inStock",
        image_url AS "imageUrl"
      FROM products
      WHERE variant_group_id = ${product.variantGroupId}
        AND ${publicProductCondition}
      ORDER BY
        COALESCE(variant_label, sku),
        CASE
          WHEN variant_label ~ '^[0-9]'
          THEN (REGEXP_MATCH(variant_label, '^([0-9]+)'))[1]::integer
          ELSE NULL
        END NULLS LAST,
        variant_label
    `);

    type VariantRow = {
      sku: string;
      name: string;
      variantLabel: string | null;
      price: string;
      inStock: boolean;
      imageUrl: string | null;
    };

    const variants = (rows.rows as unknown as VariantRow[]).sort((left, right) => {
      const leftLabel = left.variantLabel ?? left.name;
      const rightLabel = right.variantLabel ?? right.name;
      const leftNumber = Number.parseFloat(leftLabel.replace(/[^0-9.]/g, "") || "0");
      const rightNumber = Number.parseFloat(rightLabel.replace(/[^0-9.]/g, "") || "0");
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      return leftLabel.localeCompare(rightLabel);
    });

    return res.json({ variants });
  } catch (error) {
    req.log.error({ err: error }, "Error fetching product variants");
    return res.status(503).json({ error: "catalog_unavailable", message: "Product options are temporarily unavailable" });
  }
});

router.get("/products/:sku", async (req, res) => {
  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.sku, req.params.sku), publicProductCondition))
      .limit(1);

    if (!product) return res.status(404).json({ error: "not_found", message: "Product not found" });
    return res.json(product);
  } catch (error) {
    req.log.error({ err: error }, "Error fetching product by SKU");
    return res.status(503).json({ error: "catalog_unavailable", message: "Product details are temporarily unavailable" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const page = toPositiveInteger(query.page, 1);
    const limit = Math.min(toPositiveInteger(query.limit, 24), 100);
    const offset = (page - 1) * limit;
    const { search, category } = normalizeSearch(query.search, query.category);

    const conditions: SQL[] = [publicListingCondition];
    if (category) conditions.push(eq(productsTable.category, category));
    if (search) {
      conditions.push(or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.description, `%${search}%`),
        ilike(productsTable.sku, `%${search}%`),
      ) as SQL);
    }

    const minPrice = query.minPrice ? Number(query.minPrice) : null;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;
    if (minPrice !== null && Number.isFinite(minPrice)) conditions.push(sql`${productsTable.price}::numeric >= ${minPrice}`);
    if (maxPrice !== null && Number.isFinite(maxPrice)) conditions.push(sql`${productsTable.price}::numeric <= ${maxPrice}`);

    const whereClause = and(...conditions) as SQL;
    const sort = query.sort;
    const dedup = query.dedup === "true";

    if (dedup) {
      const innerOrder = sort === "price-asc"
        ? sql`price::numeric ASC NULLS LAST`
        : sort === "price-desc"
          ? sql`price::numeric DESC NULLS FIRST`
          : sql`id DESC`;
      const outerOrder = sort === "price-asc"
        ? sql`price::numeric ASC NULLS LAST`
        : sort === "price-desc"
          ? sql`price::numeric DESC NULLS FIRST`
          : sort === "name-asc"
            ? sql`name ASC`
            : sql`id DESC`;

      // Run sequentially so a single request does not monopolize a small serverless pool.
      const dedupResult = await db.execute(sql`
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(variant_group_id, sku)) *,
            COUNT(*) OVER (PARTITION BY COALESCE(variant_group_id, sku))::int AS "variantCount"
          FROM products
          WHERE ${whereClause}
          ORDER BY COALESCE(variant_group_id, sku), ${innerOrder}
        ) deduped
        ORDER BY ${outerOrder}
        LIMIT ${limit} OFFSET ${offset}
      `);
      const countResult = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM (
          SELECT DISTINCT ON (COALESCE(variant_group_id, sku)) id
          FROM products
          WHERE ${whereClause}
          ORDER BY COALESCE(variant_group_id, sku)
        ) deduped
      `);

      const total = Number((countResult.rows[0] as { count?: number })?.count ?? 0);
      const products = (dedupResult.rows as Record<string, unknown>[]).map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        price: row.price,
        originalPrice: row.original_price,
        category: row.category,
        subcategory: row.subcategory,
        supplier: row.supplier,
        inStock: row.in_stock,
        imageUrl: row.image_url,
        tags: row.tags,
        specifications: row.specifications,
        compatibleBrands: row.compatible_brands,
        variantGroupId: row.variant_group_id,
        variantLabel: row.variant_label,
        attributes: row.attributes,
        soldAs: row.sold_as,
        createdAt: row.created_at,
        variantCount: row.variantCount != null ? Number(row.variantCount) : 1,
      }));

      return res.json({ products, total, page, limit, totalPages: Math.ceil(total / limit) });
    }

    const order = sort === "price-asc"
      ? [asc(productsTable.price)]
      : sort === "price-desc"
        ? [desc(productsTable.price)]
        : sort === "name-asc"
          ? [asc(productsTable.name)]
          : [desc(productsTable.id)];

    const products = await db
      .select()
      .from(productsTable)
      .where(whereClause)
      .orderBy(...order)
      .limit(limit)
      .offset(offset);
    const totalResult = await db.select({ count: count() }).from(productsTable).where(whereClause);
    const total = Number(totalResult[0]?.count ?? 0);

    return res.json({ products, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    req.log.error({ err: error }, "Error fetching products");
    return res.status(503).json({ error: "catalog_unavailable", message: "The catalog is temporarily unavailable" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.name));
    const counts = await db
      .select({ category: productsTable.category, count: count() })
      .from(productsTable)
      .where(publicListingCondition)
      .groupBy(productsTable.category);

    const countMap = new Map(counts.map((entry) => [entry.category, Number(entry.count)]));
    return res.json(categories.map((category) => ({
      ...category,
      productCount: countMap.get(category.name) ?? 0,
    })));
  } catch (error) {
    req.log.error({ err: error }, "Error fetching categories");
    return res.status(503).json({ error: "catalog_unavailable", message: "Categories are temporarily unavailable" });
  }
});

router.get("/catalog/stats", async (req, res) => {
  try {
    const totalProducts = await db.select({ count: count() }).from(productsTable).where(publicListingCondition);
    const totalCategories = await db.select({ count: count() }).from(categoriesTable);
    const supplierCounts = await db
      .select({ supplier: productsTable.supplier, count: count() })
      .from(productsTable)
      .where(publicListingCondition)
      .groupBy(productsTable.supplier);
    const categoryCounts = await db
      .select({ category: productsTable.category, count: count() })
      .from(productsTable)
      .where(publicListingCondition)
      .groupBy(productsTable.category)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    return res.json({
      totalProducts: Number(totalProducts[0]?.count ?? 0),
      totalCategories: Number(totalCategories[0]?.count ?? 0),
      supplierBreakdown: supplierCounts.map((entry) => ({ supplier: entry.supplier, count: Number(entry.count) })),
      topCategories: categoryCounts.map((entry) => ({ category: entry.category, count: Number(entry.count) })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Error fetching catalog stats");
    return res.status(503).json({ error: "catalog_unavailable", message: "Catalog statistics are temporarily unavailable" });
  }
});

export default router;
