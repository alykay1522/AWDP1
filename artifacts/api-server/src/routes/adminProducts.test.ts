import { describe, expect, it } from "vitest";
import {
  buildProductImportValues,
  hasBulkProductFilterConstraints,
  normalizeRow,
} from "./adminProducts";

describe("admin product import values", () => {
  it("preserves existing product fields when matching CSV cells are blank", () => {
    const row = normalizeRow({
      sku: "AWDP-TEST-1",
      price: "12.50",
      description: "",
      supplier: "",
      inStock: "",
      imageUrl: "",
      tags: "",
      compatibleBrands: "",
      specifications: "",
    });

    const { values } = buildProductImportValues(row, "AWDP-TEST-1", "AWDP-TEST-1", {
      sku: "AWDP-TEST-1",
      price: "10.00",
      category: "Door Hardware",
      name: "Existing Roller",
    });

    expect(values).toMatchObject({
      category: "Door Hardware",
      price: "12.50",
    });
    expect(values).not.toHaveProperty("description");
    expect(values).not.toHaveProperty("supplier");
    expect(values).not.toHaveProperty("inStock");
    expect(values).not.toHaveProperty("imageUrl");
    expect(values).not.toHaveProperty("tags");
    expect(values).not.toHaveProperty("compatibleBrands");
    expect(values).not.toHaveProperty("specifications");
  });

  it("still applies defaults for new products with blank optional CSV cells", () => {
    const row = normalizeRow({
      sku: "NEW-1",
      name: "New Balance",
      price: "15.00",
      description: "",
      supplier: "",
      inStock: "",
      tags: "",
      compatibleBrands: "",
      specifications: "",
    });

    const { values } = buildProductImportValues(row, "NEW-1", "AWDP-NEW-1");

    expect(values).toMatchObject({
      name: "New Balance",
      description: "",
      price: "15.00",
      supplier: "All Window Door Parts",
      inStock: true,
      tags: [],
      compatibleBrands: [],
      specifications: {},
    });
  });
});

describe("bulk product filter guards", () => {
  it("rejects an empty select-all filter before it can update the whole catalog", () => {
    expect(hasBulkProductFilterConstraints({})).toBe(false);
    expect(
      hasBulkProductFilterConstraints({
        search: "",
        category: "",
        zeroPrice: false,
        inStock: "",
      }),
    ).toBe(false);
  });

  it("accepts filters that actually constrain the product set", () => {
    expect(hasBulkProductFilterConstraints({ search: "roller" })).toBe(true);
    expect(hasBulkProductFilterConstraints({ category: "Door Hardware" })).toBe(true);
    expect(hasBulkProductFilterConstraints({ zeroPrice: true })).toBe(true);
    expect(hasBulkProductFilterConstraints({ inStock: "false" })).toBe(true);
  });
});
