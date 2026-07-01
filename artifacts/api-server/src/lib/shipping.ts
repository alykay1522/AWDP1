/**
 * Shipping rate calculator — uses the highest standard carrier rate (UPS/FedEx Ground)
 * so the customer is never under-charged. Actual shipping may be less; we contact
 * customers if there is a significant difference.
 */

export interface ShippingRate {
  cost: number;
  label: string;
  carrier: string;
}

export function parseShippingFlatRate(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function calculateShipping(subtotal: number): ShippingRate {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError("Shipping subtotal must be a finite, non-negative number");
  }

  const flat = parseShippingFlatRate(process.env.SHIPPING_FLAT_RATE);
  if (flat !== null) {
    return {
      cost: flat,
      label: flat === 0 ? "Free Shipping" : `Shipping & Handling — $${flat.toFixed(2)}`,
      carrier: "UPS/FedEx/USPS",
    };
  }

  let cost: number;
  if (subtotal < 75) cost = 22.40;
  else if (subtotal < 150) cost = 29.90;
  else if (subtotal < 300) cost = 37.40;
  else if (subtotal < 500) cost = 52.45;
  else cost = 74.95;

  return {
    cost,
    label: `Shipping & Handling (UPS/FedEx Ground) — $${cost.toFixed(2)}`,
    carrier: "UPS/FedEx Ground",
  };
}
