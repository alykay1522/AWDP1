import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { z } from "zod/v4";

const router = Router();

const CartItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
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

// POST /api/checkout/session — Create a Stripe checkout session
router.post("/checkout/session", async (req, res) => {
  try {
    const parsed = CheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    const { items, customerEmail, successUrl, cancelUrl } = parsed.data;

    const stripe = await getUncachableStripeClient();

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderId = generateOrderId();

    // Build Stripe line items using price_data
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
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      phone_number_collection: { enabled: true },
      custom_text: {
        submit: {
          message:
            "Orders typically ship within 1-2 business days. Questions? Call 785-533-0244.",
        },
      },
      metadata: { orderId },
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${baseUrl}/cart`,
    });

    // Save order to DB in "pending" state
    await db.insert(ordersTable).values({
      orderId,
      stripeSessionId: session.id,
      customerName: customerEmail?.split("@")[0] || "Customer",
      customerEmail: customerEmail || "",
      lineItems: items,
      subtotal: String(subtotal.toFixed(2)),
      shippingCost: "0",
      total: String(subtotal.toFixed(2)),
      status: "pending",
    });

    res.json({ url: session.url, orderId, sessionId: session.id });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    res.status(500).json({ error: err.message || "Failed to create checkout session" });
  }
});

// GET /api/checkout/order/:orderId — Get order status
router.get("/checkout/order/:orderId", async (req, res) => {
  try {
    const [order] = await db
      .select()
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

// POST /api/checkout/webhook-fulfill — Called from Stripe webhook to fulfill orders
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
      await db
        .update(ordersTable)
        .set({
          status: "paid",
          stripePaymentIntentId: String(session.payment_intent ?? ""),
          customerName: session.customer_details?.name || "",
          customerEmail: session.customer_details?.email || "",
          customerPhone: session.customer_details?.phone || "",
          shippingAddress: shipping
            ? {
                line1: shipping.line1 || "",
                line2: shipping.line2 || undefined,
                city: shipping.city || "",
                state: shipping.state || "",
                postal_code: shipping.postal_code || "",
                country: shipping.country || "",
              }
            : undefined,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.stripeSessionId, sessionId));
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
