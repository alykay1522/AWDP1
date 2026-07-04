import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Pool } from "pg";
import * as schema from "./schema";

const { Pool: PgPool } = pg;

type AppDb = NodePgDatabase<typeof schema>;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseDatabaseUrl(raw: string): pg.PoolConfig {
  const url = new URL(raw);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// protocol");
  }

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (process.env.NODE_ENV === "production" && sslMode === "disable") {
    throw new Error(
      "[SECURITY] DATABASE_URL contains 'sslmode=disable' in production. " +
        "Unencrypted database connections are not permitted. " +
        "Remove 'sslmode=disable' from DATABASE_URL to enforce TLS.",
    );
  }

  const shouldUseSsl = process.env.NODE_ENV === "production"
    || Boolean(sslMode && sslMode !== "disable" && sslMode !== "allow");
  const strictSsl = process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false";
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  if (!url.hostname || !database) {
    throw new Error("DATABASE_URL must include a database host and database name");
  }

  return {
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 5432,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: shouldUseSsl ? { rejectUnauthorized: strictSsl } : undefined,
    application_name: url.searchParams.get("application_name") ?? "awdp-api",
    options: url.searchParams.get("options") ?? undefined,
    enableChannelBinding: url.searchParams.get("channel_binding") === "require",
  };
}

function createPoolInstance(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
  }

  const isServerless = Boolean(process.env.VERCEL);
  const poolMin = positiveInteger(process.env.PG_POOL_MIN, isServerless ? 0 : 2);
  // Public catalog requests often issue a data query and count query together. A
  // two-connection pool allowed one request to starve every concurrent request.
  const poolMax = Math.max(1, positiveInteger(process.env.PG_POOL_MAX, isServerless ? 4 : 10));
  const connectionTimeoutMillis = positiveInteger(process.env.PG_CONNECTION_TIMEOUT_MS, 15_000);
  const idleTimeoutMillis = positiveInteger(process.env.PG_IDLE_TIMEOUT_MS, isServerless ? 15_000 : 60_000);

  const p = new PgPool({
    ...parseDatabaseUrl(databaseUrl),
    min: Math.min(poolMin, poolMax),
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    allowExitOnIdle: isServerless,
  });

  p.on("error", (error: Error) => {
    console.error("Unexpected PostgreSQL pool error", error);
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
      return (value as (...args: unknown[]) => unknown).bind(p);
    }
    return value;
  },
});

let dbInstance: AppDb | undefined;

function getDb(): AppDb {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

/** Lazy Drizzle client; first route access initializes the pool and ORM. */
export const db = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const d = getDb();
    const value = Reflect.get(d, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(d);
    }
    return value;
  },
});

export * from "./schema";
