import { describe, expect, it } from "vitest";
import { applySkuCipher, buildSku } from "./skuCipher.js";

describe("AWDP SKU cipher", () => {
  it("preserves the reciprocal PROFITABLE mapping", () => {
    expect(applySkuCipher("1234567890-PROFITABLE")).toBe("PROFITABLE-1234567890");
  });

  it("builds legacy-compatible SKUs", () => {
    expect(buildSku("35-1234")).toBe("AWDP-OI-PROF");
  });

  it("does not re-cipher an existing AWDP SKU", () => {
    expect(buildSku("awdp-oi-prof")).toBe("AWDP-OI-PROF");
  });
});
