import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, ilike, and, or, sql, count } from "drizzle-orm";

const router: IRouter = Router();

function toNumber(val: string | undefined, fallback: number): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

router.get("/products/featured", async (req, res) => {
  try {
    const featured = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.inStock, true))
      .orderBy(sql`RANDOM()`)
      .limit(8);
    res.json(featured);
  } catch (err) {
    req.log.error({ err }, "Error fetching featured products");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch featured products" });
  }
});

router.get("/products/search-suggestions", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q || q.length < 2) {
      res.json([]);
      return;
    }
    const results = await db
      .select({ name: productsTable.name })
      .from(productsTable)
      .where(ilike(productsTable.name, `%${q}%`))
      .limit(8);
    res.json(results.map((r) => r.name));
  } catch (err) {
    req.log.error({ err }, "Error fetching search suggestions");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch suggestions" });
  }
});

router.get("/products/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.sku, sku))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    res.json(product);
  } catch (err) {
    req.log.error({ err }, "Error fetching product by SKU");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch product" });
  }
});

router.get("/products", async (req, res) => {
  try {
    const { category, search, page: pageStr, limit: limitStr } = req.query as Record<string, string | undefined>;
    const page = toNumber(pageStr, 1);
    const limit = Math.min(toNumber(limitStr, 24), 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    if (category) conditions.push(eq(productsTable.category, category));
    if (search) {
      conditions.push(
        or(
          ilike(productsTable.name, `%${search}%`),
          ilike(productsTable.description, `%${search}%`),
          ilike(productsTable.sku, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [products, totalResult] = await Promise.all([
      db.select().from(productsTable).where(whereClause).limit(limit).offset(offset),
      db.select({ count: count() }).from(productsTable).where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);

    res.json({
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching products");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch products" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    const cats = await db.select().from(categoriesTable);
    const counts = await db
      .select({ category: productsTable.category, count: count() })
      .from(productsTable)
      .groupBy(productsTable.category);

    const countMap = new Map(counts.map((c) => [c.category, Number(c.count)]));
    const result = cats.map((cat) => ({
      ...cat,
      productCount: countMap.get(cat.name) ?? 0,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error fetching categories");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch categories" });
  }
});

router.get("/catalog/stats", async (req, res) => {
  try {
    const [totalProducts, totalCategories, supplierCounts, categoryCounts] = await Promise.all([
      db.select({ count: count() }).from(productsTable),
      db.select({ count: count() }).from(categoriesTable),
      db
        .select({ supplier: productsTable.supplier, count: count() })
        .from(productsTable)
        .groupBy(productsTable.supplier),
      db
        .select({ category: productsTable.category, count: count() })
        .from(productsTable)
        .groupBy(productsTable.category)
        .orderBy(sql`count(*) DESC`)
        .limit(5),
    ]);

    res.json({
      totalProducts: Number(totalProducts[0]?.count ?? 0),
      totalCategories: Number(totalCategories[0]?.count ?? 0),
      supplierBreakdown: supplierCounts.map((s) => ({
        supplier: s.supplier,
        count: Number(s.count),
      })),
      topCategories: categoryCounts.map((c) => ({
        category: c.category,
        count: Number(c.count),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching catalog stats");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch stats" });
  }
});

export default router;
