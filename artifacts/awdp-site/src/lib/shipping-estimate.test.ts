import { describe, expect, it } from "vitest";
import { estimateShipping } from "./shipping-estimate.js";

describe("client shipping estimate", () => {
  it.each([
    [50, 22.40], [75, 29.90], [150, 37.40], [300, 52.45], [500, 74.95],
  ])("matches the server tier at %s", (subtotal, expected) => {
    expect(estimateShipping(subtotal)).toBe(expected);
  });

  it("rejects invalid subtotals", () => {
    expect(() => estimateShipping(Number.NaN)).toThrow();
  });
});
