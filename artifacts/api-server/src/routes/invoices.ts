/**
 * Printable order invoices.
 *
 * GET /api/orders/:orderId/invoice
 * Access: the signed-in customer who owns the order, OR anyone presenting the
 * order ID together with the matching customer email (?email=...) — this is
 * what the checkout success page and invoice emails link to.
 */
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { ordersTable, customersTable } from "@workspace/db/schema";
import { renderInvoicePage } from "../lib/invoice";
import { logger } from "../lib/logger";

const router = Router();

const invoiceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
  statusCode: 429,
});

router.get("/orders/:orderId/invoice", invoiceRateLimiter, async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "");
    if (!/^AWDP-[A-HJ-NP-Z2-9]{8}$/.test(orderId)) {
      return res.status(404).send("Invoice not found");
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.orderId, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).send("Invoice not found");
    }

    // Authorization: session owner or matching email
    let authorized = false;
    const sessionCustomerId = (req.session as any)?.customerId;
    if (typeof sessionCustomerId === "number") {
      if (order.customerId === sessionCustomerId) {
        authorized = true;
      } else {
        const [customer] = await db
          .select({ email: customersTable.email })
          .from(customersTable)
          .where(eq(customersTable.id, sessionCustomerId))
          .limit(1);
        if (customer && order.customerEmail && customer.email.toLowerCase() === order.customerEmail.toLowerCase()) {
          authorized = true;
        }
      }
    }
    if (!authorized) {
      const email = String(req.query.email || "").trim().toLowerCase();
      if (email && order.customerEmail && email === order.customerEmail.toLowerCase()) {
        authorized = true;
      }
    }
    if (!authorized) {
      return res
        .status(403)
        .send("Not authorized to view this invoice. Open the link from your confirmation email, or sign in to your account.");
    }

    const html = renderInvoicePage({
      orderId: order.orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress as any,
      lineItems: (Array.isArray(order.lineItems) ? order.lineItems : []) as any,
      subtotal: order.subtotal as string,
      shippingCost: order.shippingCost as string,
      total: order.total as string,
      status: order.status,
      createdAt: order.createdAt,
      paymentMethod: "paypal",
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.send(html);
  } catch (error) {
    logger.error({ error }, "[invoice] render error");
    res.status(500).send("Failed to load invoice");
  }
});

export default router;
