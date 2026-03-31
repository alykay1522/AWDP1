/**
 * Distributor Price Checker
 * 
 * Scrapes current prices from Alcosupply.com and Strybuc.com for all tracked products.
 * Saves results to distributor_prices table and flags items needing markup updates.
 * 
 * Run: pnpm --filter @workspace/scripts check-prices
 */

import { db } from "@workspace/db";
import { productsTable, distributorPricesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(12000),
    });
    return res.ok ? await res.text() : "";
  } catch { return ""; }
}

// ── Alcosupply Scraper ──────────────────────────────────────────────────────

async function scrapeAlcosupplyPrice(slug: string): Promise<number | null> {
  const url = `https://alcosupply.com/product/${slug}/`;
  const html = await fetchHtml(url);
  if (!html) return null;
  const priceMatches = [...html.matchAll(/"price":"([0-9]+\.?[0-9]*)"/g)];
  return priceMatches.length > 0 ? parseFloat(priceMatches[0][1]) : null;
}

// Derive alcosupply slug from the original SKU / product name
function alcosupplySlugFromProduct(specs: Record<string, string>, name: string): string {
  // Use stored ALCO SKU url slug if saved
  const alcoSku = specs["ALCO SKU"] || specs["Previous SKU"] || "";
  if (alcoSku.startsWith("ALCO-")) {
    // We need the actual product slug — derive from name
  }
  // Fallback: build slug from product name
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Strybuc Scraper ─────────────────────────────────────────────────────────

async function scrapeStrybucPrice(distributorSku: string): Promise<{ price: number | null; url: string }> {
  // Try direct item URL first
  const url = `https://shop.strybuc.com/item/${distributorSku}`;
  const html = await fetchHtml(url);
  if (html) {
    // Look for price in JSON or structured data
    const priceM = html.match(/"price":\s*"?([0-9]+\.?[0-9]*)"?/) ||
                   html.match(/\$([0-9]+\.[0-9]{2})/) ||
                   html.match(/class="price"[^>]*>\$?([0-9]+\.?[0-9]*)/);
    if (priceM) return { price: parseFloat(priceM[1]), url };
  }
  return { price: null, url };
}

// ── Status Classification ────────────────────────────────────────────────────

function classifyStatus(
  costPrice: number | null,
  ourPrice: number,
  targetMarkup: number,
  prevCostPrice?: number | null
): string {
  if (!costPrice) return "no_price";
  const ratio = ourPrice / costPrice;
  if (ratio < targetMarkup * 0.95) {
    // Cost went up or our markup dropped below target
    if (prevCostPrice && costPrice > prevCostPrice * 1.02) return "cost_up";
    return "needs_update";
  }
  if (prevCostPrice && costPrice < prevCostPrice * 0.98) return "cost_down";
  return "ok";
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching all products...\n");
  const products = await db.select().from(productsTable).orderBy(productsTable.supplier);

  const alcosupplyProducts = products.filter(p => p.supplier === "Alcosupply");
  const strybucProducts = products.filter(p => p.supplier === "Strybuc");
  const otherProducts = products.filter(p => !["Alcosupply", "Strybuc"].includes(p.supplier));

  console.log(`Products: ${alcosupplyProducts.length} Alcosupply | ${strybucProducts.length} Strybuc | ${otherProducts.length} other\n`);

  const results: { sku: string; name: string; distributor: string; status: string; cost: number | null; our: number; ratio: number | null }[] = [];

  // ── Check Alcosupply products ──────────────────────────────────────────────
  console.log("=== Checking Alcosupply prices ===");
  for (const p of alcosupplyProducts) {
    const specs = (p.specifications ?? {}) as Record<string, string>;
    const origSku = specs["Original SKU"] || specs["ALCO SKU"]?.replace("ALCO-", "") || "";
    const slug = alcosupplySlugFromProduct(specs, p.name);
    const url = `https://alcosupply.com/product/${slug}/`;

    const costPrice = await scrapeAlcosupplyPrice(slug);
    const ourPrice = parseFloat(p.price);
    const targetMarkup = 2.5;
    const markupRatio = costPrice ? ourPrice / costPrice : null;

    // Get previous cost for comparison
    const [prev] = await db
      .select({ costPrice: distributorPricesTable.costPrice })
      .from(distributorPricesTable)
      .where(eq(distributorPricesTable.productSku, p.sku))
      .orderBy(sql`checked_at DESC`)
      .limit(1);

    const prevCost = prev?.costPrice ? parseFloat(prev.costPrice) : null;
    const status = classifyStatus(costPrice, ourPrice, targetMarkup, prevCost);

    await db.insert(distributorPricesTable).values({
      productSku: p.sku,
      distributor: "Alcosupply",
      distributorSku: origSku,
      distributorUrl: url,
      costPrice: costPrice ? String(costPrice.toFixed(2)) : null,
      ourPrice: String(ourPrice.toFixed(2)),
      markupRatio: markupRatio ? String(markupRatio.toFixed(4)) : null,
      targetMarkup: String(targetMarkup),
      status,
      notes: costPrice ? `Cost: $${costPrice} → Our price: $${ourPrice} (${markupRatio ? (markupRatio).toFixed(2) : "?"}x markup)` : "No public price found",
    });

    const flag = status !== "ok" ? ` ⚠️  [${status.toUpperCase()}]` : "";
    console.log(`  [${status.toUpperCase()}] ${p.sku} — $${costPrice ?? "?"} → $${ourPrice}${flag}`);
    results.push({ sku: p.sku, name: p.name, distributor: "Alcosupply", status, cost: costPrice, our: ourPrice, ratio: markupRatio });
    await new Promise(r => setTimeout(r, 250));
  }

  // ── Check Strybuc products ─────────────────────────────────────────────────
  console.log("\n=== Checking Strybuc prices ===");
  for (const p of strybucProducts) {
    const specs = (p.specifications ?? {}) as Record<string, string>;
    const distributorSku = specs["Original SKU"] || specs["Supplier SKU"] || "";
    const { price: costPrice, url } = await scrapeStrybucPrice(distributorSku);
    const ourPrice = parseFloat(p.price);
    const targetMarkup = 1.45; // 45% above cost for Strybuc
    const markupRatio = costPrice ? ourPrice / costPrice : null;

    const [prev] = await db
      .select({ costPrice: distributorPricesTable.costPrice })
      .from(distributorPricesTable)
      .where(eq(distributorPricesTable.productSku, p.sku))
      .orderBy(sql`checked_at DESC`)
      .limit(1);

    const prevCost = prev?.costPrice ? parseFloat(prev.costPrice) : null;
    const status = classifyStatus(costPrice, ourPrice, targetMarkup, prevCost);

    await db.insert(distributorPricesTable).values({
      productSku: p.sku,
      distributor: "Strybuc",
      distributorSku,
      distributorUrl: url,
      costPrice: costPrice ? String(costPrice.toFixed(2)) : null,
      ourPrice: String(ourPrice.toFixed(2)),
      markupRatio: markupRatio ? String(markupRatio.toFixed(4)) : null,
      targetMarkup: String(targetMarkup),
      status,
      notes: costPrice
        ? `Cost: $${costPrice} → Our price: $${ourPrice} (${markupRatio?.toFixed(2)}x markup)`
        : `SKU: ${distributorSku} — price not public, manual check needed`,
    });

    console.log(`  [${status.toUpperCase()}] ${p.sku} — ${distributorSku} — $${costPrice ?? "?"} → $${ourPrice}`);
    results.push({ sku: p.sku, name: p.name, distributor: "Strybuc", status, cost: costPrice, our: ourPrice, ratio: markupRatio });
    await new Promise(r => setTimeout(r, 200));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== SUMMARY ===");
  const needsUpdate = results.filter(r => r.status !== "ok" && r.status !== "no_price");
  const noPriceCount = results.filter(r => r.status === "no_price").length;
  const okCount = results.filter(r => r.status === "ok").length;

  console.log(`OK: ${okCount} | Needs Update: ${needsUpdate.length} | No Price: ${noPriceCount}`);
  if (needsUpdate.length > 0) {
    console.log("\nProducts needing attention:");
    needsUpdate.forEach(r => {
      console.log(`  [${r.status.toUpperCase()}] ${r.sku} — ${r.name}`);
      console.log(`    Cost: $${r.cost} | Our price: $${r.our} | Markup: ${r.ratio?.toFixed(2)}x`);
    });
  }
}

main().catch(console.error);
