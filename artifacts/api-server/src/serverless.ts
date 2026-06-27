import type { IncomingMessage, ServerResponse } from "node:http";
import { gunzipSync } from "node:zlib";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureCatalogNormalized } from "./lib/catalogNormalization";
import { ensureCatalogSkuGuard } from "./lib/catalogSkuGuard";
import { ensureCatalogSeeded } from "./lib/catalogSeed";

let readyPromise: Promise<void> | undefined;
const RESTORE_PATH = "/api/internal-catalog-restore-8e3c77";

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
        const exists = result.rows[0]?.exists === true;
        if (!exists) {
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

async function handleRestore(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "https://www.allwindowdoorparts.com");
  if (url.pathname !== RESTORE_PATH) return false;

  const action = url.searchParams.get("action");
  if (action === "chunk") {
    const part = Number(url.searchParams.get("part"));
    const data = url.searchParams.get("data") ?? "";
    if (!Number.isInteger(part) || part < 0 || part > 20 || data.length < 1 || data.length > 3500) {
      sendJson(res, 400, { error: "Invalid restore chunk" });
      return true;
    }
    await pool.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [`catalog_restore_8e3c77_${part}`, data],
    );
    sendJson(res, 200, { ok: true, part, size: data.length });
    return true;
  }

  if (action === "finalize") {
    const parts = Number(url.searchParams.get("parts"));
    if (!Number.isInteger(parts) || parts < 1 || parts > 20) {
      sendJson(res, 400, { error: "Invalid restore part count" });
      return true;
    }
    const keys = Array.from({ length: parts }, (_, index) => `catalog_restore_8e3c77_${index}`);
    const stored = await pool.query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key = ANY($1::text[])",
      [keys],
    );
    const values = new Map(stored.rows.map((row) => [row.key, row.value]));
    const missing = keys.filter((key) => !values.has(key));
    if (missing.length) {
      sendJson(res, 400, { error: "Missing restore chunks", missing });
      return true;
    }

    const encoded = keys.map((key) => values.get(key)).join("");
    const decoded = gunzipSync(Buffer.from(encoded, "base64url")).toString("utf8");
    const products = JSON.parse(decoded) as Array<Record<string, unknown>>;
    const skus = products.map((product) => String(product.sku ?? ""));
    if (
      products.length !== 28 ||
      new Set(skus).size !== products.length ||
      skus.some((sku) => !sku.startsWith("AWDP-"))
    ) {
      sendJson(res, 400, { error: "Restore validation failed", rows: products.length });
      return true;
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
          image_url = EXCLUDED.image_url,
          attributes = EXCLUDED.attributes,
          sold_as = EXCLUDED.sold_as`,
        [JSON.stringify(products)],
      );
      await client.query("DELETE FROM site_settings WHERE key = ANY($1::text[])", [keys]);
      const countResult = await client.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM products",
      );
      await client.query("COMMIT");
      sendJson(res, 200, {
        ok: true,
        imported: products.length,
        catalogCount: Number(countResult.rows[0]?.count ?? 0),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return true;
  }

  sendJson(res, 400, { error: "Invalid restore action" });
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
