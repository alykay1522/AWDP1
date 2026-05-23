import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const isProductionLike = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (isProductionLike && /(?:localhost|127\.0\.0\.1|\[?::1\]?)/i.test(databaseUrl)) {
    res.status(500).json({
      status: "error",
      error: "DATABASE_URL points to localhost in production; set it to the hosted Postgres connection string.",
    });
    return;
  }

  try {
    await pool.query("SELECT 1");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: "error",
      error: `Database connection failed: ${message}`,
    });
    return;
  }

  // Check that critical tables exist
  try {
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('products', 'categories', 'orders')
      ORDER BY table_name
    `);
    const tables = tableCheck.rows.map((r: { table_name: string }) => r.table_name);
    const missing = ["products", "categories", "orders"].filter((t) => !tables.includes(t));
    if (missing.length > 0) {
      res.status(500).json({
        status: "error",
        error: `Missing tables: ${missing.join(", ")}. Run: DATABASE_URL="..." pnpm --filter @workspace/db run push`,
        existingTables: tables,
      });
      return;
    }

    const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM products");
    const productCount = (countResult.rows[0] as { count: number }).count;

    res.json({ ...HealthCheckResponse.parse({ status: "ok" }), tables, productCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: "error",
      error: `Table check failed: ${message}`,
    });
  }
});

export default router;
