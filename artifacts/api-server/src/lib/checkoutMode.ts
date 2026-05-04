/**
 * PayPal-only checkout: blocks *new* Stripe Checkout sessions (POST /checkout/session).
 *
 * POST /checkout/fulfill is not gated here so in-flight or legacy paid Stripe sessions can still
 * complete after CHECKOUT_PAYPAL_ONLY / env changes.
 *
 * - Set CHECKOUT_PAYPAL_ONLY=true (or 1) to force PayPal-only even with a live Stripe key.
 * - Set CHECKOUT_PAYPAL_ONLY=false to allow Stripe when STRIPE_SECRET_KEY is configured.
 * - If CHECKOUT_PAYPAL_ONLY is unset: PayPal-only when Stripe is missing or key looks like a placeholder.
 */
function envFlagTrue(v: string | undefined): boolean {
  if (!v?.trim()) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function envFlagFalse(v: string | undefined): boolean {
  if (!v?.trim()) return false;
  const s = v.trim().toLowerCase();
  return s === "0" || s === "false" || s === "no";
}

function stripeLooksConfigured(): boolean {
  const sk = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!sk) return false;
  if (/placeholder/i.test(sk)) return false;
  return true;
}

export function isPayPalCheckoutOnly(): boolean {
  const raw = process.env.CHECKOUT_PAYPAL_ONLY;
  if (envFlagTrue(raw)) return true;
  if (envFlagFalse(raw)) return false;
  return !stripeLooksConfigured();
}
