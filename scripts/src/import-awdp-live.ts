/**
 * All Window Door Parts — Live Site Product Importer
 * Pulls all 387 products from www.allwindowdoorparts.com via WP REST API
 * + scrapes individual product pages for prices and SKUs
 * 
 * Existing site already uses AWDP-XX-XXXX SKU format.
 */

import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.allwindowdoorparts.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CONCURRENCY = 4;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch (e) {
    console.warn(`  [WARN] JSON fetch failed: ${url} — ${e}`);
    return null;
  }
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    console.warn(`  [WARN] HTML fetch failed: ${url} — ${e}`);
    return "";
  }
}

// Run an array of async tasks with limited concurrency
async function batchRun<T>(
  tasks: (() => Promise<T>)[],
  concurrency = CONCURRENCY,
  onDone?: (done: number, total: number) => void
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
      onDone?.(results.filter(r => r !== undefined).length, tasks.length);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── CATEGORY MAP: WC category IDs → our category names ──────────────────────
const WC_CAT_MAP: Record<number, string> = {
  74: "Window Operators & Cranks",       // Awning Window Parts
  45: "Window Operators & Cranks",       // Casement Window Parts
  128: "Window Operators & Cranks",      // Operators and Crank Mechanisms
  124: "Window Operators & Cranks",      // Crank Handles and Covers
  125: "Window Operators & Cranks",      // Roto-Gear Awning Operators
  20: "Glazing & Seals",                 // Glazing Bead Replacement Parts
  113: "Glazing & Seals",               // Plastic Snap-In-Bead
  364: "Glazing & Seals",              // Metal Glazing Bead
  50: "Weatherstripping & Seals",       // Weatherstrip Replacement Parts
  120: "Weatherstripping & Seals",      // Door Weather-Strip
  97: "Weatherstripping & Seals",       // Weather-Stripping
  123: "Weatherstripping & Seals",      // Window Weather Strip
  52: "Door Hardware",                  // Door Hardware Replacement Parts
  36: "Door Locks & Multipoint",        // Inswing/Outswing Door Parts
  93: "Door Locks & Multipoint",        // Mortise Lock Replacements
  96: "Door Locks & Multipoint",        // Multi-Point Lock Systems
  103: "Door Locks & Multipoint",       // Sliding Patio Door Handles and Security
  76: "Rollers & Guides",              // Sliding Glass Door Patio
  104: "Rollers & Guides",             // Roller and Wheel Assemblies
  79: "Hinges & Pivots",               // Hinges, Tracks, Slash Locks
  107: "Window Screens & Frames",       // Screen Door Parts / KD Kits
  105: "Door Locks & Multipoint",       // Guardian/Herculite Glass Doors
  208: "Deer Blind Windows",            // Hunting Stand Door and Window Parts
  19: "Sash & Frame Parts",            // Window Hardware Replacement Parts
  329: "Sash & Frame Parts",           // Misc
  156: "Window Balances",              // Window Balances
  91: "Sash & Frame Parts",            // Wood/Clad Sash Reproductions
  144: "Sash & Frame Parts",           // Clad Window Sash Kit – No Glass
  145: "Sash & Frame Parts",           // Clad Window Sash w/ Glass
  431: "Sash & Frame Parts",           // Double Hung Sashes
  430: "Sash & Frame Parts",           // Window Sashes
  147: "Glazing & Seals",              // Wood Grille Kits
};

function mapWcCategory(catIds: number[]): { category: string; subcategory: string | null } {
  // Find first matching category in priority order
  for (const id of catIds) {
    if (WC_CAT_MAP[id]) {
      return { category: WC_CAT_MAP[id], subcategory: null };
    }
  }
  return { category: "Sash & Frame Parts", subcategory: null };
}

interface WpProduct {
  id: number;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  product_cat: number[];
  product_tag: number[];
  product_brand: number[];
}

interface ScrapedProductData {
  sku: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string | null;
  inStock: boolean;
  compatibleBrands: string[];
  specifications: Record<string, string>;
  tags: string[];
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8243;/g, '"')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function scrapeProductPage(html: string): ScrapedProductData {
  const $ = cheerio.load(html);

  // Get SKU
  const sku = $('[data-product_sku]').first().attr('data-product_sku') ||
    $(".sku").text().trim() ||
    "";

  // Parse price from WooCommerce JS data
  let price = 0;
  let originalPrice: number | null = null;

  // Try to find price in embedded WC JSON (most reliable)
  const bodyHtml = $.html();
  const priceMatch = bodyHtml.match(/"price":"([0-9.]+)"/);
  if (priceMatch) price = parseFloat(priceMatch[1]);

  // Try sale price structure
  const salePriceMatch = bodyHtml.match(/"sale_price":"([0-9.]+)"/);
  const regularPriceMatch = bodyHtml.match(/"regular_price":"([0-9.]+)"/);
  if (salePriceMatch && regularPriceMatch) {
    const saleP = parseFloat(salePriceMatch[1]);
    const regP = parseFloat(regularPriceMatch[1]);
    if (saleP > 0 && regP > 0 && regP > saleP) {
      price = saleP;
      originalPrice = regP;
    } else if (regP > 0) {
      price = regP;
    }
  }

  // Fallback: parse from HTML price display
  if (!price) {
    const saleHtml = $(".price ins .woocommerce-Price-amount bdi").text().replace(/[^0-9.]/g, "");
    const regHtml = $(".price del .woocommerce-Price-amount bdi").text().replace(/[^0-9.]/g, "");
    const onlyHtml = $(".price .woocommerce-Price-amount bdi").first().text().replace(/[^0-9.]/g, "");
    if (saleHtml && regHtml) {
      price = parseFloat(saleHtml);
      originalPrice = parseFloat(regHtml);
    } else if (onlyHtml) {
      price = parseFloat(onlyHtml);
    }
  }

  // Get image
  const imageUrl = $(".woocommerce-product-gallery__image img").first().attr("src") ||
    $(".wp-post-image").first().attr("src") ||
    null;

  // Stock status
  const inStock = !$(".stock.out-of-stock").length;

  // Compatible brands — extract from description text
  const descText = $(".woocommerce-product-details__short-description, .entry-content").text().toLowerCase();
  const brands: string[] = [];
  const brandKeywords = ["truth", "entrygard", "biltbest", "andersen", "pella", "marvin", "peachtree",
    "caldwell", "strybuc", "oldach", "norco", "general", "simonton", "silverline"];
  for (const b of brandKeywords) {
    if (descText.includes(b)) brands.push(b.charAt(0).toUpperCase() + b.slice(1));
  }

  // Tags from product attributes / content
  const tags: string[] = [];
  const n = (sku + " " + descText).toLowerCase();
  if (n.includes("casement")) tags.push("casement");
  if (n.includes("awning")) tags.push("awning");
  if (n.includes("operator") || n.includes("crank")) tags.push("operator");
  if (n.includes("screen")) tags.push("screen");
  if (n.includes("balance")) tags.push("balance");
  if (n.includes("weatherstrip") || n.includes("weather strip") || n.includes("seal")) tags.push("weatherstrip");
  if (n.includes("glazing") || n.includes("bead")) tags.push("glazing");
  if (n.includes("roller")) tags.push("roller");
  if (n.includes("hinge")) tags.push("hinge");
  if (n.includes("lock") || n.includes("latch")) tags.push("lock");
  if (n.includes("door")) tags.push("door");

  // Specifications — try to extract attribute table
  const specs: Record<string, string> = {};
  $(".woocommerce-product-attributes tr").each((_, row) => {
    const key = $(row).find(".woocommerce-product-attributes-item__label").text().trim();
    const val = $(row).find(".woocommerce-product-attributes-item__value").text().trim();
    if (key && val) specs[key] = val;
  });
  if (sku) specs["Supplier SKU"] = sku;

  return { sku, price, originalPrice, imageUrl, inStock, compatibleBrands: brands, specifications: specs, tags };
}

// ─── CATEGORIES WE WILL UPSERT ──────────────────────────────────────────────
const OUR_CATEGORIES = [
  { name: "Window Operators & Cranks", slug: "window-operators", description: "Casement, awning, and jalousie operators, cranks, crank handles, and roto-gear mechanisms for all major window brands." },
  { name: "Window Locks & Latches", slug: "window-locks", description: "Sash locks, cam locks, tilt latches, and keeper sets for single-hung, double-hung, and casement windows." },
  { name: "Window Balances", slug: "window-balances", description: "Spiral, block-and-tackle, channel, and coil spring balances for proper single and double-hung window operation." },
  { name: "Window Screens & Frames", slug: "window-screens", description: "Screen frames, spline, mesh, corner hardware, and KD screen kits." },
  { name: "Door Hardware", slug: "door-hardware", description: "Entry, patio, storm, and sliding door hardware including handles, escutcheons, and closers." },
  { name: "Door Locks & Multipoint", slug: "door-locks", description: "Mortise locks, multi-point locking systems, sliding door security hardware, and strike plates." },
  { name: "Weatherstripping & Seals", slug: "weatherstripping", description: "Q-Lon, foam, felt, silicone, pile, and kerf-type weatherstripping for windows and doors." },
  { name: "Hinges & Pivots", slug: "hinges", description: "Butt hinges, continuous hinges, casement arms, and pivot hardware for doors and windows." },
  { name: "Rollers & Guides", slug: "rollers", description: "Patio door rollers, sliding window rollers, tandem assemblies, and guide hardware." },
  { name: "Sash & Frame Parts", slug: "sash-parts", description: "Replacement sash kits, corner keys, frame joiners, sash lifts, tilt latches, and window frame components." },
  { name: "Glazing & Seals", slug: "glazing", description: "Snap-in glazing beads, metal glazing bead, glazing tape, setting blocks, and wood grille kits." },
  { name: "Deer Blind Windows", slug: "deer-blind", description: "Aluminum-framed slider, awning, and fixed windows for hunting blinds and shooting houses." },
];

// ─── SUPPLIER MAPPING ────────────────────────────────────────────────────────
function mapSupplier(title: string, content: string, tags: string[]): string {
  const combined = (title + " " + content).toLowerCase();
  if (combined.includes("truth") || combined.includes("entrygard")) return "Truth/Entrygard";
  if (combined.includes("biltbest")) return "Biltbest";
  if (combined.includes("strybuc")) return "Strybuc";
  if (combined.includes("oldach") || combined.includes("outlook")) return "Oldach";
  if (combined.includes("peachtree")) return "Peachtree";
  if (combined.includes("andersen")) return "Andersen";
  return "All Window Door Parts";
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== All Window Door Parts — Live Site Importer ===\n");
  console.log("Source: www.allwindowdoorparts.com\n");

  // 1. Upsert categories
  console.log("1. Upserting categories...");
  for (const cat of OUR_CATEGORIES) {
    await db.insert(categoriesTable).values(cat)
      .onConflictDoUpdate({ target: categoriesTable.slug, set: { name: cat.name, description: cat.description } });
  }
  console.log(`   ${OUR_CATEGORIES.length} categories ready.\n`);

  // 2. Clear existing products
  console.log("2. Clearing existing products...");
  await db.execute(sql`DELETE FROM products`);
  console.log("   Done.\n");

  // 3. Fetch all WP products via REST API
  console.log("3. Fetching all products from WP REST API...");
  const allProducts: WpProduct[] = [];
  let page = 1;
  while (true) {
    const url = `${BASE_URL}/wp-json/wp/v2/product?per_page=100&page=${page}&_fields=id,slug,link,title,content,excerpt,featured_media,product_cat,product_tag,product_brand&status=publish`;
    console.log(`   Page ${page}...`);
    const data = await fetchJson<WpProduct[]>(url);
    if (!data || data.length === 0) break;
    allProducts.push(...data);
    if (data.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`   Total products fetched: ${allProducts.length}\n`);

  // 4. Fetch featured media URLs in batch
  console.log("4. Fetching product images...");
  const mediaIds = [...new Set(allProducts.map(p => p.featured_media).filter(id => id > 0))];
  console.log(`   ${mediaIds.length} unique media IDs to fetch...`);
  const mediaMap: Record<number, string> = {};
  
  const mediaTasks = mediaIds.map(id => async () => {
    const data = await fetchJson<{ source_url: string; alt_text: string }>(
      `${BASE_URL}/wp-json/wp/v2/media/${id}?_fields=source_url,alt_text`
    );
    if (data?.source_url) mediaMap[id] = data.source_url;
    return id;
  });

  let mediaDone = 0;
  await batchRun(mediaTasks, 6, (done) => {
    mediaDone = done;
    if (done % 20 === 0) process.stdout.write(`   ${done}/${mediaIds.length} images fetched\r`);
  });
  console.log(`   ${Object.keys(mediaMap).length} images fetched.      \n`);

  // 5. Scrape individual product pages for price + SKU
  console.log("5. Scraping product pages for prices and SKUs...");
  const productDetails: Record<number, ScrapedProductData> = {};

  const pageTasks = allProducts.map((wpProd, i) => async () => {
    const html = await fetchHtml(wpProd.link);
    if (!html) {
      productDetails[wpProd.id] = { sku: "", price: 0, originalPrice: null, imageUrl: null, inStock: true, compatibleBrands: [], specifications: {}, tags: [] };
      return;
    }
    productDetails[wpProd.id] = scrapeProductPage(html);
    if ((i + 1) % 10 === 0) process.stdout.write(`   ${i + 1}/${allProducts.length} pages scraped\r`);
  });

  await batchRun(pageTasks, CONCURRENCY);
  console.log(`   ${allProducts.length} pages scraped.      \n`);

  // 6. Insert all products
  console.log("6. Inserting products into database...");
  let inserted = 0;
  let skipped = 0;

  for (const wpProd of allProducts) {
    const details = productDetails[wpProd.id] || {};
    const title = extractTextFromHtml(wpProd.title.rendered);
    const descHtml = wpProd.content.rendered;
    const description = extractTextFromHtml(wpProd.excerpt.rendered || descHtml).slice(0, 1000);
    const { category, subcategory } = mapWcCategory(wpProd.product_cat);
    const supplier = mapSupplier(title, descHtml, details.tags || []);

    const imageUrl = details.imageUrl ||
      (wpProd.featured_media ? mediaMap[wpProd.featured_media] : null) ||
      null;

    // Always use WP product ID in the SKU to guarantee uniqueness across all 387 products.
    // Their original AWDP SKU (if any) is stored in specifications.
    const originalSku = details.sku || "";
    const sku = `AWDP-${wpProd.id}`;
    if (originalSku) {
      details.specifications = { ...details.specifications, "Original SKU": originalSku };
    }

    // Ensure price is reasonable
    let price = details.price || 0;
    if (!price || price < 0.01) {
      // For $0 products (variable products), set a placeholder price of 0
      price = 0;
    }

    try {
      await db.insert(productsTable).values({
        sku: sku.slice(0, 50),
        name: title.slice(0, 200),
        description: description || `${title} — replacement part from All Window Door Parts.`,
        price: String(Math.round(price * 100) / 100),
        originalPrice: details.originalPrice ? String(details.originalPrice) : null,
        category,
        subcategory,
        supplier,
        inStock: details.inStock !== false,
        imageUrl,
        tags: details.tags || [],
        specifications: details.specifications || {},
        compatibleBrands: details.compatibleBrands || [],
      }).onConflictDoUpdate({
        target: productsTable.sku,
        set: {
          name: title.slice(0, 200),
          description: description || `${title} — replacement part.`,
          price: String(Math.round(price * 100) / 100),
          imageUrl,
        }
      });
      inserted++;
    } catch (e) {
      console.warn(`  [WARN] Failed to insert "${title}": ${e}`);
      skipped++;
    }
  }

  console.log(`   Inserted: ${inserted} | Skipped: ${skipped}\n`);

  // 7. Final summary
  const supplierRows = await db.execute<{ supplier: string; count: string }>(
    sql`SELECT supplier, COUNT(*)::text as count FROM products GROUP BY supplier ORDER BY COUNT(*) DESC`
  );
  const totalRow = await db.execute<{ count: string }>(sql`SELECT COUNT(*)::text as count FROM products`);
  const catRows = await db.execute<{ category: string; count: string }>(
    sql`SELECT category, COUNT(*)::text as count FROM products GROUP BY category ORDER BY COUNT(*) DESC`
  );

  console.log("=== IMPORT COMPLETE ===");
  console.log(`Total products in DB: ${totalRow.rows[0]?.count || "?"}`);
  console.log("\nBy supplier:");
  for (const row of supplierRows.rows) {
    console.log(`  ${row.supplier}: ${row.count}`);
  }
  console.log("\nBy category:");
  for (const row of catRows.rows) {
    console.log(`  ${row.category}: ${row.count}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
