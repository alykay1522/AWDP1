import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let _stripeSync: StripeSync | null = null;

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is required.");
  }
  return new Stripe(secretKey, { apiVersion: "2025-02-24.acacia" });
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!_stripeSync) {
    const stripe = await getUncachableStripeClient();
    _stripeSync = new StripeSync(stripe, process.env.DATABASE_URL!);
  }
  return _stripeSync;
}
