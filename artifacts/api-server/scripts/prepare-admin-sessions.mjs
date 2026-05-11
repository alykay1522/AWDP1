import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before preparing admin sessions.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl:
    process.env.NODE_ENV === "production" && !process.env.DATABASE_URL.includes("sslmode=disable")
      ? { rejectUnauthorized: true }
      : undefined,
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT session_pkey PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `);

  await pool.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_expire
    ON admin_sessions (expire)
  `);

  console.log("admin_sessions table and concurrent expire index are ready.");
} finally {
  await pool.end();
}
