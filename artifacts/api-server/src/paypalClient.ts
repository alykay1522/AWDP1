/**
 * PayPal REST API client (Orders API v2)
 * Uses PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables.
 * Supports both sandbox (PAYPAL_MODE=sandbox) and live mode.
 */

const PAYPAL_MODE = process.env.PAYPAL_MODE || "live";
const BASE_URL =
  PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

let _cachedToken: { token: string; expiresAt: number } | null = null;

function assertValidPayPalOrderId(paypalOrderId: string): string {
  const value = paypalOrderId.trim();

  // PayPal order IDs are expected to be opaque tokens; enforce a strict safe charset
  // and bounds to prevent path manipulation when constructing API URLs.
  if (!/^[A-Za-z0-9-]{5,64}$/.test(value)) {
    throw new Error("Invalid PayPal order ID format");
  }

  return value;
}

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 30_000) {
    return _cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal credentials not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables."
    );
  }

  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return _cachedToken.token;
}

export async function createPayPalOrder(params: {
  items: Array<{ name: string; sku: string; price: number; quantity: number }>;
  orderId: string;
  shippingCost: number;
}): Promise<{ id: string; status: string }> {
  const token = await getAccessToken();

  if (!Number.isFinite(params.shippingCost) || params.shippingCost < 0) {
    throw new TypeError("PayPal shippingCost must be a finite, non-negative number");
  }

  const subtotal = params.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError("PayPal subtotal must be a finite, non-negative number");
  }

  const total = subtotal + params.shippingCost;

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.orderId,
        custom_id: params.orderId,
        amount: {
          currency_code: "USD",
          value: total.toFixed(2),
          breakdown: {
            item_total: { currency_code: "USD", value: subtotal.toFixed(2) },
            shipping:   { currency_code: "USD", value: params.shippingCost.toFixed(2) },
          },
        },
        items: params.items.map((item) => ({
          name: item.name.substring(0, 127),
          sku: item.sku,
          unit_amount: { currency_code: "USD", value: item.price.toFixed(2) },
          quantity: String(item.quantity),
          category: "PHYSICAL_GOODS",
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "All Window Door Parts",
          locale: "en-US",
          landing_page: "NO_PREFERENCE",
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
        },
      },
    },
  };

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": params.orderId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal order creation failed: ${err}`);
  }

  return await res.json() as { id: string; status: string };
}

export async function capturePayPalOrder(
  paypalOrderId: string
): Promise<{
  id: string;
  status: string;
  payer?: { email_address?: string; name?: { given_name?: string; surname?: string } };
  purchase_units?: Array<{
    reference_id?: string;
    shipping?: { address?: Record<string, string>; name?: { full_name?: string } };
    payments?: { captures?: Array<{ id: string; amount: { currency_code: string; value: string } }> };
  }>;
}> {
  const token = await getAccessToken();
  const validatedOrderId = assertValidPayPalOrderId(paypalOrderId);

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${encodeURIComponent(validatedOrderId)}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${err}`);
  }

  return await res.json();
}

export { BASE_URL as PAYPAL_BASE_URL, PAYPAL_MODE };
