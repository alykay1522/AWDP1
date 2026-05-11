import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslConfig = (() => {
  if (process.env.NODE_ENV !== "production") return undefined;
  if (process.env.DATABASE_URL?.includes("sslmode=disable")) {
    throw new Error(
      "[SECURITY] DATABASE_URL contains 'sslmode=disable' in production. " +
        "Unencrypted database connections are not permitted. " +
        "Remove 'sslmode=disable' from DATABASE_URL to enforce TLS.",
    );
  }
  return { rejectUnauthorized: true };
})();

const poolMin = Number(process.env.PG_POOL_MIN ?? (process.env.VERCEL ? "0" : "2"));
const poolMax = Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? "2" : "10"));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: poolMin,
  max: poolMax,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  ssl: sslConfig,
});

pool.on("error", (err: Error) => {
  console.error("Unexpected pool error", err);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
