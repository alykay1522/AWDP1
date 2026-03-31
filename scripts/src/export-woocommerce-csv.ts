/**
 * WooCommerce Product CSV Exporter
 * Exports all products from the DB in WooCommerce CSV import format.
 * Import via: WooCommerce > Products > Import
 */

import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { asc } from "drizzle-orm";
import { createWriteStream } from "fs";
import { resolve } from "path";

function csvEscape(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(f => csvEscape(f == null ? "" : String(f))).join(",");
}

// WooCommerce CSV header columns (standard WC import format)
const WC_HEADERS = [
  "ID",
  "Type",
  "SKU",
  "Name",
  "Published",
  "Is featured?",
  "Visibility in catalog",
  "Short description",
  "Description",
  "Date sale price starts",
  "Date sale price ends",
  "Tax status",
  "Tax class",
  "In stock?",
  "Stock",
  "Low stock amount",
  "Backorders allowed?",
  "Sold individually?",
  "Weight (lbs)",
  "Length (in)",
  "Width (in)",
  "Height (in)",
  "Allow customer reviews?",
  "Purchase note",
  "Sale price",
  "Regular price",
  "Categories",
  "Tags",
  "Shipping class",
  "Images",
  "Download limit",
  "Download expiry days",
  "Parent",
  "Grouped products",
  "Upsells",
  "Cross-sells",
  "External URL",
  "Button text",
  "Position",
  "Attribute 1 name",
  "Attribute 1 value(s)",
  "Attribute 1 visible",
  "Attribute 1 global",
  "Meta: _supplier",
  "Meta: _original_sku",
  "Meta: _awdp_category",
  "Meta: _compatible_brands",
];

async function main() {
  console.log("Exporting products to WooCommerce CSV format...\n");

  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.id));

  console.log(`Total products: ${products.length}`);

  const outputPath = resolve(process.cwd(), "woocommerce-import.csv");
  const stream = createWriteStream(outputPath);

  // Write BOM for Excel UTF-8 compatibility
  stream.write("\uFEFF");

  // Header row
  stream.write(WC_HEADERS.join(",") + "\n");

  let rowNum = 0;
  for (const p of products) {
    rowNum++;

    const specs = (p.specifications as Record<string, string>) || {};
    const tags = (p.tags as string[]) || [];
    const brands = (p.compatibleBrands as string[]) || [];

    const originalSku = specs["Original SKU"] || specs["Supplier SKU"] || p.sku;
    const salePrice = p.originalPrice && Number(p.originalPrice) > Number(p.price)
      ? Number(p.price).toFixed(2)
      : "";
    const regularPrice = p.originalPrice && Number(p.originalPrice) > Number(p.price)
      ? Number(p.originalPrice).toFixed(2)
      : Number(p.price).toFixed(2);

    // Build description — strip HTML-style entities from description
    const description = (p.description || p.name)
      .replace(/\[&hellip;\]/g, "...")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&#8243;/g, '"')
      .replace(/&#8220;|&#8221;/g, '"');

    // Build attribute string from specifications (exclude internal meta fields)
    const specEntries = Object.entries(specs)
      .filter(([k]) => !["Original SKU", "Supplier SKU"].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const row = csvRow([
      "",                          // ID (blank = auto-assign)
      "simple",                    // Type
      originalSku,                 // SKU — use original AWDP SKU
      p.name,                      // Name
      "1",                         // Published
      "0",                         // Is featured?
      "visible",                   // Visibility
      description.slice(0, 300),   // Short description
      description,                 // Description
      "",                          // Date sale price starts
      "",                          // Date sale price ends
      "taxable",                   // Tax status
      "",                          // Tax class (standard)
      p.inStock ? "1" : "0",      // In stock?
      "",                          // Stock (managed at product level)
      "",                          // Low stock amount
      "0",                         // Backorders allowed?
      "0",                         // Sold individually?
      "",                          // Weight
      "",                          // Length
      "",                          // Width
      "",                          // Height
      "1",                         // Allow reviews
      "",                          // Purchase note
      salePrice,                   // Sale price
      regularPrice,                // Regular price
      p.category + (p.subcategory ? " > " + p.subcategory : ""), // Categories
      tags.join(", "),             // Tags
      "",                          // Shipping class
      p.imageUrl || "",            // Images
      "",                          // Download limit
      "",                          // Download expiry
      "",                          // Parent
      "",                          // Grouped products
      "",                          // Upsells
      "",                          // Cross-sells
      "",                          // External URL
      "",                          // Button text
      String(rowNum - 1),         // Position
      specEntries ? "Details" : "",// Attribute 1 name
      specEntries,                 // Attribute 1 value(s)
      "1",                         // Attribute 1 visible
      "0",                         // Attribute 1 global
      p.supplier,                  // Meta: _supplier
      originalSku,                 // Meta: _original_sku
      p.category,                  // Meta: _awdp_category
      brands.join(", "),           // Meta: _compatible_brands
    ]);

    stream.write(row + "\n");
  }

  await new Promise<void>((res, rej) => {
    stream.end((err?: Error | null) => err ? rej(err) : res());
  });

  console.log(`\nWooCommerce CSV written to: ${outputPath}`);
  console.log(`Rows written: ${rowNum}`);
  console.log("\nTo import:");
  console.log("  WooCommerce > Products > Import > Upload this file");
  console.log("  Check 'Update existing products' if re-importing");
}

main().catch(console.error).finally(() => process.exit(0));
