import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createPayPalOrder, capturePayPalOrder } from "../paypalClient";
import { z } from "zod";
import { sendOrderNotification } from "../emailNotifier";

const router = Router();

const CartItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
  // name and price accepted but IGNORED — server re-prices from catalog
  name: z.string().optional(),
  price: z.number().optional(),
});

const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
});

function generateOrderId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "AWDP-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Re-prices every cart item against the live catalog.
 * Throws if any SKU is unknown or not available for online purchase.
 */
async function serverPriceItems(
  rawItems: Array<{ sku: string; quantity: number; imageUrl?: string }>,
): Promise<Array<{ sku: string; name: string; price: number; quantity: number; imageUrl?: string }>> {
  const skus = rawItems.map((i) => i.sku);

  const dbProducts = await db
    .select({
      sku: productsTable.sku,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
    })
    .from(productsTable)
    .where(inArray(productsTable.sku, skus));

  const productMap = new Map(dbProducts.map((p) => [p.sku, p]));

  const missing = skus.filter((s) => !productMap.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown SKU(s): ${missing.join(", ")}`);
  }

  return rawItems.map((item) => {
    const p = productMap.get(item.sku)!;
    const price = parseFloat(p.price as string);
    if (price <= 0) {
      throw new Error(
        `Item "${p.name}" (${item.sku}) is not available for online purchase. Please call 785-533-0244 for pricing.`,
      );
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

// POST /api/paypal/create-order
router.post("/paypal/create-order", async (req, res) => {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    // Re-price every item from the catalog — ignore client-supplied prices
    let items: Awaited<ReturnType<typeof serverPriceItems>>;
    try {
      items = await serverPriceItems(parsed.data.items);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const ORDER_MINIMUM = 50;
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal < ORDER_MINIMUM) {
      return res.status(400).json({
        error: `Order minimum is $${ORDER_MINIMUM.toFixed(2)}. Your cart total is $${subtotal.toFixed(2)}.`,
      });
    }

    const orderId = generateOrderId();

    const paypalOrder = await createPayPalOrder({
      items: items.map((item) => ({
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
      })),
      orderId,
    });

    // Save pending order to DB using server-verified prices
    await db.insert(ordersTable).values({
      orderId,
      customerName: "Customer",
      customerEmail: "",
      lineItems: items,
      subtotal: subtotal.toFixed(2),
      shippingCost: "0",
      total: subtotal.toFixed(2),
      status: "pending",
    });

    res.json({ paypalOrderId: paypalOrder.id, orderId });
  } catch (err: any) {
    console.error("PayPal create-order error:", err.message);
    res.status(500).json({ error: err.message || "Failed to create PayPal order" });
  }
});

// POST /api/paypal/capture-order
router.post("/paypal/capture-order", async (req, res) => {
  try {
    const { paypalOrderId, orderId } = req.body as { paypalOrderId: string; orderId: string };

    if (!paypalOrderId || !orderId) {
      return res.status(400).json({ error: "paypalOrderId and orderId are required" });
    }

    // Fetch the local pending order BEFORE capture so we can validate amounts
    const [localOrder] = await db
      .select({ orderId: ordersTable.orderId, total: ordersTable.total, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.orderId, orderId))
      .limit(1);

    if (!localOrder) {
      return res.status(404).json({ error: "Local order not found" });
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
        console.error(
          `[PayPal] reference_id mismatch: PayPal has "${capturedReferenceId}", request claims "${orderId}"`,
        );
        return res.status(400).json({ error: "Order reference mismatch. Payment not applied." });
      }

      // Defense-in-depth: verify captured amount matches local order total
      const capturedAmountStr = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
      const capturedAmount = capturedAmountStr ? parseFloat(capturedAmountStr) : null;
      const localTotal = parseFloat(localOrder.total as string);
      if (capturedAmount === null || Math.abs(capturedAmount - localTotal) > 0.01) {
        console.error(
          `[PayPal] Amount mismatch: PayPal captured $${capturedAmountStr}, local order total $${localOrder.total}`,
        );
        return res.status(400).json({ error: "Captured payment amount does not match order total." });
      }

      const payer = capture.payer;
      const pu = capture.purchase_units?.[0];
      const shipping = pu?.shipping;
      const captureId = pu?.payments?.captures?.[0]?.id;

      const customerEmail = payer?.email_address || "";
      const customerName =
        shipping?.name?.full_name ||
        `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim() ||
        "Customer";
      const shippingAddress = shipping?.address
        ? {
            line1: shipping.address.address_line_1 || "",
            line2: shipping.address.address_line_2,
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

      // Fetch order for email
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
        }).catch((err) => console.error("[email] sendOrderNotification error:", err));
      }

      res.json({ success: true, orderId, captureId });
    } else {
      res.status(400).json({ error: "Payment not completed", status: capture.status });
    }
  } catch (err: any) {
    console.error("PayPal capture error:", err.message);
    res.status(500).json({ error: err.message || "Failed to capture PayPal payment" });
  }
});

// GET /api/paypal/client-id — expose client ID to frontend safely
router.get("/paypal/client-id", (_req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: "PayPal not configured" });
  }
  res.json({ clientId });
});

export default router;
