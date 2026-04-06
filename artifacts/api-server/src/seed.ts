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
// Full catalog threshold: if DB has fewer products than this, load the full export
const FULL_CATALOG_THRESHOLD = 10000;

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
