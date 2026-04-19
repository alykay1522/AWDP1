import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { seedIfEmpty, fixProductCategories, migrateLegacyCategories } from "./seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  pool.query("SELECT 1")
    .then(() => {
      logger.info("Database connection pool warmed up");
      // Ensure the session table exists (needed in production on first deploy)
      return pool.query(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT session_pkey PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
        );
        CREATE INDEX IF NOT EXISTS idx_session_expire ON admin_sessions (expire);
      `)
        .then(() => {
          logger.info("admin_sessions table ready");
          return seedIfEmpty();
        })
        .then(() => migrateLegacyCategories())
        .then(() => fixProductCategories());
    })
    .catch((e) => {
      logger.warn({ err: e }, "Database startup failed");
    });
});
