import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureCatalogRecovered } from "./lib/catalogRecovery";
import { ensureCatalogSkuGuardV2 } from "./lib/catalogSkuGuardV2";

let readyPromise: Promise<void> | undefined;

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

        const catalogRecovery = await ensureCatalogRecovered();
        await ensureCatalogSkuGuardV2();
        logger.info(
          { catalogRecovery },
          "catalog recovery and SKU guard verified",
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

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    await ensureReady();
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
