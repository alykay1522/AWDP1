import { pool } from "@workspace/db";
import seed0 from "../data/catalogSeed0.json";
import seed1 from "../data/catalogSeed1.json";
import seed2 from "../data/catalogSeed2.json";
import seed3 from "../data/catalogSeed3.json";
import seed4 from "../data/catalogSeed4.json";
import seed5a from "../data/catalogSeed5a.json";
import seed5b from "../data/catalogSeed5b.json";

interface SeedProduct {
  sku: string;
  name: string;
  description?: string;
  price: string;
  imageUrl: string | null;
  category: string;
  supplier: string;
  inStock: boolean;
  attributes: Record<string, string[]> | null;
  soldAs: string | null;
}

export interface CatalogSeedSummary {
  skipped: boolean;
  imported: number;
  total: number;
}

let seedPromise: Promise<CatalogSeedSummary> | undefined;

const seedProducts: SeedProduct[] = [
  ...seed0,
  ...seed1,
  ...seed2,
  ...seed3,
  ...seed4,
  ...seed5a,
  ...seed5b,
] as SeedProduct[];

async function seedCatalog(): Promise<CatalogSeedSummary> {
  const countResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM products",
  );
  const currentCount = Number(countResult.rows[0]?.count ?? 0);
  if (currentCount > 0) {
    return { skipped: true, imported: 0, total: currentCount };
  }

  const distinctSkus = new Set(seedProducts.map((product) => product.sku));
  if (
    seedProducts.length !== 85 ||
    distinctSkus.size !== seedProducts.length ||
    seedProducts.some((product) => !product.sku.startsWith("AWDP-"))
  ) {
    throw new Error("Catalog seed validation failed");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO products (
        sku, name, description, price, original_price, category, subcategory,
        supplier, in_stock, image_url, tags, specifications,
        compatible_brands, variant_group_id, variant_label, attributes, sold_as
      )
      SELECT
        source.sku,
        source.name,
        coalesce(source.description, ''),
        source.price::numeric,
        NULL,
        source.category,
        NULL,
        source.supplier,
        source."inStock",
        source."imageUrl",
        '[]'::json,
        '{}'::json,
        '[]'::json,
        NULL,
        NULL,
        source.attributes::json,
        source."soldAs"
      FROM jsonb_to_recordset($1::jsonb) AS source(
        sku text,
        name text,
        description text,
        price text,
        "imageUrl" text,
        category text,
        supplier text,
        "inStock" boolean,
        attributes jsonb,
        "soldAs" text
      )
      ON CONFLICT (sku) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        supplier = EXCLUDED.supplier,
        in_stock = EXCLUDED.in_stock,
        image_url = EXCLUDED.image_url,
        attributes = EXCLUDED.attributes,
        sold_as = EXCLUDED.sold_as`,
      [JSON.stringify(seedProducts)],
    );
    const finalResult = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM products",
    );
    await client.query("COMMIT");
    return {
      skipped: false,
      imported: seedProducts.length,
      total: Number(finalResult.rows[0]?.count ?? 0),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function ensureCatalogSeeded(): Promise<CatalogSeedSummary> {
  if (!seedPromise) {
    seedPromise = seedCatalog().catch((error) => {
      seedPromise = undefined;
      throw error;
    });
  }
  return seedPromise;
}
