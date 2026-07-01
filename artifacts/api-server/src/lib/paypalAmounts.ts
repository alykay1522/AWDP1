export const PAYPAL_AMOUNT_TOLERANCE = 0.02;

export function amountsMatch(
  capturedAmount: number | null,
  expectedAmount: number,
  tolerance = PAYPAL_AMOUNT_TOLERANCE,
): boolean {
  return capturedAmount !== null
    && Number.isFinite(capturedAmount)
    && Number.isFinite(expectedAmount)
    && Number.isFinite(tolerance)
    && tolerance >= 0
    && Math.abs(capturedAmount - expectedAmount) <= tolerance;
}
