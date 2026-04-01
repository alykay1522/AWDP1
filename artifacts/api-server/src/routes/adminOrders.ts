import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq, desc, count, sql } from "drizzle-orm";

const router = Router();

// GET /api/admin/orders — list all orders newest first
router.get("/admin/orders", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;

    const query = db
      .select()
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt));

    const orders = status
      ? await db.select().from(ordersTable).where(eq(ordersTable.status, status)).orderBy(desc(ordersTable.createdAt))
      : await query;

    const stats = await db
      .select({
        status: ordersTable.status,
        count: count(),
        total: sql<string>`sum(${ordersTable.total}::numeric)`,
      })
      .from(ordersTable)
      .groupBy(ordersTable.status);

    res.json({ orders, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/orders/:orderId/status — update order status
router.patch("/admin/orders/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body as { status: string; notes?: string };

    const validStatuses = ["pending", "paid", "processing", "shipped", "completed", "cancelled", "refunded"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const [updated] = await db
      .update(ordersTable)
      .set({ status, notes: notes ?? undefined, updatedAt: new Date() })
      .where(eq(ordersTable.orderId, orderId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ order: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
