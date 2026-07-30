import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ensureCatalogNormalized } from "./lib/catalogNormalization";
import { ensureCatalogSkuGuard } from "./lib/catalogSkuGuard";

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

/**
 * Serverless Postgres compute (e.g. Neon) intermittently fails cold starts
 * with XX000 "startup failed" errors that succeed on retry. Retrying here
 * converts most would-be 503s into successful responses.
 */
const STARTUP_RETRY_DELAYS_MS = [500, 1500];

/**
 * Routes that never touch the database. These must not 503 just because the
 * database compute failed a cold start — legacy /wp-content/uploads assets
 * (rewritten to /api/legacy-pdf/...) resolve from in-memory redirect maps.
 */
const DB_FREE_PATH_PREFIXES = ["/api/legacy-pdf/", "/api/ping"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function initializeDatabase(): Promise<void> {
  const result = await pool.query<{ exists: boolean }>(`
    SELECT to_regclass('public.admin_sessions') IS NOT NULL AS "exists"
  `);
  const exists = result.rows[0]?.exists === true;
  if (!exists) {
    await pool.query(ADMIN_SESSIONS_DDL);
    await pool.query(ADMIN_SESSIONS_INDEX_DDL);
    logger.info("serverless auto-created admin_sessions table");
  }

<<<<<<< HEAD
  const catalogSummary = await ensureCatalogNormalized();
  await ensureCatalogSkuGuard();
  logger.info({ catalogSummary }, "catalog normalization and SKU guard verified");
=======
  // Catalog normalization is not required to serve a request, and definitely
  // not to issue a CSRF token. Running it inline meant a slow or failing
  // catalog pass 503'd the admin login — and because it sat inside the retry
  // loop, every failure re-ran the whole expensive pass up to three times.
  void (async () => {
    try {
      const catalogSummary = await ensureCatalogNormalized();
      await ensureCatalogSkuGuard();
      logger.info(
        { catalogSummary },
        "catalog normalization and SKU guard verified",
      );
    } catch (error) {
      logger.warn({ error }, "background catalog warmup failed");
    }
  })();
>>>>>>> ec73a62 (fix(api): stop catalog warmup blocking admin auth requests)
}

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= STARTUP_RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await sleep(STARTUP_RETRY_DELAYS_MS[attempt - 1]);
          logger.warn(
            { attempt, error: lastError },
            "retrying serverless database startup",
          );
        }
        try {
          await initializeDatabase();
          return;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    })().catch((error) => {
      readyPromise = undefined;
      logger.warn({ error }, "serverless database startup failed");
      throw error;
    });
  }

  return readyPromise;
}

function isDbFreeRequest(req: IncomingMessage): boolean {
  const rawPath = (req.url || "").split("?")[0];
  return DB_FREE_PATH_PREFIXES.some((prefix) => rawPath.startsWith(prefix));
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
  if (!isDbFreeRequest(req)) {
    try {
      await ensureReady();
    } catch (error) {
      const detail =
        error && typeof error === "object" && "message" in error
          ? String((error as Error).message).slice(0, 400)
          : String(error).slice(0, 400);
      res.setHeader("Retry-After", "300");
      sendJson(res, 503, {
        error: "API database initialization failed.",
        detail,
      });
      return;
    }
  } else {
    // Kick off warmup in the background without blocking the response.
    ensureReady().catch(() => {});
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
