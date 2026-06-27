import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import { cleanedCatalogSeed } from "../data/catalogSeed";
import { CATALOG_OPTION_HINTS } from "./catalogOptionHints";

export type CatalogRecoverySummary = {
  skipped: boolean;
  productsBefore: number;
  productsInserted: number;
  sourceRows: number;
  filteredServicePages: number;
  duplicateRowsRemoved: number;
  productsWithOptions: number;
  variantGroups: number;
};

type SeedRecord = {
  sku?: unknown;
  name?: unknown;
  description?: unknown;
  price?: unknown;
  originalPrice?: unknown;
  category?: unknown;
  subcategory?: unknown;
  supplier?: unknown;
  inStock?: unknown;
  imageUrl?: unknown;
  tags?: unknown;
  specifications?: unknown;
  compatibleBrands?: unknown;
  attributes?: unknown;
  soldAs?: unknown;
  variantGroupId?: unknown;
  variantLabel?: unknown;
};

type NormalizedRecord = {
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
  attributes: Record<string, string[]> | null;
  soldAs: string | null;
  variantGroupId: string | null;
  variantLabel: string | null;
};

const VARIANT_HINTS: Record<string, { group: string; label: string }> = {
  "AWDP-10815501 RHCVWH": { group: "casemaster-rh-operator-assembly", label: "White" },
  "AWDP-10815501 10898282": { group: "casemaster-rh-operator-assembly", label: "Satin Taupe" },

  "AWDP-11869106": { group: "integrity-cambridge-french-interior", label: "Primary Interior" },
  "AWDP-11869126": { group: "integrity-cambridge-french-interior", label: "Secondary Interior" },

  "AWDP-10147190": { group: "integrity-cambridge-sliding-handle", label: "Interior" },
  "AWDP-11869072": { group: "integrity-cambridge-sliding-handle", label: "Exterior Non-Keyed" },
  "AWDP-10147195": { group: "integrity-cambridge-sliding-handle", label: "Exterior Keyed" },

  "AWDP-10147151": { group: "integrity-northfield-sliding-handle", label: "Interior" },
  "AWDP-11869096": { group: "integrity-northfield-sliding-handle", label: "Exterior Non-Keyed" },
  "AWDP-10147156": { group: "integrity-northfield-sliding-handle", label: "Exterior Keyed" },

  "AWDP-11810001": { group: "integrity-clear-opening-handle", label: "Non-Keyed" },
  "AWDP-11820020": { group: "integrity-clear-opening-handle", label: "Keyed" },

  "AWDP-05700130 - ACTIVE MP": { group: "marvin-multipoint-assembly", label: "Active Panel" },
  "AWDP-ML - 05700131": { group: "marvin-multipoint-assembly", label: "Inactive Panel" },

  "AWDP-111991123 BGE": { group: "v1304-frame-weather-strip", label: "Beige — 120 in" },
  "AWDP-11199124 BLK": { group: "v1304-frame-weather-strip", label: "Black — 120 in" },
  "AWDP-11199145": { group: "v1304-frame-weather-strip", label: "Black — 144 in" },

  "AWDP-BULK PACK BEIGE": { group: "v940-panel-drip", label: "Beige Bulk Pack" },
  "AWDP-V940 BLACK BULK PACK": { group: "v940-panel-drip", label: "Black Bulk Pack" },
};

let recoveryPromise: Promise<CatalogRecoverySummary> | undefined;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeSku(value: unknown): string {
  const original = text(value);
  if (!original) return "";
  return /^AWDP-/i.test(original) ? `AWDP-${original.slice(5)}` : `AWDP-${original}`;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter(Boolean))];
}

function attributeMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const values = Array.isArray(raw) ? raw.map(text).filter(Boolean) : [text(raw)].filter(Boolean);
    if (values.length) result[key] = [...new Set(values)];
  }
  return result;
}

function mergeAttributes(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): Record<string, string[]> {
  const merged = { ...left };
  for (const [key, values] of Object.entries(right)) {
    merged[key] = [...new Set([...(merged[key] ?? []), ...values].filter(Boolean))];
  }
  return merged;
}

function isServicePage(record: SeedRecord): boolean {
  const sku = text(record.sku).toLowerCase();
  const name = text(record.name).toLowerCase();
  return [
    "identify-marvin-parts",
    "identifyparts",
    "hurricane harvey",
    "houston harvey",
    "restoration help",
    "all window door parts florida",
  ].some((term) => sku.includes(term) || name.includes(term));
}

function inferCategory(record: SeedRecord): string {
  const existing = text(record.category);
  const haystack = `${text(record.sku)} ${text(record.name)} ${text(record.description)}`.toLowerCase();
  if (/weather.?strip|weather.?seal|panel sweep|glazing|door seal/.test(haystack)) {
    return "Window Glazing and Weatherstrip";
  }
  if (/jamb.?liner|jamb carrier|window balance|balance tube|tilt.?pac/.test(haystack)) {
    return "Window Balances";
  }
  if (/door|patio|french|handle set|hinge|strike plate|mortise/.test(haystack)) {
    return "Door Hardware";
  }
  if (/casement|operator|roto.?gear|awning|window crank/.test(haystack)) {
    return "Window Hardware";
  }
  return existing || "Other Hardware";
}

function normalizeRecord(record: SeedRecord): NormalizedRecord | null {
  const sku = normalizeSku(record.sku);
  const name = text(record.name);
  if (!sku || !name || isServicePage(record)) return null;

  const explicitAttributes = attributeMap(record.attributes);
  const hintedAttributes = CATALOG_OPTION_HINTS[sku.toUpperCase()] ?? {};
  const attributes = mergeAttributes(explicitAttributes, hintedAttributes);
  const hint = VARIANT_HINTS[sku.toUpperCase()];

  const priceNumber = Number.parseFloat(text(record.price));
  const originalPriceNumber = Number.parseFloat(text(record.originalPrice));
  const specifications =
    record.specifications && typeof record.specifications === "object" && !Array.isArray(record.specifications)
      ? Object.fromEntries(
          Object.entries(record.specifications as Record<string, unknown>).map(([key, value]) => [key, text(value)]),
        )
      : {};

  return {
    sku,
    name,
    description: text(record.description),
    price: Number.isFinite(priceNumber) ? priceNumber.toFixed(2) : "0.00",
    originalPrice: Number.isFinite(originalPriceNumber) && originalPriceNumber > 0
      ? originalPriceNumber.toFixed(2)
      : null,
    category: inferCategory(record),
    subcategory: text(record.subcategory) || null,
    supplier: text(record.supplier) || "All Window Door Parts",
    inStock: record.inStock !== false,
    imageUrl: text(record.imageUrl) || null,
    tags: stringArray(record.tags),
    specifications,
    compatibleBrands: stringArray(record.compatibleBrands),
    attributes: Object.keys(attributes).length ? attributes : null,
    soldAs: text(record.soldAs) || null,
    variantGroupId: hint?.group ?? text(record.variantGroupId) || null,
    variantLabel: hint?.label ?? text(record.variantLabel) || null,
  };
}

function mergeRecord(current: NormalizedRecord, incoming: NormalizedRecord): NormalizedRecord {
  const currentPrice = Number(current.price);
  const incomingPrice = Number(incoming.price);
  const attributes = mergeAttributes(current.attributes ?? {}, incoming.attributes ?? {});
  return {
    ...current,
    name: incoming.name.length > current.name.length ? incoming.name : current.name,
    description: incoming.description.length > current.description.length
      ? incoming.description
      : current.description,
    price: incomingPrice > 0 ? incoming.price : currentPrice > 0 ? current.price : incoming.price,
    originalPrice: incoming.originalPrice ?? current.originalPrice,
    category: current.category === "Other Hardware" ? incoming.category : current.category,
    supplier: incoming.supplier || current.supplier,
    inStock: current.inStock || incoming.inStock,
    imageUrl: incoming.imageUrl || current.imageUrl,
    tags: [...new Set([...current.tags, ...incoming.tags])],
    specifications: { ...current.specifications, ...incoming.specifications },
    compatibleBrands: [...new Set([...current.compatibleBrands, ...incoming.compatibleBrands])],
    attributes: Object.keys(attributes).length ? attributes : null,
    soldAs: incoming.soldAs ?? current.soldAs,
    variantGroupId: incoming.variantGroupId ?? current.variantGroupId,
    variantLabel: incoming.variantLabel ?? current.variantLabel,
  };
}

async function recoverCatalog(): Promise<CatalogRecoverySummary> {
  const [{ value }] = await db.select({ value: count() }).from(productsTable);
  const productsBefore = Number(value);
  const source = cleanedCatalogSeed as unknown as SeedRecord[];

  if (productsBefore > 0) {
    return {
      skipped: true,
      productsBefore,
      productsInserted: 0,
      sourceRows: source.length,
      filteredServicePages: 0,
      duplicateRowsRemoved: 0,
      productsWithOptions: 0,
      variantGroups: 0,
    };
  }

  const bySku = new Map<string, NormalizedRecord>();
  let filteredServicePages = 0;
  for (const raw of source) {
    const normalized = normalizeRecord(raw);
    if (!normalized) {
      filteredServicePages++;
      continue;
    }
    const key = normalized.sku.toUpperCase();
    const existing = bySku.get(key);
    bySku.set(key, existing ? mergeRecord(existing, normalized) : normalized);
  }

  const products = [...bySku.values()];
  const batchSize = 50;
  for (let index = 0; index < products.length; index += batchSize) {
    await db.insert(productsTable).values(products.slice(index, index + batchSize));
  }

  return {
    skipped: false,
    productsBefore,
    productsInserted: products.length,
    sourceRows: source.length,
    filteredServicePages,
    duplicateRowsRemoved: source.length - filteredServicePages - products.length,
    productsWithOptions: products.filter((product) =>
      product.attributes && Object.values(product.attributes).some((values) => values.length > 1),
    ).length,
    variantGroups: new Set(products.map((product) => product.variantGroupId).filter(Boolean)).size,
  };
}

export function ensureCatalogRecovered(): Promise<CatalogRecoverySummary> {
  if (!recoveryPromise) {
    recoveryPromise = recoverCatalog().catch((error) => {
      recoveryPromise = undefined;
      throw error;
    });
  }
  return recoveryPromise;
}
