import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Pool } from "pg";
import * as schema from "./schema";

const { Pool: PgPool } = pg;

type AppDb = NodePgDatabase<typeof schema>;

function buildSslConfig(): pg.ClientConfig["ssl"] {
  if (process.env.NODE_ENV !== "production") return undefined;
  if (process.env.DATABASE_URL?.includes("sslmode=disable")) {
    throw new Error(
      "[SECURITY] DATABASE_URL contains 'sslmode=disable' in production. " +
        "Unencrypted database connections are not permitted. " +
        "Remove 'sslmode=disable' from DATABASE_URL to enforce TLS.",
    );
  }
  const strict = process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false";
  return { rejectUnauthorized: strict };
}

function createPoolInstance(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const poolMin = Number(process.env.PG_POOL_MIN ?? (process.env.VERCEL ? "0" : "2"));
  const poolMax = Number(process.env.PG_POOL_MAX ?? (process.env.VERCEL ? "2" : "10"));

  const p = new PgPool({
    connectionString: process.env.DATABASE_URL,
    min: poolMin,
    max: poolMax,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
    ssl: buildSslConfig(),
  });

  p.on("error", (err: Error) => {
    console.error("Unexpected pool error", err);
  });

  return p;
}

let poolInstance: Pool | undefined;

/** Prefer this in new code; `pool` is a lazy Proxy for backwards compatibility. */
export function getPool(): Pool {
  if (!poolInstance) poolInstance = createPoolInstance();
  return poolInstance;
}

/**
 * Lazy pool: avoids throwing during module evaluation when DATABASE_URL is unset
 * or when production SSL rules fail — callers get errors on first query instead.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const p = getPool();
    const value = Reflect.get(p, prop, receiver);
    if (typeof value === "function") {
      return (value as (...a: unknown[]) => unknown).bind(p);
    }
    return value;
  },
});

let dbInstance: AppDb | undefined;

function getDb(): AppDb {
  if (!dbInstance) {
    /** Drizzle touches the pool at construction — must not run at @workspace/db import time. */
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

/**
 * Lazy Drizzle client: `drizzle(pool)` would probe the pool Proxy immediately and
 * defeat lazy DB connection; first route/handler access initializes the pool + ORM.
 */
export const db = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const d = getDb();
    const value = Reflect.get(d, prop, receiver);
    if (typeof value === "function") {
      return (value as (...a: unknown[]) => unknown).bind(d);
    }
    return value;
  },
});

export * from "./schema";
