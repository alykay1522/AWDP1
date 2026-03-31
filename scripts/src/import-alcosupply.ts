/**
 * Import Alcosupply.com products into the AWDP database.
 * SKU format: ALCO-{originalSku}
 * Prices: 2.5x markup over alcosupply.com's listed price.
 * Products without a public price are marked as "Call for Pricing".
 */

import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const MARKUP = 2.5;
const SUPPLIER = "Alcosupply";

interface AlcoProduct {
  slug: string;
  name: string;
  originalSku: string | null;
  primarySku: string | null;
  price: number | null;
  rawPrice: number | null;
  category: string;
  description: string;
  imageUrl: string | null;
  galleryImages: string[];
}

function mapCategory(raw: string): string {
  const c = raw.toLowerCase();
  if (c.includes("operator") || c.includes("awning")) return "Window Operators";
  if (c.includes("lock") || c.includes("handle") || c.includes("latch")) return "Locks & Handles";
  if (c.includes("hinge")) return "Hinges";
  if (c.includes("roller") || c.includes("screen")) return "Rollers & Screens";
  if (c.includes("track")) return "Tracks & Channels";
  if (c.includes("skylight")) return "Skylights";
  return "Window & Door Hardware";
}

async function main() {
  console.log("Starting Alcosupply import...\n");

  // Load scraped JSON
  const fs = await import("fs");
  const raw = fs.readFileSync("/tmp/alco-products.json", "utf-8");
  const products: AlcoProduct[] = JSON.parse(raw);

  // Ensure categories exist
  const categoryNames = [...new Set(products.map(p => mapCategory(p.category)))];
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await db
      .insert(categoriesTable)
      .values({ name, slug, description: `${name} parts and hardware` })
      .onConflictDoNothing();
    console.log(`  Category ensured: ${name}`);
  }

  let inserted = 0;
  let skipped = 0;
  let noPriceCount = 0;

  for (const p of products) {
    const sku = p.primarySku ? `ALCO-${p.primarySku}` : `ALCO-${p.slug.substring(0, 20).toUpperCase()}`;
    const category = mapCategory(p.category);
    const hasPrice = p.price !== null && p.price > 0;

    if (!hasPrice) noPriceCount++;

    const specs: Record<string, string> = {};
    if (p.originalSku) specs["Original SKU"] = p.originalSku;
    specs["Supplier"] = "Alcosupply.com";
    if (!hasPrice) specs["Pricing"] = "Call for pricing: 785-533-0244";
    if (p.rawPrice) specs["Supplier Price"] = `$${p.rawPrice.toFixed(2)}`;

    try {
      await db
        .insert(productsTable)
        .values({
          sku,
          name: p.name,
          description: p.description || `${p.name} — window and door hardware part. SKU: ${sku}. Supplier: Alcosupply.`,
          price: hasPrice ? String(p.price!.toFixed(2)) : "0.00",
          originalPrice: p.rawPrice ? String(p.rawPrice.toFixed(2)) : null,
          category,
          subcategory: p.category !== category ? p.category : null,
          supplier: SUPPLIER,
          inStock: true,
          imageUrl: p.imageUrl,
          tags: [p.category, "alcosupply", ...(p.name.toLowerCase().includes("truth") ? ["truth"] : []), ...(p.name.toLowerCase().includes("andersen") ? ["andersen"] : [])],
          specifications: specs,
          compatibleBrands: detectBrands(p.name),
        })
        .onConflictDoNothing();
      inserted++;
      console.log(`  [OK] ${sku} — ${p.name} — $${p.price ?? "call"} (${hasPrice ? "priced" : "NO PRICE"})`);
    } catch (e: any) {
      skipped++;
      console.log(`  [SKIP] ${sku} — ${e.message}`);
    }
  }

  console.log(`\nImport complete: ${inserted} inserted, ${skipped} skipped, ${noPriceCount} without public price.`);
}

function detectBrands(name: string): string[] {
  const brands: string[] = [];
  const n = name.toLowerCase();
  if (n.includes("truth")) brands.push("Truth Hardware");
  if (n.includes("andersen")) brands.push("Andersen Windows");
  if (n.includes("alco")) brands.push("Alco");
  if (n.includes("entrygard")) brands.push("Truth EntryGard");
  if (n.includes("maxim")) brands.push("Truth Maxim");
  if (n.includes("encore")) brands.push("Truth Encore");
  if (n.includes("sentry")) brands.push("Sentry");
  if (n.includes("marvel")) brands.push("Marvel");
  return brands;
}

main().catch(console.error);
