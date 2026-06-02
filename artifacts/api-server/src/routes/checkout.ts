import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { createPayPalOrder, capturePayPalOrder } from "../paypalClient";
import { z } from "zod";
import { sendOrderNotification } from "../emailNotifier";
import { isPayPalCheckoutOnly } from "../lib/checkoutMode.js";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/checkout/options
router.get("/checkout/options", (_req, res) => {
  res.json({ checkoutPayPalOnly: isPayPalCheckoutOnly() });
});

const CartItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
  name: z.string().optional(),
  price: z.number().optional(),
});

function generateOrderId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "AWDP-";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

async function serverPriceItems(rawItems) {
  const skus = rawItems.map(i => i.sku);
  const dbProducts = await db.select({
    sku: productsTable.sku, name: productsTable.name, price: productsTable.price, imageUrl: productsTable.imageUrl
  }).from(productsTable).where(inArray(productsTable.sku, skus));

  const productMap = new Map(dbProducts.map(p => [p.sku, p]));
  const missing = skus.filter(s => !productMap.has(s));
  if (missing.length > 0) throw new Error(`Unknown SKU(s): ${missing.join(", ")}`);

  return rawItems.map(item => {
    const p = productMap.get(item.sku)!;
    const price = parseFloat(p.price);
    if (price <= 0) throw new Error(`Item "${p.name}" is not available for online purchase.`);
    return { sku: p.sku, name: p.name, price, quantity: item.quantity, imageUrl: p.imageUrl ?? undefined };
  });
}

// =====================================================
// PAYPAL ENDPOINTS
// =====================================================

router.post("/checkout/create-order", async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(CartItemSchema).min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });

    let items;
    try { items = await serverPriceItems(parsed.data.items); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < 50) return res.status(400).json({ error: "Order minimum is $50." });

    const orderId = generateOrderId();
    const paypalOrder = await createPayPalOrder({
      items: items.map(i => ({ name: i.name, sku: i.sku, price: i.price, quantity: i.quantity })),
      orderId
    });

    await db.insert(ordersTable).values({
      orderId, customerName: "Customer", customerEmail: "", lineItems: items,
      subtotal: subtotal.toFixed(2), shippingCost: "0", total: subtotal.toFixed(2), status: "pending"
    });

    res.json({ paypalOrderId: paypalOrder.id, orderId });
  } catch (err) {
    logger.error({ err }, "create-order error");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.post("/checkout/capture-order", async (req, res) => {
  try {
    const { paypalOrderId, orderId } = req.body;
    if (!paypalOrderId || !orderId) return res.status(400).json({ error: "Missing parameters" });

    const [localOrder] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId)).limit(1);
    if (!localOrder) return res.status(404).json({ error: "Order not found" });
    if (localOrder.status === "paid") return res.status(400).json({ error: "Already paid" });

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status === "COMPLETED") {
      const pu = capture.purchase_units?.[0];
      const payer = capture.payer || pu?.payer || {};

      // Strengthened email capture - check multiple possible locations + fallback to local order
      const customerEmail =
        payer?.email_address ||
        capture.payer?.email_address ||
        pu?.payer?.email_address ||
        localOrder.customerEmail ||
        "";

      const customerName =
        pu?.shipping?.name?.full_name ||
        payer?.name?.full_name ||
        `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim() ||
        localOrder.customerName ||
        "Customer";

      const shipping = pu?.shipping;
      const shippingAddress = shipping?.address ? {
        line1: shipping.address.address_line_1 || "",
        city: shipping.address.admin_area_2 || "",
        state: shipping.address.admin_area_1 || "",
        postal_code: shipping.address.postal_code || "",
        country: shipping.address.country_code || "US",
      } : undefined;

      await db.update(ordersTable).set({
        status: "paid",
        customerEmail,
        customerName,
        shippingAddress,
        updatedAt: new Date(),
      }).where(eq(ordersTable.orderId, orderId));

      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderId, orderId)).limit(1);
      if (order) {
        sendOrderNotification({
          orderId: order.orderId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          shippingAddress: order.shippingAddress,
          items: order.lineItems || [],
          subtotal: order.subtotal,
          total: order.total,
          paymentMethod: "paypal",
        }).catch(e => logger.error({ e }, "sendOrderNotification error"));
      }

      return res.json({ success: true, orderId });
    }

    res.status(400).json({ error: "Payment not completed" });
  } catch (err) {
    logger.error({ err }, "capture-order error");
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

export default router;
