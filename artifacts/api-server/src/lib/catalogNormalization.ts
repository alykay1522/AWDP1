import { pool } from "@workspace/db";
import {
  CATALOG_OPTION_HINTS,
  CATALOG_SOURCE_SKUS,
} from "./catalogOptionHints";

const NORMALIZATION_KEY = "catalog_normalization_2026_06_27_v1";

type ProductRow = {
  id: number;
  sku: string;
  name: string;
  description: string;
  price: string;
  original_price: string | null;
  category: string;
  subcategory: string | null;
  supplier: string;
  in_stock: boolean;
  image_url: string | null;
  tags: unknown;
  specifications: unknown;
  compatible_brands: unknown;
  variant_group_id: string | null;
  variant_label: string | null;
  attributes: unknown;
  sold_as: string | null;
  created_at: Date | string | null;
};

export type CatalogNormalizationSummary = {
  skipped: boolean;
  productsBefore: number;
  productsAfter: number;
  groupsMerged: number;
  duplicateRowsDeleted: number;
  skusPrefixed: number;
  productsWithOptionsUpdated: number;
};

let normalizationPromise: Promise<CatalogNormalizationSummary> | undefined;

function canonicalSku(rawSku: string): string {
  const trimmed = String(rawSku ?? "").trim();
  if (!trimmed) return "AWDP-UNASSIGNED";
  return /^AWDP-/i.test(trimmed)
    ? `AWDP-${trimmed.slice(5)}`
    : `AWDP-${trimmed}`;
}

function generatedSuffixBase(sku: string): string | null {
  const match = sku.match(/^(.*)-([2-9]|[1-9][0-9])$/);
  return match ? match[1] : null;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\bawdp\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function imageIdentity(url: string | null): string {
  if (!url) return "";
  return url.split("?")[0].toLowerCase();
}

function looksLikeGeneratedDuplicate(a: ProductRow, b: ProductRow): boolean {
  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  if (aName && aName === bName) return true;

  const aImage = imageIdentity(a.image_url);
  const bImage = imageIdentity(b.image_url);
  if (aImage && aImage === bImage) return true;

  const aDesc = normalizeText(a.description);
  const bDesc = normalizeText(b.description);
  return Boolean(
    aDesc.length > 80 &&
      bDesc.length > 80 &&
      (aDesc === bDesc || aDesc.includes(bDesc) || bDesc.includes(aDesc)),
  );
}

function asStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(String).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      }
    } catch {
      return value.split(/[;,|]/).map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = String(raw).trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function mergeAttributeObjects(
  rows: ProductRow[],
  hinted?: Record<string, string[]>,
): Record<string, string[]> | null {
  const merged: Record<string, string[]> = {};
  for (const row of rows) {
    const attrs = asObject(row.attributes);
    for (const [key, value] of Object.entries(attrs)) {
      const vals = Array.isArray(value) ? value.map(String) : [String(value)];
      merged[key] = unique([...(merged[key] ?? []), ...vals]);
    }
  }
  if (hinted) {
    for (const [key, values] of Object.entries(hinted)) {
      merged[key] = unique([...(merged[key] ?? []), ...values]);
    }
  }
  return Object.keys(merged).length ? merged : null;
}

function validImage(url: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function richness(row: ProductRow): number {
  let score = 0;
  if (Number(row.price) > 0) score += 30;
  if (validImage(row.image_url)) score += 25;
  score += Math.min(25, Math.floor((row.description?.length ?? 0) / 120));
  score += Math.min(10, Object.keys(asObject(row.attributes)).length * 2);
  if (row.category && row.category !== "Other Hardware") score += 8;
  if (row.in_stock) score += 2;
  return score;
}

function chooseKeeper(rows: ProductRow[], targetSku: string): ProductRow {
  const exact = rows.find(
    (row) => canonicalSku(row.sku).toUpperCase() === targetSku.toUpperCase(),
  );
  if (exact) return exact;
  return [...rows].sort((a, b) => richness(b) - richness(a) || a.id - b.id)[0];
}

function chooseDescription(rows: ProductRow[], keeper: ProductRow): string {
  const candidates = rows
    .map((row) => row.description ?? "")
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return candidates[0] || keeper.description || "";
}

function chooseImage(rows: ProductRow[], keeper: ProductRow): string | null {
  if (validImage(keeper.image_url)) return keeper.image_url;
  return rows.find((row) => validImage(row.image_url))?.image_url ?? keeper.image_url ?? null;
}

function chooseCategory(rows: ProductRow[], keeper: ProductRow): string {
  if (keeper.category && keeper.category !== "Other Hardware") return keeper.category;
  return rows.find((row) => row.category && row.category !== "Other Hardware")?.category ?? keeper.category;
}

function choosePrice(rows: ProductRow[], keeper: ProductRow): string {
  if (Number(keeper.price) > 0) return keeper.price;
  return rows.find((row) => Number(row.price) > 0)?.price ?? keeper.price ?? "0.00";
}

function chooseOriginalPrice(rows: ProductRow[], keeper: ProductRow): string | null {
  if (keeper.original_price && Number(keeper.original_price) > 0) return keeper.original_price;
  return rows.find((row) => row.original_price && Number(row.original_price) > 0)?.original_price ?? null;
}

function mergeProduct(rows: ProductRow[], keeper: ProductRow, targetSku: string) {
  const hint = CATALOG_OPTION_HINTS[targetSku.toUpperCase()];
  const attributes = mergeAttributeObjects(rows, hint?.attributes);
  const tags = unique(rows.flatMap((row) => asStringArray(row.tags)));
  const compatibleBrands = unique(rows.flatMap((row) => asStringArray(row.compatible_brands)));
  const specifications = Object.assign({}, ...rows.map((row) => asObject(row.specifications)));

  return {
    sku: targetSku,
    name: [...rows].sort((a, b) => richness(b) - richness(a))[0]?.name || keeper.name,
    description: chooseDescription(rows, keeper),
    price: choosePrice(rows, keeper),
    originalPrice: chooseOriginalPrice(rows, keeper),
    category: chooseCategory(rows, keeper),
    subcategory: keeper.subcategory ?? rows.find((row) => row.subcategory)?.subcategory ?? null,
    supplier: keeper.supplier || rows.find((row) => row.supplier)?.supplier || "All Window Door Parts",
    inStock: rows.some((row) => row.in_stock),
    imageUrl: chooseImage(rows, keeper),
    tags,
    specifications,
    compatibleBrands,
    attributes,
    soldAs: hint?.soldAs ?? keeper.sold_as ?? rows.find((row) => row.sold_as)?.sold_as ?? null,
    variantGroupId: keeper.variant_group_id,
    variantLabel: keeper.variant_label,
  };
}

async function runCatalogNormalization(): Promise<CatalogNormalizationSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE");
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        key text PRIMARY KEY,
        value text NOT NULL,
        updated_at timestamp DEFAULT now()
      )
    `);

    const marker = await client.query("SELECT value FROM site_settings WHERE key = $1", [NORMALIZATION_KEY]);
    const countBeforeResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
    const productsBefore = Number(countBeforeResult.rows[0]?.count ?? 0);
    if (marker.rowCount) {
      await client.query("COMMIT");
      return {
        skipped: true,
        productsBefore,
        productsAfter: productsBefore,
        groupsMerged: 0,
        duplicateRowsDeleted: 0,
        skusPrefixed: 0,
        productsWithOptionsUpdated: 0,
      };
    }

    const result = await client.query<ProductRow>("SELECT * FROM products ORDER BY id ASC");
    const products = result.rows;
    const byCanonical = new Map<string, ProductRow[]>();
    for (const row of products) {
      const key = canonicalSku(row.sku).toUpperCase();
      const list = byCanonical.get(key) ?? [];
      list.push(row);
      byCanonical.set(key, list);
    }

    const targetKeyById = new Map<number, string>();
    for (const row of products) {
      const canonical = canonicalSku(row.sku);
      const base = generatedSuffixBase(canonical);
      let target = canonical;
      if (base) {
        const baseUpper = base.toUpperCase();
        const baseRows = byCanonical.get(baseUpper) ?? [];
        const sourceKnown = CATALOG_SOURCE_SKUS.has(baseUpper);
        const similarToBase = baseRows.some((baseRow) => looksLikeGeneratedDuplicate(row, baseRow));
        if (sourceKnown || similarToBase) target = base;
      }
      targetKeyById.set(row.id, target.toUpperCase());
    }

    const groups = new Map<string, ProductRow[]>();
    for (const row of products) {
      const key = targetKeyById.get(row.id)!;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    let groupsMerged = 0;
    let duplicateRowsDeleted = 0;
    let skusPrefixed = 0;
    let productsWithOptionsUpdated = 0;
    const distributorPricesExists = Boolean(
      (await client.query<{ exists: boolean }>("SELECT to_regclass('public.distributor_prices') IS NOT NULL AS exists")).rows[0]?.exists,
    );

    for (const [targetSku, rows] of groups) {
      const keeper = chooseKeeper(rows, targetSku);
      const merged = mergeProduct(rows, keeper, targetSku);
      const duplicateIds = rows.filter((row) => row.id !== keeper.id).map((row) => row.id);
      const oldSkus = rows.map((row) => row.sku);

      if (duplicateIds.length) {
        if (distributorPricesExists) {
          await client.query(
            "UPDATE distributor_prices SET product_sku = $1 WHERE product_sku = ANY($2::text[])",
            [targetSku, oldSkus],
          );
        }
        await client.query("DELETE FROM products WHERE id = ANY($1::int[])", [duplicateIds]);
        groupsMerged++;
        duplicateRowsDeleted += duplicateIds.length;
      }

      if (keeper.sku !== targetSku) skusPrefixed++;
      if (merged.attributes && Object.values(merged.attributes).some((values) => values.length > 1)) {
        productsWithOptionsUpdated++;
      }

      await client.query(
        `UPDATE products SET
          sku = $1,
          name = $2,
          description = $3,
          price = $4,
          original_price = $5,
          category = $6,
          subcategory = $7,
          supplier = $8,
          in_stock = $9,
          image_url = $10,
          tags = $11::json,
          specifications = $12::json,
          compatible_brands = $13::json,
          attributes = $14::json,
          sold_as = $15,
          variant_group_id = $16,
          variant_label = $17
        WHERE id = $18`,
        [
          merged.sku,
          merged.name,
          merged.description,
          merged.price,
          merged.originalPrice,
          merged.category,
          merged.subcategory,
          merged.supplier,
          merged.inStock,
          merged.imageUrl,
          JSON.stringify(merged.tags),
          JSON.stringify(merged.specifications),
          JSON.stringify(merged.compatibleBrands),
          merged.attributes ? JSON.stringify(merged.attributes) : null,
          merged.soldAs,
          duplicateIds.length ? null : merged.variantGroupId,
          duplicateIds.length ? null : merged.variantLabel,
          keeper.id,
        ],
      );
    }

    await client.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [NORMALIZATION_KEY, JSON.stringify({ groupsMerged, duplicateRowsDeleted, skusPrefixed, productsWithOptionsUpdated })],
    );

    const countAfterResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
    const productsAfter = Number(countAfterResult.rows[0]?.count ?? 0);
    await client.query("COMMIT");

    return {
      skipped: false,
      productsBefore,
      productsAfter,
      groupsMerged,
      duplicateRowsDeleted,
      skusPrefixed,
      productsWithOptionsUpdated,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function ensureCatalogNormalized(): Promise<CatalogNormalizationSummary> {
  if (!normalizationPromise) {
    normalizationPromise = runCatalogNormalization().catch((error) => {
      normalizationPromise = undefined;
      throw error;
    });
  }
  return normalizationPromise;
}
