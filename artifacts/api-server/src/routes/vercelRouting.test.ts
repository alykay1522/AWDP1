import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel API routing", () => {
  it("does not ship a legacy product id shim that shadows Express product routes", () => {
    const legacyProductShim = resolve(process.cwd(), "../../api/products/[id].js");
    const productCatchAll = resolve(process.cwd(), "../../api/products/[...path].mjs");

    expect(existsSync(productCatchAll)).toBe(true);
    expect(existsSync(legacyProductShim)).toBe(false);
  });
});
