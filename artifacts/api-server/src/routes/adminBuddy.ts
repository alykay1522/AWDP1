import { Router } from "express";
import { pool } from "@workspace/db";

type CheckStatus = "ok" | "warn" | "error";

interface BuddyCheck {
  key: string;
  label: string;
  status: CheckStatus;
  summary: string;
  detail?: string;
  value?: string | number | boolean | null;
}

const router = Router();

async function runCheck(check: () => Promise<BuddyCheck>): Promise<BuddyCheck> {
  try {
    return await check();
  } catch (err) {
    return {
      key: "unexpected",
      label: "Unexpected check failure",
      status: "error",
      summary: err instanceof Error ? err.message : String(err),
    };
  }
}

async function tableExists(name: string) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name],
  );
  return Boolean(result.rows[0]?.exists);
}

async function countRows(table: string) {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function getAdminBuddySnapshot() {
  const envChecks: BuddyCheck[] = [
    {
      key: "env-session-secret",
      label: "Session secret",
      status: process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-me-in-production" ? "ok" : "error",
      summary: process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-me-in-production"
        ? "Configured"
        : "Missing or still using the default value",
    },
    {
      key: "env-admin-password",
      label: "Admin password",
      status: process.env.ADMIN_PASSWORD ? "ok" : "error",
      summary: process.env.ADMIN_PASSWORD ? "Configured" : "Missing ADMIN_PASSWORD",
    },
    {
      key: "env-database-url",
      label: "Database URL",
      status: process.env.DATABASE_URL ? "ok" : "error",
      summary: process.env.DATABASE_URL ? "Configured" : "Missing DATABASE_URL",
    },
    {
      key: "env-openai",
      label: "AI model key",
      status: process.env.OPENAI_API_KEY ? "ok" : "warn",
      summary: process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY is configured"
        : "OPENAI_API_KEY is not configured; buddy will use built-in diagnostics only",
    },
  ];

  const dbChecks = await Promise.all([
    runCheck(async () => {
      await pool.query("SELECT 1");
      return { key: "db-connect", label: "Database connection", status: "ok", summary: "Connected" };
    }),
    runCheck(async () => {
      const required = ["products", "categories", "orders", "parts_id_requests", "contact_submissions"];
      const existing = await Promise.all(required.map(async (name) => [name, await tableExists(name)] as const));
      const missing = existing.filter(([, exists]) => !exists).map(([name]) => name);
      return {
        key: "db-tables",
        label: "Required tables",
        status: missing.length ? "error" : "ok",
        summary: missing.length ? `Missing: ${missing.join(", ")}` : "All required tables exist",
        detail: existing.map(([name, exists]) => `${name}: ${exists ? "ok" : "missing"}`).join("; "),
      };
    }),
    runCheck(async () => {
      if (!(await tableExists("products"))) {
        return { key: "products-count", label: "Products", status: "error", summary: "products table is missing" };
      }
      const count = await countRows("products");
      return {
        key: "products-count",
        label: "Products",
        status: count > 0 ? "ok" : "warn",
        summary: count > 0 ? `${count.toLocaleString()} products found` : "No products found",
        value: count,
      };
    }),
    runCheck(async () => {
      if (!(await tableExists("orders"))) {
        return { key: "orders-count", label: "Orders", status: "error", summary: "orders table is missing" };
      }
      const count = await countRows("orders");
      return {
        key: "orders-count",
        label: "Orders API data",
        status: "ok",
        summary: `${count.toLocaleString()} orders available`,
        value: count,
      };
    }),
    runCheck(async () => {
      if (!(await tableExists("sister_site_prices"))) {
        return {
          key: "price-sync-table",
          label: "Price sync data",
          status: "warn",
          summary: "sister_site_prices table is missing; price sync scrape/apply cannot fully run",
        };
      }
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count, MAX(scraped_at) AS last_scraped FROM sister_site_prices`,
      );
      const row = result.rows[0] as { count?: number; last_scraped?: string | null };
      return {
        key: "price-sync-table",
        label: "Price sync data",
        status: Number(row.count ?? 0) > 0 ? "ok" : "warn",
        summary: Number(row.count ?? 0) > 0
          ? `${Number(row.count).toLocaleString()} sister-site rows; last scraped ${row.last_scraped ?? "unknown"}`
          : "Price sync table exists but has no scraped rows",
        value: Number(row.count ?? 0),
      };
    }),
  ]);

  const checks = [...envChecks, ...dbChecks];
  const status: CheckStatus = checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  return {
    status,
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function summarize(snapshot: Awaited<ReturnType<typeof getAdminBuddySnapshot>>, question?: string) {
  const errors = snapshot.checks.filter((c) => c.status === "error");
  const warnings = snapshot.checks.filter((c) => c.status === "warn");
  const ok = snapshot.checks.filter((c) => c.status === "ok");

  const lines = [
    snapshot.status === "ok"
      ? "Admin health looks good right now."
      : snapshot.status === "warn"
        ? "Admin is running, but there are items to review."
        : "Admin has issues that can break parts of the portal.",
    `Checks passed: ${ok.length}. Warnings: ${warnings.length}. Errors: ${errors.length}.`,
  ];

  if (question?.trim()) {
    lines.push(`You asked: ${question.trim()}`);
  }
  if (errors.length) {
    lines.push(`Fix first: ${errors.map((c) => `${c.label} - ${c.summary}`).join("; ")}.`);
  }
  if (warnings.length) {
    lines.push(`Watch next: ${warnings.map((c) => `${c.label} - ${c.summary}`).join("; ")}.`);
  }
  if (!errors.length && !warnings.length) {
    lines.push("The admin dashboard, order data path, and required database checks are all reporting healthy.");
  }

  return lines.join("\n\n");
}

router.get("/admin/buddy/health", async (_req, res) => {
  const snapshot = await getAdminBuddySnapshot();
  res.status(snapshot.status === "error" ? 500 : 200).json({
    ...snapshot,
    message: summarize(snapshot),
  });
});

router.post("/admin/buddy/chat", async (req, res) => {
  const question = typeof req.body?.message === "string" ? req.body.message : "";
  const snapshot = await getAdminBuddySnapshot();
  res.json({
    ...snapshot,
    reply: summarize(snapshot, question),
  });
});

export default router;
