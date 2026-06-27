import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureCatalogNormalized } from "./lib/catalogNormalization";
import { ensureCatalogSkuGuard } from "./lib/catalogSkuGuard";
import { ensureCatalogSeeded } from "./lib/catalogSeed";
import { CATALOG_OPTION_HINTS } from "./lib/catalogOptionHints";
import { CATALOG_REMAINING_SOURCES } from "./data/catalogRemainingSources";
import { CATALOG_REMAINING_ENCODED_SOURCES } from "./data/catalogRemainingEncodedSources";

let readyPromise: Promise<void> | undefined;
const RESTORE_PATH = "/api/internal-catalog-source-restore-8e3c77";
const remainingSources = [
  ...CATALOG_REMAINING_SOURCES,
  ...CATALOG_REMAINING_ENCODED_SOURCES,
] as ReadonlyArray<readonly [string, string]>;

const ADMIN_SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS admin_sessions (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
)`;

const ADMIN_SESSIONS_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_session_expire ON admin_sessions (expire)`;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = pool
      .query<{ exists: boolean }>(`
        SELECT to_regclass('public.admin_sessions') IS NOT NULL AS "exists"
      `)
      .then(async (result) => {
        if (result.rows[0]?.exists !== true) {
          await pool.query(ADMIN_SESSIONS_DDL);
          await pool.query(ADMIN_SESSIONS_INDEX_DDL);
          logger.info("serverless auto-created admin_sessions table");
        }

        const catalogSummary = await ensureCatalogNormalized();
        await ensureCatalogSkuGuard();
        const seedSummary = await ensureCatalogSeeded();
        logger.info(
          { catalogSummary, seedSummary },
          "catalog normalization, SKU guard, and recovery seed verified",
        );
      })
      .catch((error) => {
        readyPromise = undefined;
        logger.warn({ error }, "serverless database startup failed");
        throw error;
      });
  }

  return readyPromise;
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(value: string): string {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>|<\/li>|<\/div>|<\/h\d>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function metaContent(html: string, property: string): string {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return "";
}

function fallbackName(sku: string): string {
  return sku
    .replace(/^AWDP-/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadSourceProduct(sku: string, sourceUrl: string) {
  let html = "";
  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent": "AllWindowDoorParts-Catalog-Restore/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (response.ok) html = await response.text();
  } catch (error) {
    logger.warn({ error, sku, sourceUrl }, "catalog source fetch failed");
  }

  const title =
    metaContent(html, "og:title") ||
    cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "") ||
    fallbackName(sku);
  const imageUrl = metaContent(html, "og:image") || null;
  const bodyMatch = html.match(
    /<div\b[^>]*class=["'][^"']*(?:field-name-body|field--name-body)[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
  );
  const description =
    cleanText(bodyMatch?.[1] ?? "") ||
    metaContent(html, "description") ||
    `Replacement window and door hardware: ${fallbackName(sku)}.`;
  const itempropPrice =
    html.match(/itemprop=["']price["'][^>]+content=["']([0-9,.]+)["']/i)?.[1] ??
    html.match(/content=["']([0-9,.]+)["'][^>]+itemprop=["']price["']/i)?.[1];
  const textPrice = cleanText(html).match(/Price:\s*\$\s*([0-9,]+(?:\.\d{1,2})?)/i)?.[1];
  const numericPrice = Number(String(itempropPrice ?? textPrice ?? "0").replace(/,/g, ""));
  const hint = CATALOG_OPTION_HINTS[sku.toUpperCase()];

  return {
    sku,
    name: title.replace(/\s*\|\s*Window Door Hardware Parts\s*$/i, "").trim(),
    description: description.slice(0, 20_000),
    price: Number.isFinite(numericPrice) ? numericPrice.toFixed(2) : "0.00",
    imageUrl,
    category: "Other Hardware",
    supplier: "All Window Door Parts",
    inStock: true,
    attributes: hint?.attributes ?? null,
    soldAs: hint?.soldAs ?? null,
  };
}

async function upsertSourceProducts(products: Awaited<ReturnType<typeof loadSourceProduct>>[]) {
  await pool.query(
    `INSERT INTO products (
      sku, name, description, price, original_price, category, subcategory,
      supplier, in_stock, image_url, tags, specifications,
      compatible_brands, variant_group_id, variant_label, attributes, sold_as
    )
    SELECT
      source.sku, source.name, source.description, source.price::numeric,
      NULL, source.category, NULL, source.supplier, source."inStock",
      source."imageUrl", '[]'::json, '{}'::json, '[]'::json,
      NULL, NULL, source.attributes::json, source."soldAs"
    FROM jsonb_to_recordset($1::jsonb) AS source(
      sku text, name text, description text, price text, "imageUrl" text,
      category text, supplier text, "inStock" boolean,
      attributes jsonb, "soldAs" text
    )
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      price = EXCLUDED.price,
      category = EXCLUDED.category,
      supplier = EXCLUDED.supplier,
      in_stock = EXCLUDED.in_stock,
      image_url = coalesce(EXCLUDED.image_url, products.image_url),
      attributes = coalesce(EXCLUDED.attributes, products.attributes),
      sold_as = coalesce(EXCLUDED.sold_as, products.sold_as)`,
    [JSON.stringify(products)],
  );
}

async function handleRestore(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "https://www.allwindowdoorparts.com");
  if (url.pathname !== RESTORE_PATH) return false;

  const start = Math.max(0, Number(url.searchParams.get("start")) || 0);
  const count = Math.min(4, Math.max(1, Number(url.searchParams.get("count")) || 4));
  const selected = remainingSources.slice(start, start + count);
  if (!selected.length) {
    sendJson(res, 400, { error: "No catalog sources in requested range" });
    return true;
  }

  const products = await Promise.all(
    selected.map(([sku, sourceUrl]) => loadSourceProduct(sku, sourceUrl)),
  );
  await upsertSourceProducts(products);
  const totalResult = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM products",
  );
  sendJson(res, 200, {
    ok: true,
    start,
    imported: products.length,
    skus: products.map((product) => product.sku),
    catalogCount: Number(totalResult.rows[0]?.count ?? 0),
  });
  return true;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    await ensureReady();
    if (await handleRestore(req, res)) return;
  } catch (error) {
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as Error).message).slice(0, 400)
        : String(error).slice(0, 400);
    sendJson(res, 503, {
      error: "API database initialization failed.",
      detail,
    });
    return;
  }

  try {
    await Promise.resolve(app(req, res));
  } catch (error) {
    logger.error({ error }, "serverless request handler failed");
    const detail =
      error && typeof error === "object" && "message" in error
        ? String((error as Error).message).slice(0, 400)
        : String(error).slice(0, 400);
    sendJson(res, 500, {
      error: "API request failed during handling.",
      detail,
    });
  }
}
