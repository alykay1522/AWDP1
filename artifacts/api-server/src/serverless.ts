import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

/** Vercel captures pino lines; localhost debug ingest may also receive the same payload. */
function agentDebugLog(payload: Record<string, unknown>) {
  logger.info({ agentDebug: true, ...payload }, "agent-debug");
  // #region agent log
  fetch("http://127.0.0.1:7256/ingest/d6a176f9-8366-4471-9af1-d6201858799f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "0e9545" },
    body: JSON.stringify({ sessionId: "0e9545", timestamp: Date.now(), ...payload }),
  }).catch(() => {});
  // #endregion
}

let readyPromise: Promise<void> | undefined;

const ADMIN_SESSIONS_DDL = `
CREATE TABLE IF NOT EXISTS admin_sessions (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
)`;

/** Non-CONCURRENTLY index: safe for rare cold-start DDL when the table was missing. */
const ADMIN_SESSIONS_INDEX_DDL = `
CREATE INDEX IF NOT EXISTS idx_session_expire ON admin_sessions (expire)`;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = pool
      .query<{ exists: boolean }>(`
      SELECT to_regclass('public.admin_sessions') IS NOT NULL AS "exists"
    `)
      .then(async (result) => {
        let exists = result.rows[0]?.exists === true;
        agentDebugLog({
          runId: "post-fix",
          hypothesisId: "H1",
          location: "serverless.ts:ensureReady:afterQuery",
          message: "admin_sessions regclass check",
          data: { adminSessionsTableExists: exists },
        });
        if (!exists) {
          agentDebugLog({
            runId: "post-fix",
            hypothesisId: "H1",
            location: "serverless.ts:ensureReady:autoDdl",
            message: "admin_sessions missing; running CREATE TABLE + index",
            data: {},
          });
          await pool.query(ADMIN_SESSIONS_DDL);
          await pool.query(ADMIN_SESSIONS_INDEX_DDL);
          exists = true;
          agentDebugLog({
            runId: "post-fix",
            hypothesisId: "H1",
            location: "serverless.ts:ensureReady:autoDdlDone",
            message: "admin_sessions auto DDL finished",
            data: { adminSessionsTableExists: exists },
          });
          logger.info("serverless auto-created admin_sessions table");
        }
        logger.info("serverless admin_sessions table verified");
      })
      .catch((err) => {
        readyPromise = undefined;
        logger.warn({ err }, "serverless database startup failed");
        agentDebugLog({
          runId: "post-fix",
          hypothesisId: "H1-H2",
          location: "serverless.ts:ensureReady:catch",
          message: "ensureReady failed",
          data: {
            errName: err && typeof err === "object" && "name" in err ? String((err as Error).name) : "unknown",
            errMessage: err && typeof err === "object" && "message" in err ? String((err as Error).message).slice(0, 400) : String(err).slice(0, 400),
          },
        });
        throw err;
      });
  }

  return readyPromise;
}

function sendJson503(res: ServerResponse, body: Record<string, unknown>) {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = typeof (req as { url?: string }).url === "string" ? (req as { url: string }).url.slice(0, 200) : "";
  agentDebugLog({
    runId: "post-fix",
    hypothesisId: "H0",
    location: "serverless.ts:handler:entry",
    message: "vercel serverless handler entry",
    data: { method: req.method, url },
  });
  try {
    await ensureReady();
  } catch (err) {
    agentDebugLog({
      runId: "post-fix",
      hypothesisId: "H1-H2",
      location: "serverless.ts:handler:ensureReadyCatch",
      message: "ensureReady rejected in handler",
      data: {
        errName: err && typeof err === "object" && "name" in err ? String((err as Error).name) : "unknown",
        errMessage: err && typeof err === "object" && "message" in err ? String((err as Error).message).slice(0, 400) : String(err).slice(0, 400),
      },
    });
    const detail =
      err && typeof err === "object" && "message" in err ? String((err as Error).message).slice(0, 400) : String(err).slice(0, 400);
    sendJson503(res, {
      error: "Admin API database is unavailable or session storage could not be initialized.",
      detail,
    });
    return;
  }
  agentDebugLog({
    runId: "post-fix",
    hypothesisId: "H4-H5",
    location: "serverless.ts:handler:beforeApp",
    message: "calling express app",
    data: { method: req.method, url },
  });
  return app(req, res);
}
