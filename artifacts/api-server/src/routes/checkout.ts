import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { z } from "zod";
import { sendOrderNotification } from "../emailNotifier";
import { isPayPalCheckoutOnly } from "../lib/checkoutMode.js";

const router = Router();

// GET /api/checkout/options — public; tells the storefront whether Stripe checkout is available
router.get("/checkout/options", (_req, res) => {
  res.json({ checkoutPayPalOnly: isPayPalCheckoutOnly() });
});

const CartItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
  // name and price are accepted from the client but IGNORED — the server
  // re-prices every item from the catalog before charging.
  name: z.string().optional(),
  price: z.number().optional(),
});

const CheckoutRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  customerEmail: z.string().email().optional(),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
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
 * Returns { verifiedItems } or throws an error string.
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

// POST /api/checkout/session — Create a Stripe checkout session
router.post("/checkout/session", async (req, res) => {
  try {
    if (isPayPalCheckoutOnly()) {
      return res.status(503).json({
        error: "stripe_checkout_disabled",
        message: "Card checkout is not available. Please complete your order with PayPal.",
      });
    }

    const parsed = CheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    const { items: rawItems, customerEmail, successUrl, cancelUrl } = parsed.data;

    // Re-price every item from the catalog — ignore client-supplied prices
    let items: Awaited<ReturnType<typeof serverPriceItems>>;
    try {
      items = await serverPriceItems(rawItems);
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

    const stripe = await getUncachableStripeClient();
    const orderId = generateOrderId();

    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          metadata: { sku: item.sku },
          ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const baseUrl = successUrl
      ? new URL(successUrl).origin
      : `https://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      customer_email: customerEmail,
      customer_creation: "always",
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 1295, currency: "usd" },
            display_name: "Standard Ground",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 2495, currency: "usd" },
            display_name: "Priority Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 3 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 4995, currency: "usd" },
            display_name: "Express Overnight",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 1 },
              maximum: { unit: "business_day", value: 1 },
            },
          },
        },
      ],
      automatic_tax: { enabled: true },
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: {
          message:
            "Most items are special order and ship within 1-3 business days. Questions? Call 785-533-0244.",
        },
      },
      metadata: { orderId },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${baseUrl}/cart`,
    });

    // Save order to DB in "pending" state using server-verified prices
    await db.insert(ordersTable).values({
      orderId,
      stripeSessionId: session.id,
      customerName: customerEmail?.split("@")[0] || "Customer",
      customerEmail: customerEmail || "",
      lineItems: items,
      subtotal: subtotal.toFixed(2),
      shippingCost: "0",
      total: subtotal.toFixed(2),
      status: "pending",
    });

    res.json({ url: session.url, orderId, sessionId: session.id });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});

// GET /api/checkout/order/:orderId — Get order status (public, PII-free)
router.get("/checkout/order/:orderId", async (req, res) => {
  try {
    const [order] = await db
      .select({
        orderId: ordersTable.orderId,
        status: ordersTable.status,
        createdAt: ordersTable.createdAt,
        total: ordersTable.total,
      })
      .from(ordersTable)
      .where(eq(ordersTable.orderId, req.params.orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkout/fulfill — Completes a Stripe Checkout session (success page, retries, ops).
// Intentionally NOT gated on isPayPalCheckoutOnly(): new Stripe sessions are blocked at POST
// /checkout/session, but a customer may land here with session_id after a config flip or old tab;
// returning 503 would strand already-paid checkouts in "pending".
router.post("/checkout/fulfill", async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) return res.status(400).json({ error: "sessionId required" });

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["shipping_details", "customer_details"],
    });

    if (session.payment_status === "paid") {
      const shipping = session.shipping_details?.address;
      const customerName = session.customer_details?.name || "";
      const customerEmail = session.customer_details?.email || "";
      const customerPhone = session.customer_details?.phone || "";
      const shippingAddress = shipping
        ? {
            line1: shipping.line1 || "",
            line2: shipping.line2 || undefined,
            city: shipping.city || "",
            state: shipping.state || "",
            postal_code: shipping.postal_code || "",
            country: shipping.country || "",
          }
        : undefined;

      await db
        .update(ordersTable)
        .set({
          status: "paid",
          stripePaymentIntentId: String(session.payment_intent ?? ""),
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.stripeSessionId, sessionId));

      // Fetch the full order for email
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.stripeSessionId, sessionId))
        .limit(1);

      if (order) {
        const lineItems = Array.isArray(order.lineItems) ? order.lineItems as any[] : [];
        sendOrderNotification({
          orderId: order.orderId,
          customerName,
          customerEmail,
          customerPhone: customerPhone || undefined,
          shippingAddress,
          items: lineItems.map((i: any) => ({
            name: i.name,
            sku: i.sku,
            price: Number(i.price),
            quantity: Number(i.quantity),
          })),
          subtotal: order.subtotal,
          total: order.total,
          paymentMethod: "stripe",
        }).catch((err) => console.error("[email] sendOrderNotification error:", err));
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
