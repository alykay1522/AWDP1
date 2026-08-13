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
    const requiredTables = ["products", "categories", "orders"];

    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name
    `, [requiredTables]);
    const tables = tableCheck.rows.map((r: { table_name: string }) => r.table_name);
    const missingTables = requiredTables.filter((t) => !tables.includes(t));
    if (missingTables.length > 0) {
      res.status(500).json({
        status: "error",
        error: `Missing tables: ${missingTables.join(", ")}. Run: DATABASE_URL="..." pnpm --filter @workspace/db run push`,
        existingTables: tables,
      });
      return;
    }

    const requiredOrderColumns = [
      "id",
      "order_id",
      "customer_id",
      "stripe_session_id",
      "stripe_payment_intent_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "shipping_address",
      "line_items",
      "subtotal",
      "shipping_cost",
      "total",
      "status",
      "notes",
      "created_at",
      "updated_at",
    ];

    const orderColumnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = ANY($1)
    `, [requiredOrderColumns]);
    const orderColumns = orderColumnCheck.rows.map((r: { column_name: string }) => r.column_name);
    const missingOrderColumns = requiredOrderColumns.filter((c) => !orderColumns.includes(c));
    if (missingOrderColumns.length > 0) {
      res.status(500).json({
        status: "error",
        error: `Missing columns on orders table: ${missingOrderColumns.join(", ")}. Run: DATABASE_URL="..." pnpm --filter @workspace/db run push`,
        tables,
        existingOrderColumns: orderColumns,
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
