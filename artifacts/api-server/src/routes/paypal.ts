import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { createPayPalOrder, capturePayPalOrder } from "../paypalClient";
import { z } from "zod";
import { sendOrderNotification } from "../emailNotifier";
import { calculateShipping } from "../lib/shipping.js";
import { logger } from "../lib/logger";
import rateLimit from "express-rate-limit";

const router = Router();

const createOrderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts. Please try again in 15 minutes." },
  statusCode: 429,
});

const captureOrderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many payment attempts. Please wait a few minutes and try again." },
  statusCode: 429,
});

const CartItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().optional(),
  selectedAttributes: z.record(z.string()).optional(),
  // name and price accepted but IGNORED — server re-prices from catalog
  name: z.string().optional(),
  price: z.number().optional(),
});

const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
});

const CaptureOrderSchema = z.object({
  paypalOrderId: z.string().trim().regex(/^[A-Za-z0-9-]{5,64}$/),
  orderId: z.string().regex(/^AWDP-[A-HJ-NP-Z2-9]{8}$/),
});

function generateOrderId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "AWDP-";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function optionLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Re-prices every cart item against the live catalog.
 * Throws if any SKU is unknown, out of stock, or not available for online purchase.
 */
async function serverPriceItems(
  rawItems: Array<{
    sku: string;
    quantity: number;
    imageUrl?: string;
    selectedAttributes?: Record<string, string>;
  }>,
): Promise<
  Array<{
    sku: string;
    name: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    selectedAttributes?: Record<string, string>;
  }>
> {
  const skus = rawItems.map((item) => item.sku);

  const dbProducts = await db
    .select({
      sku: productsTable.sku,
      name: productsTable.name,
      price: productsTable.price,
      imageUrl: productsTable.imageUrl,
      inStock: productsTable.inStock,
    })
    .from(productsTable)
    .where(inArray(productsTable.sku, skus));

  const productMap = new Map(dbProducts.map((product) => [product.sku, product]));

  const missing = skus.filter((sku) => !productMap.has(sku));
  if (missing.length > 0) {
    throw new Error(`Unknown SKU(s): ${missing.join(", ")}`);
  }

  return rawItems.map((item) => {
    const product = productMap.get(item.sku)!;
    if (!product.inStock) {
      throw new Error(
        `Item "${product.name}" (${item.sku}) is currently unavailable. Please remove it from your cart or call 785-533-0244 for assistance.`,
      );
    }

    const price = parseFloat(product.price as string);
    if (price <= 0) {
      throw new Error(
        `Item "${product.name}" (${item.sku}) is not available for online purchase. Please call 785-533-0244 for pricing.`,
      );
    }

    const selectedAttributes = Object.fromEntries(
      Object.entries(item.selectedAttributes ?? {})
        .map(([key, value]) => [key, String(value).trim()])
        .filter(([, value]) => value !== "")
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    const optionSummary = Object.entries(selectedAttributes)
      .map(([key, value]) => `${optionLabel(key)}: ${value}`)
      .join(", ");

    return {
      sku: product.sku,
      name: optionSummary ? `${product.name} (${optionSummary})` : product.name,
      price,
      quantity: item.quantity,
      imageUrl: product.imageUrl ?? undefined,
      selectedAttributes,
    };
  });
}

// POST /api/paypal/create-order
router.post("/paypal/create-order", createOrderRateLimiter, async (req, res) => {
  try {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }

    let items: Awaited<ReturnType<typeof serverPriceItems>>;
    try {
      items = await serverPriceItems(parsed.data.items);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }

    const ORDER_MINIMUM = 50;
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal < ORDER_MINIMUM) {
      return res.status(400).json({
        error: `Order minimum is $${ORDER_MINIMUM.toFixed(2)}. Your cart total is $${subtotal.toFixed(2)}.`,
      });
    }

    const shipping = calculateShipping(subtotal);
    const total = subtotal + shipping.cost;
    const orderId = generateOrderId();

    const paypalOrder = await createPayPalOrder({
      items: items.map((item) => ({
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
      })),
      orderId,
      shippingCost: shipping.cost,
    });

    const sessionCustomerId = (req.session as any)?.customerId;
    await db.insert(ordersTable).values({
      orderId,
      customerId: typeof sessionCustomerId === "number" ? sessionCustomerId : null,
      customerName: "Customer",
      customerEmail: "",
      lineItems: items,
      subtotal: subtotal.toFixed(2),
      shippingCost: shipping.cost.toFixed(2),
      total: total.toFixed(2),
      status: "pending",
    });

    res.json({
      paypalOrderId: paypalOrder.id,
      orderId,
      shippingCost: shipping.cost,
      shippingLabel: shipping.label,
      total,
    });
  } catch (error: any) {
    logger.error({ error }, "PayPal create-order error");
    res.status(500).json({ error: error.message || "Failed to create PayPal order" });
  }
});

// POST /api/paypal/capture-order
router.post("/paypal/capture-order", captureOrderRateLimiter, async (req, res) => {
  try {
    const parsed = CaptureOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Valid paypalOrderId and orderId are required" });
    }

    const { paypalOrderId, orderId } = parsed.data;

    const [localOrder] = await db
      .select({ orderId: ordersTable.orderId, total: ordersTable.total, status: ordersTable.status })
      .from(ordersTable)
      .where(eq(ordersTable.orderId, orderId))
      .limit(1);

    if (!localOrder) {
      return res.status(404).json({ error: "Local order not found" });
    }

    // A browser/network retry can arrive after the first capture completed and the
    // local order was already marked paid. Treat that as a successful idempotent
    // retry instead of telling a charged customer that the payment failed.
    if (localOrder.status === "paid") {
      logger.info({ orderId }, "PayPal capture retry for an already-paid order");
      return res.json({ success: true, orderId, alreadyProcessed: true });
    }

    const capture = await capturePayPalOrder(paypalOrderId);

    if (capture.status === "COMPLETED") {
      const capturedReferenceId = capture.purchase_units?.[0]?.reference_id;
      if (!capturedReferenceId || capturedReferenceId !== orderId) {
        logger.error(
          { capturedReferenceId, requestedOrderId: orderId },
          "[PayPal] reference_id mismatch",
        );
        return res.status(400).json({ error: "Order reference mismatch. Payment not applied." });
      }

      const capturedAmountStr = capture.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
      const capturedAmount = capturedAmountStr ? parseFloat(capturedAmountStr) : null;
      const localTotal = parseFloat(localOrder.total as string);
      if (capturedAmount === null || Math.abs(capturedAmount - localTotal) > 0.02) {
        logger.error(
          { capturedAmount: capturedAmountStr, localTotal: localOrder.total },
          "[PayPal] Amount mismatch",
        );
        return res.status(400).json({ error: "Captured payment amount does not match order total." });
      }

      const payer = capture.payer;
      const purchaseUnit = capture.purchase_units?.[0];
      const shipping = purchaseUnit?.shipping;
      const captureId = purchaseUnit?.payments?.captures?.[0]?.id;

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

      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.orderId, orderId))
        .limit(1);

      if (order) {
        const lineItems = Array.isArray(order.lineItems) ? (order.lineItems as any[]) : [];
        sendOrderNotification({
          orderId: order.orderId,
          customerName,
          customerEmail,
          shippingAddress,
          items: lineItems.map((item: any) => ({
            name: item.name,
            sku: item.sku,
            price: Number(item.price),
            quantity: Number(item.quantity),
          })),
          subtotal: order.subtotal,
          total: order.total,
          paymentMethod: "paypal",
        }).catch((error) => logger.error({ error }, "[email] sendOrderNotification error"));
      }

      res.json({ success: true, orderId, captureId });
    } else {
      res.status(400).json({ error: "Payment not completed", status: capture.status });
    }
  } catch (error: any) {
    logger.error({ error }, "PayPal capture error");
    res.status(500).json({ error: error.message || "Payment capture failed" });
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
