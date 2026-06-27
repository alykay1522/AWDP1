import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { count } from "drizzle-orm";
import { cleanedCatalogSeed } from "../data/catalogSeed";
import { CATALOG_OPTION_HINTS } from "./catalogOptionHints";

export type CatalogRecoverySummary = {
  skipped: boolean;
  productsBefore: number;
  sourceRows: number;
  productsInserted: number;
  filteredRows: number;
  duplicateRowsRemoved: number;
  productsWithDropdowns: number;
  variantGroups: number;
};

type AnyRecord = Record<string, unknown>;
type Attributes = Record<string, string[]>;

type ProductSeed = {
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
  attributes: Attributes | null;
  soldAs: string | null;
  variantGroupId: string | null;
  variantLabel: string | null;
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
  "AWDP-11199145": ["v1304-frame-weather-strip", "Black — 144 in"],
  "AWDP-BULK PACK BEIGE": ["v940-panel-drip", "Beige Bulk Pack"],
  "AWDP-V940 BLACK BULK PACK": ["v940-panel-drip", "Black Bulk Pack"],
};

let recoveryPromise: Promise<CatalogRecoverySummary> | undefined;

function asText(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function skuWithPrefix(value: unknown): string {
  const sku = asText(value);
  if (!sku) return "";
  return /^AWDP-/i.test(sku) ? `AWDP-${sku.slice(5)}` : `AWDP-${sku}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? unique(value.map(asText)) : [];
}

function asAttributes(value: unknown): Attributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Attributes = {};
  for (const [key, raw] of Object.entries(value as AnyRecord)) {
    const values = Array.isArray(raw) ? raw.map(asText) : [asText(raw)];
    const cleaned = unique(values);
    if (cleaned.length) result[key] = cleaned;
  }
  return result;
}

function mergeAttributes(left: Attributes, right: Attributes): Attributes {
  const merged: Attributes = { ...left };
  for (const [key, values] of Object.entries(right)) {
    merged[key] = unique([...(merged[key] ?? []), ...values]);
  }
  return merged;
}

function isNonProductPage(record: AnyRecord): boolean {
  const value = `${asText(record.sku)} ${asText(record.name)}`.toLowerCase();
  return [
    "identify-marvin-parts",
    "identifyparts",
    "hurricane harvey",
    "houston harvey",
    "restoration help",
    "all window door parts florida",
  ].some((fragment) => value.includes(fragment));
}

function categoryFor(record: AnyRecord): string {
  const current = asText(record.category);
  const value = `${asText(record.sku)} ${asText(record.name)} ${asText(record.description)}`.toLowerCase();
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
  return current || "Other Hardware";
}

function normalize(record: AnyRecord): ProductSeed | null {
  const sku = skuWithPrefix(record.sku);
  const name = asText(record.name);
  if (!sku || !name || isNonProductPage(record)) return null;

  const key = sku.toUpperCase();
  const optionHint = CATALOG_OPTION_HINTS[key];
  const attributes = mergeAttributes(
    asAttributes(record.attributes),
    optionHint?.attributes ?? {},
  );
  const variant = VARIANTS[key];
  const price = Number.parseFloat(asText(record.price));
  const originalPrice = Number.parseFloat(asText(record.originalPrice));

  const specifications =
    record.specifications && typeof record.specifications === "object" && !Array.isArray(record.specifications)
      ? Object.fromEntries(
          Object.entries(record.specifications as AnyRecord).map(([name, value]) => [name, asText(value)]),
        )
      : {};

  return {
    sku,
    name,
    description: asText(record.description),
    price: Number.isFinite(price) ? price.toFixed(2) : "0.00",
    originalPrice: Number.isFinite(originalPrice) && originalPrice > 0
      ? originalPrice.toFixed(2)
      : null,
    category: categoryFor(record),
    subcategory: asText(record.subcategory) || null,
    supplier: asText(record.supplier) || "All Window Door Parts",
    inStock: record.inStock !== false,
    imageUrl: asText(record.imageUrl) || null,
    tags: asStringArray(record.tags),
    specifications,
    compatibleBrands: asStringArray(record.compatibleBrands),
    attributes: Object.keys(attributes).length ? attributes : null,
    soldAs: asText(record.soldAs) || optionHint?.soldAs || null,
    variantGroupId: variant?.[0] ?? (asText(record.variantGroupId) || null),
    variantLabel: variant?.[1] ?? (asText(record.variantLabel) || null),
  };
}

function merge(current: ProductSeed, incoming: ProductSeed): ProductSeed {
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
    tags: unique([...current.tags, ...incoming.tags]),
    specifications: { ...current.specifications, ...incoming.specifications },
    compatibleBrands: unique([...current.compatibleBrands, ...incoming.compatibleBrands]),
    attributes: Object.keys(attributes).length ? attributes : null,
    soldAs: incoming.soldAs ?? current.soldAs,
    variantGroupId: incoming.variantGroupId ?? current.variantGroupId,
    variantLabel: incoming.variantLabel ?? current.variantLabel,
  };
}

async function recover(): Promise<CatalogRecoverySummary> {
  const [{ value }] = await db.select({ value: count() }).from(productsTable);
  const productsBefore = Number(value);
  const source = cleanedCatalogSeed as unknown as AnyRecord[];

  if (productsBefore > 0) {
    return {
      skipped: true,
      productsBefore,
      sourceRows: source.length,
      productsInserted: 0,
      filteredRows: 0,
      duplicateRowsRemoved: 0,
      productsWithDropdowns: 0,
      variantGroups: 0,
    };
  }

  const productsBySku = new Map<string, ProductSeed>();
  let filteredRows = 0;
  for (const record of source) {
    const product = normalize(record);
    if (!product) {
      filteredRows++;
      continue;
    }
    const key = product.sku.toUpperCase();
    const existing = productsBySku.get(key);
    productsBySku.set(key, existing ? merge(existing, product) : product);
  }

  const products = [...productsBySku.values()];
  for (let index = 0; index < products.length; index += 40) {
    await db.insert(productsTable).values(products.slice(index, index + 40) as any);
  }

  return {
    skipped: false,
    productsBefore,
    sourceRows: source.length,
    productsInserted: products.length,
    filteredRows,
    duplicateRowsRemoved: source.length - filteredRows - products.length,
    productsWithDropdowns: products.filter((product) =>
      product.attributes && Object.values(product.attributes).some((values) => values.length > 1),
    ).length,
    variantGroups: new Set(products.map((product) => product.variantGroupId).filter(Boolean)).size,
  };
}

export function ensureCatalogRecoveredV2(): Promise<CatalogRecoverySummary> {
  if (!recoveryPromise) {
    recoveryPromise = recover().catch((error) => {
      recoveryPromise = undefined;
      throw error;
    });
  }
  return recoveryPromise;
}
