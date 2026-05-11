import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

let readyPromise: Promise<void> | undefined;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = pool.query<{ exists: boolean }>(`
      SELECT to_regclass('public.admin_sessions') IS NOT NULL AS "exists"
    `)
      .then((result) => {
        if (result.rows[0]?.exists !== true) {
          throw new Error(
            "admin_sessions table is missing. Run `pnpm --filter @workspace/api-server run prepare-admin-sessions` before deploying.",
          );
        }
        logger.info("serverless admin_sessions table verified");
      })
      .catch((err) => {
        readyPromise = undefined;
        logger.warn({ err }, "serverless database startup failed");
        throw err;
      });
  }

  return readyPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureReady();
  return app(req, res);
}
