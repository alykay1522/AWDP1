export function estimateShipping(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError("Shipping subtotal must be a finite, non-negative number");
  }
  if (subtotal < 75) return 22.40;
  if (subtotal < 150) return 29.90;
  if (subtotal < 300) return 37.40;
  if (subtotal < 500) return 52.45;
  return 74.95;
}
