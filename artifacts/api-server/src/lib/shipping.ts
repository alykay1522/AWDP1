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
 * Calculate the shipping charge for a given subtotal.
 * Uses a conservative (high) tiered rate so we never under-collect.
 *
 * Tiers are intentionally generous — hardware parts vary widely in weight.
 * Admin can override by setting SHIPPING_FLAT_RATE env var (e.g. "18.95").
 */
export function calculateShipping(subtotal: number): ShippingRate {
  // Allow admin override via env var for easy adjustment without code changes
  const flatOverride = process.env.SHIPPING_FLAT_RATE;
  if (flatOverride) {
    const flat = parseFloat(flatOverride);
    if (!isNaN(flat) && flat >= 0) {
      return {
        cost: flat,
        label: flat === 0 ? "Free Shipping" : `Shipping & Handling — $${flat.toFixed(2)}`,
        carrier: "UPS/FedEx/USPS",
      };
    }
  }

  // Tiered rates — highest standard UPS/FedEx ground estimate per order size
  let cost: number;
  if (subtotal < 75)        cost = 14.95;   // Small order, light parts
  else if (subtotal < 150)  cost = 19.95;   // Medium order
  else if (subtotal < 300)  cost = 24.95;   // Larger order, heavier box
  else if (subtotal < 500)  cost = 34.95;   // Heavy/bulky hardware
  else                      cost = 49.95;   // Large commercial order

  return {
    cost,
    label: `Shipping & Handling (UPS/FedEx Ground) — $${cost.toFixed(2)}`,
    carrier: "UPS/FedEx Ground",
  };
}
