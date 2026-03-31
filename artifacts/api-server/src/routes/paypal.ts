import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { createPayPalOrder, capturePayPalOrder } from "../paypalClient";
import { z } from "zod";

const router = Router();

const CartItemSchema = z.object({
  sku: z.string(),
  name: z.string(),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
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

// POST /api/paypal/create-order
router.post("/paypal/create-order", async (req, res) => {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    const { items } = parsed.data;
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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

    // Save pending order to DB
    await db.insert(ordersTable).values({
      orderId,
      customerName: "Customer",
      customerEmail: "",
      lineItems: items,
      subtotal: String(subtotal.toFixed(2)),
      shippingCost: "0",
      total: String(subtotal.toFixed(2)),
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

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status === "COMPLETED") {
      const payer = capture.payer;
      const pu = capture.purchase_units?.[0];
      const shipping = pu?.shipping;
      const captureId = pu?.payments?.captures?.[0]?.id;

      await db
        .update(ordersTable)
        .set({
          status: "paid",
          customerEmail: payer?.email_address || "",
          customerName:
            shipping?.name?.full_name ||
            `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim() ||
            "Customer",
          shippingAddress: shipping?.address
            ? {
                line1: shipping.address.address_line_1 || "",
                line2: shipping.address.address_line_2,
                city: shipping.address.admin_area_2 || "",
                state: shipping.address.admin_area_1 || "",
                postal_code: shipping.address.postal_code || "",
                country: shipping.address.country_code || "US",
              }
            : undefined,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.orderId, orderId));

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
