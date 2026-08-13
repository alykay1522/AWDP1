import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
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

const CheckoutAddressSchema = z.object({
  line1: z.string().trim().min(3, "Street address is required").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  postal_code: z.string().trim().min(3, "ZIP code is required").max(20),
  country: z.string().trim().length(2).default("US"),
});

const CheckoutCustomerSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("A valid email address is required").max(254),
  phone: z
    .string()
    .trim()
    .max(25)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }, "A valid phone number (at least 10 digits) is required"),
  address: CheckoutAddressSchema,
});

const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  // Contact info is REQUIRED to complete checkout — name, email, phone, address.
  customer: CheckoutCustomerSchema,
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

    const customer = parsed.data.customer;

    const paypalOrder = await createPayPalOrder({
      items: items.map((item) => ({
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
      })),
      orderId,
      shippingCost: shipping.cost,
      shipping: {
        fullName: customer.name,
        address: {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postal_code: customer.address.postal_code,
          country: customer.address.country,
        },
      },
    });

    const sessionCustomerId = (req.session as any)?.customerId;
    await db.insert(ordersTable).values({
      orderId,
      customerId: typeof sessionCustomerId === "number" ? sessionCustomerId : null,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      shippingAddress: {
        line1: customer.address.line1,
        line2: customer.address.line2,
        city: customer.address.city,
        state: customer.address.state,
        postal_code: customer.address.postal_code,
        country: customer.address.country,
      },
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
      .select({
        orderId: ordersTable.orderId,
        total: ordersTable.total,
        status: ordersTable.status,
        customerName: ordersTable.customerName,
        customerEmail: ordersTable.customerEmail,
        shippingAddress: ordersTable.shippingAddress,
      })
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

    // Funds are held by PayPal in a non-final state; a retry here would attempt a
    // second capture. Staff must reconcile instead.
    if (localOrder.status === "payment_review") {
      return res.status(409).json({
        error: "This payment is being reviewed by PayPal. Do not retry — we will email you once it settles.",
      });
    }

    // Atomically claim the order before talking to PayPal. Without this, two
    // concurrent requests can both observe status "pending" and both capture:
    // the second gets an error from PayPal and the customer sees a 500 despite
    // having been charged, and the fulfilment email fires twice.
    const claimed = await db
      .update(ordersTable)
      .set({ status: "capturing", updatedAt: new Date() })
      .where(and(eq(ordersTable.orderId, orderId), eq(ordersTable.status, "pending")))
      .returning({ orderId: ordersTable.orderId });

    if (claimed.length === 0) {
      const [current] = await db
        .select({ status: ordersTable.status })
        .from(ordersTable)
        .where(eq(ordersTable.orderId, orderId))
        .limit(1);
      if (current?.status === "paid") {
        return res.json({ success: true, orderId, alreadyProcessed: true });
      }
      logger.warn({ orderId, status: current?.status }, "Concurrent PayPal capture rejected");
      return res.status(409).json({ error: "This payment is already being processed. Please wait." });
    }

    /** Return the order to "pending" so a legitimate retry can proceed. Only safe
     *  when PayPal did NOT take any money. */
    const releaseClaim = async () => {
      await db
        .update(ordersTable)
        .set({ status: "pending", updatedAt: new Date() })
        .where(and(eq(ordersTable.orderId, orderId), eq(ordersTable.status, "capturing")));
    };

    /** Funds were taken but could not be reconciled. Park the order for staff and
     *  block retries, since retrying would attempt a second capture. */
    const markPaymentReview = async (reason: string) => {
      await db
        .update(ordersTable)
        .set({ status: "payment_review", updatedAt: new Date() })
        .where(eq(ordersTable.orderId, orderId));
      logger.error({ orderId, reason }, "Order parked for manual payment review");
    };

    let capture: Awaited<ReturnType<typeof capturePayPalOrder>>;
    try {
      capture = await capturePayPalOrder(paypalOrderId);
    } catch (captureError) {
      await releaseClaim();
      throw captureError;
    }

    if (capture.status === "COMPLETED") {
      const capturedReferenceId = capture.purchase_units?.[0]?.reference_id;
      if (!capturedReferenceId || capturedReferenceId !== orderId) {
        logger.error(
          { capturedReferenceId, requestedOrderId: orderId },
          "[PayPal] reference_id mismatch",
        );
        await markPaymentReview("reference_id mismatch");
        return res.status(400).json({ error: "Order reference mismatch. Payment not applied." });
      }

      // The ORDER can be COMPLETED while the individual capture is still PENDING
      // (PayPal fraud/risk review) or DECLINED. Marking those "paid" ships goods
      // against money that may never settle.
      const captureRecord = capture.purchase_units?.[0]?.payments?.captures?.[0];
      if (captureRecord?.status && captureRecord.status !== "COMPLETED") {
        logger.error(
          { orderId, captureStatus: captureRecord.status, reason: captureRecord.status_details?.reason },
          "[PayPal] capture not COMPLETED",
        );
        await markPaymentReview(`capture status ${captureRecord.status}`);
        return res.status(402).json({
          error: "PayPal is still reviewing this payment. We will email you as soon as it clears — please do not retry.",
          status: captureRecord.status,
        });
      }

      const capturedAmountStr = captureRecord?.amount?.value;
      const capturedAmount = capturedAmountStr ? parseFloat(capturedAmountStr) : null;
      const localTotal = parseFloat(localOrder.total as string);
      if (capturedAmount === null || Math.abs(capturedAmount - localTotal) > 0.02) {
        logger.error(
          { capturedAmount: capturedAmountStr, localTotal: localOrder.total },
          "[PayPal] Amount mismatch",
        );
        await markPaymentReview("captured amount does not match order total");
        return res.status(400).json({ error: "Captured payment amount does not match order total." });
      }

      const payer = capture.payer;
      const purchaseUnit = capture.purchase_units?.[0];
      const shipping = purchaseUnit?.shipping;
      const captureId = purchaseUnit?.payments?.captures?.[0]?.id;

      // Checkout collects name/email/phone/address up front; keep those values and
      // only fall back to PayPal payer data when a field is somehow missing.
      const customerEmail =
        localOrder.customerEmail || payer?.email_address || "";
      const customerName =
        (localOrder.customerName && localOrder.customerName !== "Customer" ? localOrder.customerName : "") ||
        shipping?.name?.full_name ||
        `${payer?.name?.given_name || ""} ${payer?.name?.surname || ""}`.trim() ||
        "Customer";
      const shippingAddress =
        (localOrder.shippingAddress as any) ||
        (shipping?.address
          ? {
              line1: shipping.address.address_line_1 || "",
              line2: shipping.address.address_line_2,
              city: shipping.address.admin_area_2 || "",
              state: shipping.address.admin_area_1 || "",
              postal_code: shipping.address.postal_code || "",
              country: shipping.address.country_code || "US",
            }
          : undefined);

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
          customerPhone: order.customerPhone ?? undefined,
          shippingAddress,
          items: lineItems.map((item: any) => ({
            name: item.name,
            sku: item.sku,
            price: Number(item.price),
            quantity: Number(item.quantity),
          })),
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          total: order.total,
          paymentMethod: "paypal",
          createdAt: order.createdAt,
        }).catch((error) => logger.error({ error }, "[email] sendOrderNotification error"));
      }

      res.json({ success: true, orderId, captureId });
    } else {
      // Order was not completed, so PayPal took no money — safe to allow a retry.
      await releaseClaim();
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
