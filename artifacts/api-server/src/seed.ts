import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { count, sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import categoriesData from "./seed-data/categories.json";
import productsData from "./seed-data/products.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type SeedCategory = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
};

type SeedProduct = {
  sku: string;
  name: string;
  description: string;
  price: string;
  originalPrice: string | null;
  category: string;
  subcategory: string | null;
  supplier: string;
  inStock: boolean;
  imageUrl: string | null;
  tags: string[];
  specifications: Record<string, string>;
  compatibleBrands: string[];
};

const BATCH_SIZE = 100;
// If the DB already has at least this many products, skip auto-seed on startup (~4k catalog).
const FULL_CATALOG_THRESHOLD = 3500;

function loadFullCatalog(): SeedProduct[] | null {
  // Try several paths where the full export might live
  const candidates = [
    path.join(process.cwd(), "artifacts/api-server/seed-data-full.json"),
    path.join(__dirname, "../../seed-data-full.json"),
    path.join(__dirname, "../seed-data-full.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      logger.info({ path: p }, "Loading full product catalog from file");
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw) as SeedProduct[];
    }
  }
  logger.warn("Full product catalog file not found, will use bundled seed data");
  return null;
}

async function upsertProducts(products: SeedProduct[]): Promise<number> {
  let upserted = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await db
      .insert(productsTable)
      .values(batch.map((p) => ({
        sku: p.sku,
        name: p.name,
        description: p.description ?? "",
        price: p.price,
        originalPrice: p.originalPrice ?? null,
        category: p.category,
        subcategory: p.subcategory ?? null,
        supplier: p.supplier,
        inStock: p.inStock,
        imageUrl: p.imageUrl ?? null,
        tags: p.tags ?? [],
        specifications: p.specifications ?? {},
        compatibleBrands: p.compatibleBrands ?? [],
      })))
      .onConflictDoUpdate({
        target: productsTable.sku,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          price: sql`excluded.price`,
          originalPrice: sql`excluded.original_price`,
          category: sql`excluded.category`,
          subcategory: sql`excluded.subcategory`,
          supplier: sql`excluded.supplier`,
          inStock: sql`excluded.in_stock`,
          imageUrl: sql`excluded.image_url`,
          tags: sql`excluded.tags`,
          specifications: sql`excluded.specifications`,
          compatibleBrands: sql`excluded.compatible_brands`,
        },
      });
    upserted += batch.length;
    if (upserted % 5000 === 0) {
      logger.info({ upserted, total: products.length }, "Seeding progress...");
    }
  }
  return upserted;
}

export async function fixProductCategories(): Promise<void> {
  const [{ value: uncatCount }] = await db
    .select({ value: count() })
    .from(productsTable)
    .where(sql`category IS NULL OR category = ''`);

  if (uncatCount === 0) {
    logger.info("All products already categorized, skipping fixProductCategories");
    return;
  }

  logger.info({ uncatCount }, "Found uncategorized products — running category fix...");

  const updates: Array<{ label: string; query: string }> = [
    {
      label: "Window Balances (TR/TE/IA/IB/BI/TF/TP/BE/LT) — balance products by name",
      query: `UPDATE products SET category = 'Window Balances' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-TR%' OR sku LIKE 'AWDP-TE%' OR sku LIKE 'AWDP-IA%' OR sku LIKE 'AWDP-IB%' OR sku LIKE 'AWDP-BI%' OR sku LIKE 'AWDP-TF%' OR sku LIKE 'AWDP-TP%' OR sku LIKE 'AWDP-BE%' OR sku LIKE 'AWDP-LT%') AND (name ILIKE '%balance%' OR name ILIKE '%chan bal%' OR name ILIKE '%ribbed bal%' OR name ILIKE '%overhead bal%' OR name ILIKE '% bal w/%' OR name ILIKE '% bal w:%' OR name ILIKE '% bal @%' OR name ILIKE '% bal.%' OR name ILIKE '% bal %' OR name ILIKE 'inverted tilt b%')`,
    },
    {
      label: "Sash Hardware (TR/TE/IA/IB/BI/TF/TP/BE/LT) — non-balance accessories",
      query: `UPDATE products SET category = 'Sash Hardware' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-TR%' OR sku LIKE 'AWDP-TE%' OR sku LIKE 'AWDP-IA%' OR sku LIKE 'AWDP-IB%' OR sku LIKE 'AWDP-BI%' OR sku LIKE 'AWDP-TF%' OR sku LIKE 'AWDP-TP%' OR sku LIKE 'AWDP-BE%' OR sku LIKE 'AWDP-LT%')`,
    },
    {
      label: "Window Hardware (OT/OA/OF/OR/RL/IE/OB/OO/BB)",
      query: `UPDATE products SET category = 'Window Hardware' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-OT%' OR sku LIKE 'AWDP-OA%' OR sku LIKE 'AWDP-OF%' OR sku LIKE 'AWDP-OR%' OR sku LIKE 'AWDP-RL%' OR sku LIKE 'AWDP-IE%' OR sku LIKE 'AWDP-OB%' OR sku LIKE 'AWDP-OO%' OR sku LIKE 'AWDP-BB%')`,
    },
    {
      label: "Window Hardware (AWDP-OL non-skylight)",
      query: `UPDATE products SET category = 'Window Hardware' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-OL%' AND name NOT ILIKE '%SKYLIGHT%' AND name NOT ILIKE '%SPROCKET FOR SKYLIGHT%'`,
    },
    {
      label: "Door Hardware (PO/PR/RB/IT/PT/L-/II/FT)",
      query: `UPDATE products SET category = 'Door Hardware' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-PO%' OR sku LIKE 'AWDP-PR%' OR sku LIKE 'AWDP-RB%' OR sku LIKE 'AWDP-IT%' OR sku LIKE 'AWDP-PT%' OR sku LIKE 'AWDP-L-%' OR sku LIKE 'AWDP-II%' OR sku LIKE 'AWDP-FT%')`,
    },
    {
      label: "Window Glazing and Weatherstrip (TO)",
      query: `UPDATE products SET category = 'Window Glazing and Weatherstrip' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-TO%'`,
    },
    {
      label: "Screen Hardware and Accessories (PE/PF)",
      query: `UPDATE products SET category = 'Screen Hardware and Accessories' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-PE%' OR sku LIKE 'AWDP-PF%')`,
    },
    {
      label: "Other Hardware (RE/BT/OL-skylight)",
      query: `UPDATE products SET category = 'Other Hardware' WHERE (category IS NULL OR category = '') AND (sku LIKE 'AWDP-RE%' OR sku LIKE 'AWDP-BT%' OR (sku LIKE 'AWDP-OL%' AND name ILIKE '%SKYLIGHT%'))`,
    },
    {
      label: "AWDP-LE: Glazing",
      query: `UPDATE products SET category = 'Window Glazing and Weatherstrip' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-LE%' AND (name ILIKE '%WEATHER%' OR name ILIKE '%SEAL%' OR name ILIKE '%GLAZING%')`,
    },
    {
      label: "AWDP-LE: Door Hardware",
      query: `UPDATE products SET category = 'Door Hardware' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-LE%' AND (name ILIKE '%PATIO DOOR%' OR name ILIKE '%ROLLER%' OR name ILIKE '%HOOK MOUNT%' OR name ILIKE '%TAILPIECE%')`,
    },
    {
      label: "AWDP-LE: Balance accessories",
      query: `UPDATE products SET category = 'Window Balances' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-LE%' AND (name ILIKE '%BALANCE CLIP%' OR name ILIKE '%BALANCE SUPPORT%')`,
    },
    {
      label: "AWDP-LE: Window Hardware (remainder)",
      query: `UPDATE products SET category = 'Window Hardware' WHERE (category IS NULL OR category = '') AND sku LIKE 'AWDP-LE%'`,
    },
    {
      label: "Window Hardware: fix legacy 'Window Operators & Cranks'",
      query: `UPDATE products SET category = 'Window Hardware' WHERE category = 'Window Operators & Cranks'`,
    },
  ];

  let totalFixed = 0;
  for (const { label, query } of updates) {
    const result = await db.execute(sql.raw(query));
    const rows = (result as { rowCount?: number }).rowCount ?? 0;
    if (rows > 0) logger.info({ label, rows }, "Category fix applied");
    totalFixed += rows;
  }

  logger.info({ totalFixed }, "fixProductCategories complete");
}

/**
 * Migrates any products still using legacy category names to the new split categories.
 * Always runs at startup — safe to re-run (no-ops if nothing needs changing).
 */
export async function migrateLegacyCategories(): Promise<void> {
  // Split old "Window Balances and Accessories" into two distinct categories
  const balanceResult = await db.execute(sql.raw(`
    UPDATE products
    SET category = 'Window Balances'
    WHERE category = 'Window Balances and Accessories'
    AND (
      name ILIKE '%balance%'
      OR name ILIKE '%chan bal%'
      OR name ILIKE '%ribbed bal%'
      OR name ILIKE '%overhead bal%'
      OR name ILIKE '% bal w/%'
      OR name ILIKE '% bal w:%'
      OR name ILIKE '% bal @%'
      OR name ILIKE '% bal.%'
      OR name ILIKE '% bal %'
      OR name ILIKE 'inverted tilt b%'
    )
  `));
  const sashResult = await db.execute(sql.raw(`
    UPDATE products
    SET category = 'Sash Hardware'
    WHERE category = 'Window Balances and Accessories'
  `));

  const balRows = (balanceResult as { rowCount?: number }).rowCount ?? 0;
  const sashRows = (sashResult as { rowCount?: number }).rowCount ?? 0;
  if (balRows > 0 || sashRows > 0) {
    logger.info({ balRows, sashRows }, "migrateLegacyCategories: split 'Window Balances and Accessories'");
  }
}

export async function seedIfEmpty(): Promise<void> {
  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(productsTable);

  if (productCount >= FULL_CATALOG_THRESHOLD) {
    logger.info({ productCount }, "Database already seeded, skipping");
    return;
  }

  if (productCount === 0) {
    logger.info("Database is empty — seeding categories...");
    const cats = categoriesData as SeedCategory[];
    await db
      .insert(categoriesTable)
      .values(cats.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description ?? "",
        imageUrl: c.imageUrl,
      })))
      .onConflictDoNothing();
    logger.info({ count: cats.length }, "Categories seeded");
  }

  // Try to load full catalog first
  const fullCatalog = loadFullCatalog();
  const products = (fullCatalog ?? productsData) as SeedProduct[];

  logger.info(
    { productCount, catalogSize: products.length },
    "Database needs full catalog — upserting all products..."
  );

  const upserted = await upsertProducts(products);
  logger.info({ upserted }, "Product catalog seeded successfully");
}
