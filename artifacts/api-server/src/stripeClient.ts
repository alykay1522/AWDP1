import type { default as Stripe } from "stripe";
import type { StripeSync } from "stripe-replit-sync";

let _stripeSync: StripeSync | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { default: StripeCtor } = await import("stripe");
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is required.");
  }
  return new StripeCtor(secretKey, { apiVersion: "2025-02-24.acacia" });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!_stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const stripe = await getUncachableStripeClient();
    _stripeSync = new StripeSync(stripe, process.env.DATABASE_URL!);
  }
  return _stripeSync;
}
