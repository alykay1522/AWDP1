import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

let readyPromise: Promise<void> | undefined;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT session_pkey PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      );
      CREATE INDEX IF NOT EXISTS idx_session_expire ON admin_sessions (expire);
    `)
      .then(() => {
        logger.info("serverless admin_sessions table ready");
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
