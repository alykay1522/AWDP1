import { describe, expect, it } from "vitest";
import { amountsMatch } from "./paypalAmounts.js";

describe("PayPal amount tolerance", () => {
  it("accepts differences at the two-cent boundary", () => {
    expect(amountsMatch(100.02, 100)).toBe(true);
  });

  it("rejects differences above the two-cent boundary", () => {
    expect(amountsMatch(100.021, 100)).toBe(false);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid captured amount %s",
    (value) => expect(amountsMatch(value, 100)).toBe(false),
  );
});
