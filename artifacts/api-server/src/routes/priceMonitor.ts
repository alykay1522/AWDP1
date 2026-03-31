/**
 * Admin Price Monitor API
 * GET  /api/admin/price-alerts   — latest price check per product, with alert status
 * POST /api/admin/price-check    — trigger a new price check (background)
 * POST /api/admin/price-manual   — manually record a distributor price
 * POST /api/admin/price-dismiss  — dismiss an alert (mark as ok)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, distributorPricesTable } from "@workspace/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";

const router = Router();

// GET /api/admin/price-alerts
// Returns: latest price check per product, flagging anything needing attention
router.get("/admin/price-alerts", async (_req, res) => {
  try {
    // Get the most recent check per (product_sku, distributor)
    const latestChecks = await db.execute(sql`
      SELECT DISTINCT ON (product_sku, distributor)
        dp.id,
        dp.product_sku,
        dp.distributor,
        dp.distributor_sku,
        dp.distributor_url,
        dp.cost_price,
        dp.our_price,
        dp.markup_ratio,
        dp.target_markup,
        dp.status,
        dp.notes,
        dp.checked_at,
        p.name AS product_name,
        p.category,
        p.supplier
      FROM distributor_prices dp
      LEFT JOIN products p ON p.sku = dp.product_sku
      ORDER BY dp.product_sku, dp.distributor, dp.checked_at DESC
    `);

    const rows = latestChecks.rows as any[];

    // Group by status
    const alerts = rows.filter(r => r.status !== "ok");
    const ok = rows.filter(r => r.status === "ok");
    const noPrice = rows.filter(r => r.status === "no_price");
    const needsUpdate = rows.filter(r => ["needs_update", "cost_up"].includes(r.status));
    const costDown = rows.filter(r => r.status === "cost_down");

    // Summary stats
    const summary = {
      total: rows.length,
      ok: ok.length,
      needsUpdate: needsUpdate.length,
      costDown: costDown.length,
      noPrice: noPrice.length,
      lastChecked: rows[0]?.checked_at ?? null,
    };

    res.json({
      summary,
      alerts: rows.sort((a, b) => {
        // Sort: needs_update first, cost_up, cost_down, no_price, ok last
        const order = { needs_update: 0, cost_up: 1, cost_down: 2, no_price: 3, ok: 4 };
        return (order[a.status as keyof typeof order] ?? 5) - (order[b.status as keyof typeof order] ?? 5);
      }),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/price-history/:sku
router.get("/admin/price-history/:sku", async (req, res) => {
  try {
    const history = await db
      .select()
      .from(distributorPricesTable)
      .where(eq(distributorPricesTable.productSku, req.params.sku))
      .orderBy(desc(distributorPricesTable.checkedAt))
      .limit(50);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/price-manual — add a manual price entry
router.post("/admin/price-manual", async (req, res) => {
  try {
    const { productSku, distributor, distributorSku, distributorUrl, costPrice, notes } = req.body as {
      productSku: string;
      distributor: string;
      distributorSku?: string;
      distributorUrl?: string;
      costPrice: number;
      notes?: string;
    };

    if (!productSku || !distributor || !costPrice) {
      return res.status(400).json({ error: "productSku, distributor, and costPrice are required" });
    }

    const [product] = await db.select().from(productsTable).where(eq(productsTable.sku, productSku)).limit(1);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const ourPrice = parseFloat(product.price);
    const targetMarkup = distributor === "Alcosupply" ? 2.5 : 1.45;
    const markupRatio = ourPrice / costPrice;
    const status = markupRatio < targetMarkup * 0.95 ? "needs_update" : "ok";

    const [record] = await db.insert(distributorPricesTable).values({
      productSku,
      distributor,
      distributorSku: distributorSku ?? null,
      distributorUrl: distributorUrl ?? null,
      costPrice: String(costPrice.toFixed(2)),
      ourPrice: String(ourPrice.toFixed(2)),
      markupRatio: String(markupRatio.toFixed(4)),
      targetMarkup: String(targetMarkup),
      status: "manual",
      notes: notes || `Manual entry: Cost $${costPrice} → Our $${ourPrice} (${markupRatio.toFixed(2)}x)`,
    }).returning();

    res.json({ success: true, record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/price-update-our — update our selling price and recalculate
router.post("/admin/price-update-our", async (req, res) => {
  try {
    const { productSku, newPrice } = req.body as { productSku: string; newPrice: number };
    if (!productSku || !newPrice) return res.status(400).json({ error: "productSku and newPrice required" });

    await db.update(productsTable)
      .set({ price: String(newPrice.toFixed(2)) })
      .where(eq(productsTable.sku, productSku));

    res.json({ success: true, productSku, newPrice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
