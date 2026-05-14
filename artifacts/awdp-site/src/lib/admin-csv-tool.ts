/** Shared helpers for the admin CSV hub (parse, template scoring, column mapping). */

export const PRODUCT_IMPORT_CHUNK = 400;
export const RESOURCE_IMPORT_CHUNK = 200;

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQuote = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") {
          fields.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }
  const headers = splitLine(lines[0]);
  return lines.slice(1).filter((l) => l.trim()).map((l) => {
    const vals = splitLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

export function compactHeaderKey(h: string): string {
  return h.toLowerCase().replace(/[\s\-_.]+/g, "");
}

/** Catalog import / export field names (match `GET /api/admin/products/export`). */
export const CATALOG_EXPORT_KEYS = [
  "sku",
  "name",
  "description",
  "price",
  "originalPrice",
  "cost",
  "category",
  "supplier",
  "inStock",
  "imageUrl",
  "tags",
  "compatibleBrands",
  "specifications",
] as const;

export type CatalogExportKey = (typeof CATALOG_EXPORT_KEYS)[number];

/** Normalised alias → canonical catalog key (subset mirroring server `normalizeRow`). */
const CATALOG_ALIAS_TO_KEY: { alias: string; key: CatalogExportKey }[] = [
  { alias: "sku", key: "sku" },
  { alias: "awdpsku", key: "sku" },
  { alias: "partnumber", key: "sku" },
  { alias: "itemnumber", key: "sku" },
  { alias: "code", key: "sku" },
  { alias: "name", key: "name" },
  { alias: "productname", key: "name" },
  { alias: "title", key: "name" },
  { alias: "description", key: "description" },
  { alias: "longdescription", key: "description" },
  { alias: "price", key: "price" },
  { alias: "sellingprice", key: "price" },
  { alias: "ourprice", key: "price" },
  { alias: "originalprice", key: "originalPrice" },
  { alias: "msrp", key: "originalPrice" },
  { alias: "cost", key: "cost" },
  { alias: "dealercost", key: "cost" },
  { alias: "category", key: "category" },
  { alias: "supplier", key: "supplier" },
  { alias: "vendor", key: "supplier" },
  { alias: "brand", key: "supplier" },
  { alias: "instock", key: "inStock" },
  { alias: "stock", key: "inStock" },
  { alias: "qty", key: "inStock" },
  { alias: "imageurl", key: "imageUrl" },
  { alias: "tags", key: "tags" },
  { alias: "keywords", key: "tags" },
  { alias: "compatiblebrands", key: "compatibleBrands" },
  { alias: "specifications", key: "specifications" },
  { alias: "specs", key: "specifications" },
];

export const DESCRIPTION_CANONICAL = [
  "product_title",
  "source_site",
  "product_url",
  "description_clean",
  "min_order_qty",
  "sold_in_pairs",
  "sold_in_packs",
  "min_lineal_feet",
  "unit_type",
  "notes_raw_rules",
] as const;

export type DescriptionKey = (typeof DESCRIPTION_CANONICAL)[number];

const DESCRIPTION_ALIAS: { alias: string; key: DescriptionKey }[] = [
  { alias: "producttitle", key: "product_title" },
  { alias: "title", key: "product_title" },
  { alias: "name", key: "product_title" },
  { alias: "productname", key: "product_title" },
  { alias: "sourcesite", key: "source_site" },
  { alias: "site", key: "source_site" },
  { alias: "producturl", key: "product_url" },
  { alias: "url", key: "product_url" },
  { alias: "descriptionclean", key: "description_clean" },
  { alias: "description", key: "description_clean" },
  { alias: "body", key: "description_clean" },
  { alias: "minorderqty", key: "min_order_qty" },
  { alias: "soldinpairs", key: "sold_in_pairs" },
  { alias: "soldinpacks", key: "sold_in_packs" },
  { alias: "minlinealfeet", key: "min_lineal_feet" },
  { alias: "unittype", key: "unit_type" },
  { alias: "notesrawrules", key: "notes_raw_rules" },
  { alias: "notes", key: "notes_raw_rules" },
];

export const RESOURCE_EXPORT_KEYS = [
  "id",
  "title",
  "brand",
  "category",
  "type",
  "url",
  "description",
  "sortOrder",
  "isActive",
] as const;

export type ResourceExportKey = (typeof RESOURCE_EXPORT_KEYS)[number];

const RESOURCE_ALIAS: { alias: string; key: ResourceExportKey }[] = [
  { alias: "id", key: "id" },
  { alias: "title", key: "title" },
  { alias: "name", key: "title" },
  { alias: "brand", key: "brand" },
  { alias: "category", key: "category" },
  { alias: "type", key: "type" },
  { alias: "url", key: "url" },
  { alias: "pdfurl", key: "url" },
  { alias: "link", key: "url" },
  { alias: "description", key: "description" },
  { alias: "sortorder", key: "sortOrder" },
  { alias: "order", key: "sortOrder" },
  { alias: "isactive", key: "isActive" },
  { alias: "active", key: "isActive" },
];

export type FlowId = "catalog" | "description" | "resources";

export interface FlowScore {
  flow: FlowId;
  score: number;
  max: number;
  detail: string;
}

function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map(compactHeaderKey));
}

/** Heuristic 0–1 style scores for routing suggestions. */
export function scoreImportFlows(headers: string[]): FlowScore[] {
  const hs = headerSet(headers);
  let catalog = 0;
  const catHints: string[] = [];
  if (hs.has("sku") || hs.has("awdpsku") || hs.has("partnumber") || hs.has("itemnumber")) {
    catalog += 2;
    catHints.push("SKU-like column");
  }
  if (hs.has("price") || hs.has("sellingprice") || hs.has("cost")) {
    catalog += 1;
    catHints.push("price/cost");
  }
  if (hs.has("name") || hs.has("productname") || hs.has("title")) {
    catalog += 1;
    catHints.push("name/title");
  }
  const catalogMax = 4;
  const catalogNorm = catalog / catalogMax;

  let desc = 0;
  const descHints: string[] = [];
  if (hs.has("producttitle")) {
    desc += 2;
    descHints.push("product_title");
  } else if (hs.has("title") && (hs.has("descriptionclean") || hs.has("description"))) {
    desc += 1.5;
    descHints.push("title+description");
  }
  if (hs.has("descriptionclean") || hs.has("description")) desc += 1;
  if (hs.has("soldinpairs") || hs.has("minorderqty") || hs.has("unittype")) {
    desc += 0.5;
    descHints.push("ordering hints");
  }
  const descMax = 3.5;
  const descNorm = Math.min(1, desc / descMax);

  let res = 0;
  const resHints: string[] = [];
  if (hs.has("pdfurl") || (hs.has("url") && (hs.has("type") || hs.has("doctype")))) {
    res += 1.5;
    resHints.push("url+type");
  }
  if (hs.has("title") && hs.has("category") && hs.has("url")) {
    res += 1.5;
    resHints.push("title+category+url");
  }
  if (hs.has("sortorder") || hs.has("isactive")) res += 0.5;
  const resMax = 3.5;
  const resNorm = Math.min(1, res / resMax);

  return [
    {
      flow: "catalog",
      score: catalogNorm,
      max: catalogMax,
      detail: catHints.join(", ") || "weak match",
    },
    {
      flow: "description",
      score: descNorm,
      max: descMax,
      detail: descHints.join(", ") || "weak match",
    },
    {
      flow: "resources",
      score: resNorm,
      max: resMax,
      detail: resHints.join(", ") || "weak match",
    },
  ].sort((a, b) => b.score - a.score);
}

function firstUnusedMatch(
  headers: string[],
  used: Set<string>,
  aliases: string[],
): string {
  for (const h of headers) {
    if (used.has(h)) continue;
    const c = compactHeaderKey(h);
    if (aliases.includes(c)) {
      used.add(h);
      return h;
    }
  }
  return "";
}

/** Default CSV column → catalog export key mapping from headers. */
export function suggestCatalogMapping(headers: string[]): Record<CatalogExportKey, string> {
  const used = new Set<string>();
  const out = {} as Record<CatalogExportKey, string>;
  for (const key of CATALOG_EXPORT_KEYS) out[key] = "";

  for (const { alias, key } of CATALOG_ALIAS_TO_KEY) {
    if (out[key]) continue;
    const found = firstUnusedMatch(headers, used, [alias]);
    if (found) out[key] = found;
  }
  return out;
}

export function suggestDescriptionMapping(headers: string[]): Record<DescriptionKey, string> {
  const used = new Set<string>();
  const out = {} as Record<DescriptionKey, string>;
  for (const key of DESCRIPTION_CANONICAL) out[key] = "";
  for (const { alias, key } of DESCRIPTION_ALIAS) {
    if (out[key]) continue;
    const found = firstUnusedMatch(headers, used, [alias]);
    if (found) out[key] = found;
  }
  return out;
}

export function suggestResourceMapping(headers: string[]): Record<ResourceExportKey, string> {
  const used = new Set<string>();
  const out = {} as Record<ResourceExportKey, string>;
  for (const key of RESOURCE_EXPORT_KEYS) out[key] = "";
  for (const { alias, key } of RESOURCE_ALIAS) {
    if (out[key]) continue;
    const found = firstUnusedMatch(headers, used, [alias]);
    if (found) out[key] = found;
  }
  return out;
}

/** Build rows keyed by export field names for `POST /api/admin/products/import`. */
export function buildMappedRows<T extends string>(
  rows: Record<string, string>[],
  mapping: Record<T, string>,
  keys: readonly T[],
): Record<string, string>[] {
  return rows.map((raw) => {
    const row: Record<string, string> = {};
    for (const k of keys) {
      const src = mapping[k];
      row[k] = src ? (raw[src] ?? "").trim() : "";
    }
    return row;
  });
}

function csvEscapeCell(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Serialize rows for multipart upload to description matcher. */
export function rowsToCsv(headers: readonly string[], rows: Record<string, string>[]): string {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscapeCell(r[h] ?? "")).join(","));
  }
  return lines.join("\r\n");
}

export function buildDescriptionRowsForApi(
  rows: Record<string, string>[],
  mapping: Record<DescriptionKey, string>,
): Record<string, string>[] {
  return buildMappedRows(rows, mapping, DESCRIPTION_CANONICAL);
}

export function catalogTemplateCsv(): string {
  const h = [...CATALOG_EXPORT_KEYS];
  return [h.join(","), h.map(() => "").join(",")].join("\r\n");
}

export function descriptionTemplateCsv(): string {
  const h = [...DESCRIPTION_CANONICAL];
  return [h.join(","), h.map(() => "").join(",")].join("\r\n");
}

export function resourceTemplateCsv(): string {
  const h = [...RESOURCE_EXPORT_KEYS];
  return [h.join(","), h.map(() => "").join(",")].join("\r\n");
}

export function triggerDownload(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
