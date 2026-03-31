import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import { logger } from "./lib/logger";

import categoriesData from "./seed-data/categories.json";
import productsData from "./seed-data/products.json";

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

const BATCH_SIZE = 50;

export async function seedIfEmpty(): Promise<void> {
  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(productsTable);

  if (productCount > 0) {
    logger.info({ productCount }, "Database already seeded, skipping");
    return;
  }

  logger.info("Database is empty — seeding catalog now...");

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

  const products = productsData as SeedProduct[];
  let inserted = 0;

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
      .onConflictDoNothing();
    inserted += batch.length;
  }

  logger.info({ inserted }, "Product catalog seeded successfully");
}
