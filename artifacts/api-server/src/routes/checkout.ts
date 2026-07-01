import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { createPayPalOrder, capturePayPalOrder } from "../paypalClient";
import { z } from "zod";
import { sendOrderNotification } from "../emailNotifier";
import { isPayPalCheckoutOnly } from "../lib/checkoutMode.js";
import { calculateShipping } from "../lib/shipping.js";
import { logger } from "../lib/logger";
import { amountsMatch } from "../lib/paypalAmounts.js";

const router = Router();

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

function generateOrderId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "AWDP-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function serverPriceItems(rawItems: Array<{ sku: string; quantity: number; imageUrl?: string }>) {
  const skus = rawItems.map(i => i.sku);

  const dbProducts = await db
    .select({
      sku: productsTable.sku,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
    })
    .from(productsTable)
    .where(inArray(productsTable.sku, skus));

  const productMap = new Map(dbProducts.map(p => [p.sku, p]));

  const missing = skus.filter(s => !productMap.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown SKU(s): ${missing.join(", ")}`);
  }

  return rawItems.map(item => {
    const p = productMap.get(item.sku)!;
    const rawPrice = p.price;
    const price = typeof rawPrice === "string" ? parseFloat(rawPrice) : Number(rawPrice);

    if (!price || price <= 0 || isNaN(price)) {
      throw new Error(`Item "${p.name}" (${item.sku}) is not available for online purchase. Please call 785-533-0244 for pricing.`);
    }

    return {
      sku: p.sku,
      name: p.name,
      price,
      quantity: item.quantity,
      imageUrl: p.imageUrl ?? undefined,
    };
  });
}

// PayPal endpoints for frontend compatibility
router.post("/checkout/create-order", async (req, res) => {
  try {
    const parsed = z.object({ items: z.array(CartItemSchema).min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }

    let items;
    try {
      items = await serverPriceItems(parsed.data.items);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < 50) {
      return res.status(400).json({ error: `Order minimum is $50.` });
    }

    const shipping = calculateShipping(subtotal);
    const total = subtotal + shipping.cost;
    const orderId = generateOrderId();

    const paypalOrder = await createPayPalOrder({
      items: items.map(i => ({ name: i.name, sku: i.sku, price: i.price, quantity: i.quantity })),
      orderId,
      shippingCost: shipping.cost,
    });

    await db.insert(ordersTable).values({
      orderId,
      customerName: "Customer",
      customerEmail: "",
      lineItems: items,
      subtotal: subtotal.toFixed(2),
      shippingCost: shipping.cost.toFixed(2),
      total: total.toFixed(2),
      status: "pending",
    });

    res.json({ paypalOrderId: paypalOrder.id, orderId, shippingCost: shipping.cost, shippingLabel: shipping.label, total });
  } catch (err: any) {
    logger.error({ err }, "create-order error");
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.post("/checkout/capture-order", async (req, res) => {
  try {
    const { paypalOrderId, orderId } = req.body as { paypalOrderId?: string; orderId?: string };

    if (!paypalOrderId || !orderId) {
      return res.status(400).json({ error: "paypalOrderId and orderId are required" });
    }

    const [localOrder] = await db
      .select({ orderId: ordersTable.orderId, total: ordersTable.total, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.orderId, orderId))
      .limit(1);

    if (!localOrder) {
      return res.status(404).json({ error: "Order not found" });
    }
    if (localOrder.status === "paid") {
      return res.status(400).json({ error: "Order has already been fulfilled" });
    }

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status === "COMPLETED") {
      // Verify that the captured PayPal order's reference_id matches the local orderId.
      // This prevents an attacker from paying for a cheap order and marking an expensive
      // local order as paid by substituting the expensive orderId in this request.
      const capturedReferenceId = capture.purchase_units?.[0]?.reference_id;
      if (!capturedReferenceId || capturedReferenceId !== orderId) {
        logger.error(
          { capturedReferenceId, requestedOrderId: orderId },
          "[PayPal] reference_id mismatch"
        );
        return res.status(400).json({ error: "Order reference mismatch. Payment not applied." });
      }

      // Defense-in-depth: verify captured amount matches local order total
      const capturedAmountStr = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
      const capturedAmount = capturedAmountStr ? parseFloat(capturedAmountStr) : null;
      const localTotal = parseFloat(localOrder.total as string);
      if (!amountsMatch(capturedAmount, localTotal)) {
        logger.error(
          { capturedAmount: capturedAmountStr, localTotal: localOrder.total },
          "[PayPal] Amount mismatch"
        );
        return res.status(400).json({ error: "Captured payment amount does not match order total." });
      }

      const payer = capture.payer;
      const pu = capture.purchase_units?.[0];
      const shipping = pu?.shipping;

      const customerEmail = payer?.email_address || "";
      const customerName =
        shipping?.name?.full_name ||
        `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim() ||
        "Customer";
      const shippingAddress = shipping?.address
        ? {
            line1: shipping.address.address_line_1 || "",
            line2: shipping.address.address_line_2 || undefined,
            city: shipping.address.admin_area_2 || "",
            state: shipping.address.admin_area_1 || "",
            postal_code: shipping.address.postal_code || "",
            country: shipping.address.country_code || "US",
          }
        : undefined;

      await db
        .update(ordersTable)
        .set({
          status: "paid",
          customerEmail,
          customerName,
          shippingAddress,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.orderId, orderId));

      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.orderId, orderId))
        .limit(1);

      if (order) {
        const lineItems = Array.isArray(order.lineItems) ? order.lineItems as any[] : [];
        sendOrderNotification({
          orderId: order.orderId,
          customerName,
          customerEmail,
          shippingAddress,
          items: lineItems.map((i: any) => ({
            name: i.name,
            sku: i.sku,
            price: Number(i.price),
            quantity: Number(i.quantity),
          })),
          subtotal: order.subtotal,
          total: order.total,
          paymentMethod: "paypal",
        }).catch((err) => logger.error({ err }, "[email] sendOrderNotification error"));
      }

      res.json({ success: true, orderId });
    }

    res.status(400).json({ error: "Payment not completed", status: capture.status });
  } catch (err: any) {
    logger.error({ err }, "capture-order error");
    res.status(500).json({ error: err.message || "Failed to capture payment" });
  }
});

export default router;
