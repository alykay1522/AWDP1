import { Router } from "express";
import { isPayPalCheckoutOnly } from "../lib/checkoutMode.js";

const router = Router();

/**
 * Checkout mode flag. Read by the admin orders screen (admin-orders.tsx).
 *
 * NOTE: this module previously also exposed POST /checkout/create-order and
 * POST /checkout/capture-order — a second, unmaintained PayPal implementation.
 * Nothing called them: the storefront uses /api/paypal/* exclusively
 * (PayPalCheckoutButton.tsx and pages/checkout.tsx). They were removed because
 * they were publicly reachable and strictly weaker than the live path:
 *
 *   - serverPriceItems() never selected `inStock`, so out-of-stock items could
 *     be purchased — the exact gap closed on the storefront path.
 *   - Orders were written with customerName "Customer" and customerEmail "",
 *     bypassing the required name/email/phone/address validation.
 *   - No rate limiting on either endpoint.
 *   - orderId was read straight off req.body with no format validation.
 *   - capture-order had no capture-level status check (an order can be
 *     COMPLETED while the capture is PENDING under fraud review) and no
 *     concurrency guard, so it could double-capture.
 *   - Its success branch had no `return`/`else` and fell through into a second
 *     res.status(400).json(), so every successful capture also raised
 *     ERR_HTTP_HEADERS_SENT.
 *
 * Leaving them mounted meant any hardening applied to /api/paypal/* could be
 * sidestepped by posting to /api/checkout/* instead.
 */
router.get("/checkout/options", (_req, res) => {
  res.json({ checkoutPayPalOnly: isPayPalCheckoutOnly() });
});

export default router;
