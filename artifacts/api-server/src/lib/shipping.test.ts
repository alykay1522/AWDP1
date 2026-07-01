import { afterEach, describe, expect, it } from "vitest";
import { calculateShipping, parseShippingFlatRate } from "./shipping.js";

const original = process.env.SHIPPING_FLAT_RATE;
afterEach(() => {
  if (original === undefined) delete process.env.SHIPPING_FLAT_RATE;
  else process.env.SHIPPING_FLAT_RATE = original;
});

describe("shipping", () => {
  it.each([
    [0, 22.40], [74.99, 22.40], [75, 29.90], [150, 37.40], [300, 52.45], [500, 74.95],
  ])("calculates the expected tier for %s", (subtotal, expected) => {
    delete process.env.SHIPPING_FLAT_RATE;
    expect(calculateShipping(subtotal).cost).toBe(expected);
  });

  it.each(["12oops", "Infinity", "NaN", "-1", "1.234", " 12 "])(
    "rejects malformed override %s",
    (value) => expect(parseShippingFlatRate(value)).toBeNull(),
  );

  it("accepts a valid zero override", () => {
    process.env.SHIPPING_FLAT_RATE = "0";
    expect(calculateShipping(100).cost).toBe(0);
  });
});
