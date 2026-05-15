import { describe, it, expect } from "vitest";
import {
  resolveProductCategory,
  normalizeCategoryLabel,
  inferCategoryFromSkuAndName,
  isBalanceProductName,
} from "./resolveProductCategory.js";

describe("normalizeCategoryLabel", () => {
  it("maps aliases to canonical names", () => {
    expect(normalizeCategoryLabel("balances")).toBe("Window Balances");
    expect(normalizeCategoryLabel("Weatherstripping")).toBe("Window Glazing and Weatherstrip");
    expect(normalizeCategoryLabel("Window Operators & Cranks")).toBe("Window Hardware");
  });
});

describe("inferCategoryFromSkuAndName", () => {
  it("splits balance-family SKUs by product name", () => {
    expect(
      inferCategoryFromSkuAndName("AWDP-TR7-ROHD8-PT", "24in Beige Ribbed Channel Bal"),
    ).toBe("Window Balances");
    expect(
      inferCategoryFromSkuAndName("AWDP-TR-PFSRP-P", "15 CHANNEL accessory clip"),
    ).toBe("Sash Hardware");
  });

  it("maps door and glazing prefixes", () => {
    expect(inferCategoryFromSkuAndName("AWDP-PO-123", "Patio roller")).toBe("Door Hardware");
    expect(inferCategoryFromSkuAndName("AWDP-TO-99", "Seal")).toBe("Window Glazing and Weatherstrip");
  });
});

describe("resolveProductCategory", () => {
  it("prefers explicit CSV category", () => {
    expect(
      resolveProductCategory({
        rawCategory: "Door Hardware",
        sku: "AWDP-TR-1",
        name: "Balance",
      }),
    ).toBe("Door Hardware");
  });

  it("keeps existing category when CSV category is blank", () => {
    expect(
      resolveProductCategory({
        rawCategory: "",
        sku: "AWDP-XX",
        name: "Part",
        existingCategory: "Sash Hardware",
      }),
    ).toBe("Sash Hardware");
  });

  it("infers from SKU when category missing on new rows", () => {
    expect(
      resolveProductCategory({
        rawCategory: "",
        sku: "AWDP-PR-ROLLER",
        name: "Patio door roller wheel",
      }),
    ).toBe("Door Hardware");
  });

  it("splits legacy combined category using name", () => {
    expect(
      resolveProductCategory({
        rawCategory: "Window Balances and Accessories",
        sku: "AWDP-TR-1",
        name: "31in channel balance",
      }),
    ).toBe("Window Balances");
    expect(
      resolveProductCategory({
        rawCategory: "Window Balances and Accessories",
        sku: "AWDP-TR-1",
        name: "Tilt latch",
      }),
    ).toBe("Sash Hardware");
  });
});

describe("isBalanceProductName", () => {
  it("detects balance wording", () => {
    expect(isBalanceProductName("24in Ribbed Channel Bal")).toBe(true);
    expect(isBalanceProductName("Tilt latch white")).toBe(false);
  });
});
