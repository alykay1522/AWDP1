/**
 * Shipping rate calculator — uses the highest standard carrier rate (UPS/FedEx Ground)
 * so the customer is never under-charged. Actual shipping may be less; we contact
 * customers if there is a significant difference.
 *
 * Rates are based on typical UPS/FedEx Ground commercial rates for window & door
 * hardware (medium weight, non-fragile, standard dimensions).
 */

export interface ShippingRate {
  cost: number;       // USD
  label: string;      // displayed to customer
  carrier: string;
}

/**
 * Parses the SHIPPING_FLAT_RATE override strictly: a plain non-negative number
 * with at most 2 decimal places (e.g. "18.95", "0"). Anything else — including
 * "Infinity", "NaN", trailing garbage like "12oops", or negative/whitespace
 * values — returns null so calculateShipping falls back to the tiered rates.
 * (parseFloat alone would accept all of those, which is the bug this closes.)
 */
export function parseShippingFlatRate(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Calculate the shipping charge for a given subtotal.
 * Uses a conservative (high) tiered rate so we never under-collect.
 *
 * Tiers are intentionally generous — hardware parts vary widely in weight.
 * Admin can override by setting SHIPPING_FLAT_RATE env var (e.g. "18.95").
 */
export function calculateShipping(subtotal: number): ShippingRate {
  // Allow admin override via env var for easy adjustment without code changes
  const flat = parseShippingFlatRate(process.env.SHIPPING_FLAT_RATE);
  if (flat !== null) {
    return {
      cost: flat,
      label: flat === 0 ? "Free Shipping" : `Shipping & Handling — $${flat.toFixed(2)}`,
      carrier: "UPS/FedEx/USPS",
    };
  }

  // Tiered rates — highest standard UPS/FedEx ground estimate per order size
  let cost: number;
  if (subtotal < 75)        cost = 22.40;
  else if (subtotal < 150)  cost = 29.90;
  else if (subtotal < 300)  cost = 37.40;
  else if (subtotal < 500)  cost = 52.45;
  else                      cost = 74.95;

  return {
    cost,
    label: `Shipping & Handling (UPS/FedEx Ground) — $${cost.toFixed(2)}`,
    carrier: "UPS/FedEx Ground",
  };
}
