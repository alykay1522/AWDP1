import { pool } from "@workspace/db";
import { CATALOG_OPTION_HINTS } from "./catalogOptionHints";

const MARKER = "catalog_post_normalization_2026_06_27_v4";

type ProductRow = {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  category: string;
  imageUrl: string | null;
  attributes: Record<string, unknown> | null;
  soldAs: string | null;
};

type Summary = {
  skipped: boolean;
  productsBefore: number;
  productsAfter: number;
  servicePagesRemoved: number;
  duplicatesRemoved: number;
  productsUpdated: number;
  variantRowsAssigned: number;
  productsWithDropdowns: number;
};

const VARIANTS: Record<string, [string, string]> = {
  "AWDP-10815501 RHCVWH": ["casemaster-rh-operator", "White"],
  "AWDP-10815501 10898282": ["casemaster-rh-operator", "Satin Taupe"],
  "AWDP-11869106": ["cambridge-french-interior", "Primary Interior"],
  "AWDP-11869126": ["cambridge-french-interior", "Secondary Interior"],
  "AWDP-10147190": ["cambridge-sliding-handle", "Interior"],
  "AWDP-11869072": ["cambridge-sliding-handle", "Exterior Non-Keyed"],
  "AWDP-10147195": ["cambridge-sliding-handle", "Exterior Keyed"],
  "AWDP-10147151": ["northfield-sliding-handle", "Interior"],
  "AWDP-11869096": ["northfield-sliding-handle", "Exterior Non-Keyed"],
  "AWDP-10147156": ["northfield-sliding-handle", "Exterior Keyed"],
  "AWDP-11810001": ["clear-opening-handle", "Non-Keyed"],
  "AWDP-11820020": ["clear-opening-handle", "Keyed"],
  "AWDP-05700130 - ACTIVE MP": ["multipoint-assembly", "Active Panel"],
  "AWDP-ML - 05700131": ["multipoint-assembly", "Inactive Panel"],
  "AWDP-111991123 BGE": ["v1304-frame-weather-strip", "Beige — 120 in"],
  "AWDP-11199124 BLK": ["v1304-frame-weather-strip", "Black — 120 in"],
  "AWDP-11199144 BG": ["v1304-frame-weather-strip", "Beige — 144 in"],
  "AWDP-11199145": ["v1304-frame-weather-strip", "Black — 144 in"],
  "AWDP-BULK PACK BEIGE": ["v940-panel-drip", "Beige Bulk Pack"],
  "AWDP-V940 BLACK BULK PACK": ["v940-panel-drip", "Black Bulk Pack"],
  "AWDP-11860417 11900810": ["grille-fastener-pack", "24 Pack"],
  "AWDP-11900860": ["grille-fastener-pack", "60 Pack"],
};

const DUPLICATE_ALIASES: Record<string, string> = {
  "AWDP-5700130": "AWDP-05700130 - ACTIVE MP",
};

let normalizationPromise: Promise<Summary> | undefined;

function canonicalSku(value: string): string {
  const sku = String(value ?? "").trim();
  return /^AWDP-/i.test(sku) ? `AWDP-${sku.slice(5)}` : `AWDP-${sku}`;
}

function asAttributes(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const values = Array.isArray(raw) ? raw : [raw];
    const cleaned = [...new Set(values.map(String).map((item) => item.trim()).filter(Boolean))];
    if (cleaned.length) result[key] = cleaned;
  }
  return result;
}

function mergeAttributes(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): Record<string, string[]> {
  const merged = { ...left };
  for (const [key, values] of Object.entries(right)) {
    merged[key] = [...new Set([...(merged[key] ?? []), ...values])];
  }
  return merged;
}

function isServicePage(row: ProductRow): boolean {
  const value = `${row.sku} ${row.name}`.toLowerCase();
  return [
    "identifyparts",
    "identify-marvin-parts",
    "free parts id help",
    "hurricane harvey",
    "houston harvey",
    "home owner online help",
    "contractor help desk",
    "parts local area",
    "parts usa",
    "all window door parts florida",
    "all window door parts group usa",
    "marvin window repair",
    "shipping nationwide",
    "service & repair colorado",
    "2018 winterize parts",
  ].some((fragment) => value.includes(fragment));
}

function categoryFor(row: ProductRow): string {
  const value = `${row.sku} ${row.name} ${row.description ?? ""}`.toLowerCase();
  if (/weather.?strip|weather.?seal|panel sweep|glazing|door seal/.test(value)) {
    return "Window Glazing and Weatherstrip";
  }
  if (/jamb.?liner|jamb carrier|window balance|balance tube|tilt.?pac/.test(value)) {
    return "Window Balances";
  }
  if (/door|patio|french|handle set|hinge|strike plate|mortise/.test(value)) {
    return "Door Hardware";
  }
  if (/casement|operator|roto.?gear|awning|window crank/.test(value)) {
    return "Window Hardware";
  }
  return row.category || "Other Hardware";
}

function chooseKeeper(rows: ProductRow[]): ProductRow {
  return [...rows].sort((left, right) => {
    const leftScore = (left.description?.length ?? 0) + (left.imageUrl ? 500 : 0) + (Number(left.price) > 0 ? 250 : 0);
    const rightScore = (right.description?.length ?? 0) + (right.imageUrl ? 500 : 0) + (Number(right.price) > 0 ? 250 : 0);
    return rightScore - leftScore;
  })[0];
}

async function normalizeCatalog(): Promise<Summary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const marker = await client.query("SELECT 1 FROM site_settings WHERE key = $1 LIMIT 1", [MARKER]);
    const countResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
    const productsBefore = Number(countResult.rows[0]?.count ?? 0);

    if (marker.rowCount) {
      await client.query("COMMIT");
      return {
        skipped: true,
        productsBefore,
        productsAfter: productsBefore,
        servicePagesRemoved: 0,
        duplicatesRemoved: 0,
        productsUpdated: 0,
        variantRowsAssigned: 0,
        productsWithDropdowns: 0,
      };
    }

    const result = await client.query<ProductRow>(`
      SELECT
        id, sku, name, description, price::text AS price, category,
        image_url AS "imageUrl", attributes, sold_as AS "soldAs"
      FROM products
      ORDER BY id
    `);
    const rows = result.rows;

    const serviceIds = rows.filter(isServicePage).map((row) => row.id);
    if (serviceIds.length) {
      await client.query("DELETE FROM products WHERE id = ANY($1::int[])", [serviceIds]);
    }

    const retained = rows.filter((row) => !serviceIds.includes(row.id));
    const deletedIds = new Set<number>();
    let duplicatesRemoved = 0;

    for (const [duplicateSku, canonicalSkuValue] of Object.entries(DUPLICATE_ALIASES)) {
      const duplicate = retained.find((row) => row.sku.toUpperCase() === duplicateSku);
      const keeper = retained.find((row) => row.sku.toUpperCase() === canonicalSkuValue);
      if (duplicate && keeper && duplicate.id !== keeper.id) {
        await client.query("DELETE FROM products WHERE id = $1", [duplicate.id]);
        deletedIds.add(duplicate.id);
        duplicatesRemoved++;
      }
    }

    const groups = new Map<string, ProductRow[]>();
    for (const row of retained) {
      if (deletedIds.has(row.id)) continue;
      const key = canonicalSku(row.sku).toUpperCase();
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    const keepers: ProductRow[] = [];
    for (const group of groups.values()) {
      const keeper = chooseKeeper(group);
      keepers.push(keeper);
      const extras = group.filter((row) => row.id !== keeper.id);
      if (extras.length) {
        await client.query("DELETE FROM products WHERE id = ANY($1::int[])", [extras.map((row) => row.id)]);
        extras.forEach((row) => deletedIds.add(row.id));
        duplicatesRemoved += extras.length;
      }
    }

    let productsUpdated = 0;
    let variantRowsAssigned = 0;
    let productsWithDropdowns = 0;

    for (const row of keepers) {
      const sku = canonicalSku(row.sku);
      const key = sku.toUpperCase();
      const optionHint = CATALOG_OPTION_HINTS[key];
      const mergedAttributes = mergeAttributes(
        asAttributes(row.attributes),
        optionHint?.attributes ?? {},
      );
      const variant = VARIANTS[key];
      const soldAs = row.soldAs || optionHint?.soldAs || null;

      await client.query(
        `UPDATE products
         SET sku = $1, category = $2, attributes = $3::json,
             sold_as = $4, variant_group_id = $5, variant_label = $6
         WHERE id = $7`,
        [
          sku,
          categoryFor(row),
          JSON.stringify(Object.keys(mergedAttributes).length ? mergedAttributes : null),
          soldAs,
          variant?.[0] ?? null,
          variant?.[1] ?? null,
          row.id,
        ],
      );

      productsUpdated++;
      if (variant) variantRowsAssigned++;
      if (Object.values(mergedAttributes).some((values) => values.length > 1)) {
        productsWithDropdowns++;
      }
    }

    await client.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [MARKER, JSON.stringify({ completedAt: new Date().toISOString() })],
    );

    const finalCount = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM products");
    const productsAfter = Number(finalCount.rows[0]?.count ?? 0);
    await client.query("COMMIT");

    return {
      skipped: false,
      productsBefore,
      productsAfter,
      servicePagesRemoved: serviceIds.length,
      duplicatesRemoved,
      productsUpdated,
      variantRowsAssigned,
      productsWithDropdowns,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function ensureCatalogPostNormalized(): Promise<Summary> {
  if (!normalizationPromise) {
    normalizationPromise = normalizeCatalog().catch((error) => {
      normalizationPromise = undefined;
      throw error;
    });
  }
  return normalizationPromise;
}
