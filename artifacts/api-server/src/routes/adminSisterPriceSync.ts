import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { sql, eq, inArray } from "drizzle-orm";

const router = Router();

// ── Constants ─────────────────────────────────────────────────────────────────

const SISTER_SITES = {
  allbrand: "https://www.allbrandwindowdoorparts.com",
  biltbest: "https://www.biltbestwindowparts.com",
};

const CONCURRENCY = 12;
const REQUEST_DELAY_MS = 80;
const MARKUP = 1.3;
const MIN_PRICE = 0.01;
const MIN_MATCH_SCORE = 0.28;

// ── Scraping helpers ──────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)", Accept: "text/html" },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractSitemapUrls(xml: string, basePath: string): string[] {
  const matches = xml.match(/<loc>([^<]+)<\/loc>/g) ?? [];
  return matches
    .map((m) => m.replace(/<\/?loc>/g, "").trim())
    .filter((u) => u.includes(basePath));
}

function extractPrice(html: string): number | null {
  // display-price takes precedence over sell-price
  const dp = html.match(/display-price[^>]*>[\s\S]*?uc-price[^>]*>\$?([\d,]+\.?\d*)/);
  if (dp) {
    const v = parseFloat(dp[1].replace(/,/g, ""));
    if (v > 0) return v;
  }
  const sp = html.match(/sell-price[^>]*>[\s\S]*?uc-price[^>]*>\$?([\d,]+\.?\d*)/);
  if (sp) {
    const v = parseFloat(sp[1].replace(/,/g, ""));
    if (v > 0) return v;
  }
  // Fallback: any uc-price that's not 0.00
  const prices = [...html.matchAll(/class="uc-price"[^>]*>\$?([\d,]+\.?\d*)/g)].map(
    (m) => parseFloat(m[1].replace(/,/g, ""))
  );
  const valid = prices.filter((p) => p > 0.5);
  return valid.length ? valid[0] : null;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^|<]+)/);
  return m ? m[1].trim() : "";
}

// ── Product matching ──────────────────────────────────────────────────────────

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const inter = new Set([...a].filter((t) => b.has(t)));
  const union = new Set([...a, ...b]);
  return inter.size / union.size;
}

interface ProductRef {
  sku: string;
  name: string;
  tokens: Set<string>;
}

function findBestMatch(title: string, products: ProductRef[]): { sku: string; score: number } | null {
  const titleTokens = tokenize(title);
  let bestSku = "";
  let bestScore = 0;
  for (const p of products) {
    const score = jaccardSimilarity(titleTokens, p.tokens);
    if (score > bestScore) {
      bestScore = score;
      bestSku = p.sku;
    }
  }
  return bestScore >= MIN_MATCH_SCORE ? { sku: bestSku, score: bestScore } : null;
}

// ── Batch fetcher ─────────────────────────────────────────────────────────────

async function scrapeBatch(
  urls: string[],
  products: ProductRef[],
  siteName: string
): Promise<{ url: string; title: string; price: number | null; matchedSku: string | null; score: number }[]> {
  const results: { url: string; title: string; price: number | null; matchedSku: string | null; score: number }[] = [];
  for (const url of urls) {
    const html = await fetchWithTimeout(url);
    if (!html) {
      results.push({ url, title: "", price: null, matchedSku: null, score: 0 });
      continue;
    }
    const title = extractTitle(html);
    const price = extractPrice(html);
    const match = title ? findBestMatch(title, products) : null;
    results.push({
      url,
      title,
      price,
      matchedSku: match?.sku ?? null,
      score: match?.score ?? 0,
    });
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  return results;
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/admin/sister-prices/status  — how many rows, last sync time */
router.get("/admin/sister-prices/status", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT site_name,
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE matched_sku IS NOT NULL) AS matched,
             COUNT(*) FILTER (WHERE site_price > 0) AS with_price,
             MAX(scraped_at) AS last_scraped
      FROM sister_site_prices
      GROUP BY site_name
    `);
    const applied = await db.execute(sql`
      SELECT COUNT(*) AS count
      FROM products
      WHERE price > 0 AND price != original_price
        AND original_price IS NOT NULL
        AND original_price = 0
    `);
    res.json({ sites: rows.rows, appliedCount: Number(applied.rows[0]?.count ?? 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/sister-prices/preview — price update preview for matched products */
router.get("/admin/sister-prices/preview", async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      WITH avg_prices AS (
        SELECT matched_sku AS sku,
               AVG(site_price) AS avg_sister_price,
               COUNT(*) AS site_count
        FROM sister_site_prices
        WHERE matched_sku IS NOT NULL AND site_price > 0
        GROUP BY matched_sku
      )
      SELECT p.sku, p.name, p.price AS current_price, p.category,
             a.avg_sister_price,
             ROUND(a.avg_sister_price * ${MARKUP}, 2) AS new_price,
             a.site_count
      FROM avg_prices a
      JOIN products p ON p.sku = a.sku
      WHERE p.price = 0 OR p.price != ROUND(a.avg_sister_price * ${MARKUP}, 2)
      ORDER BY ABS(ROUND(a.avg_sister_price * ${MARKUP}, 2) - p.price::numeric) DESC
      LIMIT 500
    `);
    res.json({ preview: rows.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sister-prices/apply — update product prices */
router.post("/admin/sister-prices/apply", async (req, res) => {
  try {
    const { applyAll } = req.body as { applyAll?: boolean };

    const rows = await db.execute(sql`
      WITH avg_prices AS (
        SELECT matched_sku AS sku,
               AVG(site_price) AS avg_sister_price
        FROM sister_site_prices
        WHERE matched_sku IS NOT NULL AND site_price > ${MIN_PRICE}
        GROUP BY matched_sku
      )
      SELECT p.sku, ROUND(a.avg_sister_price * ${MARKUP}, 2) AS new_price, p.price AS old_price
      FROM avg_prices a
      JOIN products p ON p.sku = a.sku
      ${applyAll ? sql`` : sql`WHERE p.price::numeric = 0 OR p.price IS NULL`}
    `);

    let updated = 0;
    const updates = rows.rows as { sku: string; new_price: string; old_price: string }[];

    for (const row of updates) {
      const newPrice = parseFloat(row.new_price);
      if (newPrice <= 0) continue;
      await db.execute(sql`
        UPDATE products
        SET original_price = price,
            price = ${newPrice.toFixed(2)}
        WHERE sku = ${row.sku}
      `);
      updated++;
    }

    res.json({
      updated,
      message: `Updated prices for ${updated} products (sister-site average × ${MARKUP}).`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sister-prices/clear — remove scraped data for a site */
router.post("/admin/sister-prices/clear", async (req, res) => {
  try {
    const { site } = req.body as { site?: string };
    if (site) {
      await db.execute(sql`DELETE FROM sister_site_prices WHERE site_name = ${site}`);
    } else {
      await db.execute(sql`DELETE FROM sister_site_prices`);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/sister-prices/scrape — SSE streaming scrape job */
router.post("/admin/sister-prices/scrape", async (req: Request, res: Response) => {
  const { site = "allbrand" } = req.body as { site?: keyof typeof SISTER_SITES };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sseWrite = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const baseUrl = SISTER_SITES[site] ?? SISTER_SITES.allbrand;
  const siteName = site;

  try {
    // 1. Fetch sitemap
    sseWrite({ type: "status", message: `Fetching ${siteName} sitemap…` });
    const sitemapXml = await fetchWithTimeout(`${baseUrl}/sitemap.xml`);
    if (!sitemapXml) {
      sseWrite({ type: "error", message: "Could not fetch sitemap" });
      res.end();
      return;
    }

    const allUrls = extractSitemapUrls(sitemapXml, "/content/");
    const productUrls = allUrls.filter((u) => !u.includes("pdf") && !u.includes("-pdf") && !u.includes("_pdf"));
    sseWrite({ type: "status", message: `Found ${productUrls.length} product URLs`, total: productUrls.length });

    // 2. Load AWDP products
    sseWrite({ type: "status", message: "Loading AWDP product index…" });
    const products = await db.select({ sku: productsTable.sku, name: productsTable.name }).from(productsTable);
    const productRefs: ProductRef[] = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      tokens: tokenize(p.name),
    }));
    sseWrite({ type: "status", message: `Loaded ${productRefs.length} AWDP products` });

    // 3. Clear old data for this site
    await db.execute(sql`DELETE FROM sister_site_prices WHERE site_name = ${siteName}`);

    // 4. Scrape in chunks
    let scraped = 0;
    let matched = 0;
    let priced = 0;

    const chunkSize = CONCURRENCY;
    for (let i = 0; i < productUrls.length; i += chunkSize) {
      const chunk = productUrls.slice(i, i + chunkSize);
      const results = await scrapeBatch(chunk, productRefs, siteName);

      // Insert to DB
      if (results.length > 0) {
        for (const r of results) {
          await db.execute(sql`
            INSERT INTO sister_site_prices (site_name, site_url, site_title, site_price, matched_sku, match_score)
            VALUES (${siteName}, ${r.url}, ${r.title ?? ""}, ${r.price ?? null}, ${r.matchedSku ?? null}, ${r.score})
          `);
        }
      }

      scraped += results.length;
      matched += results.filter((r) => r.matchedSku).length;
      priced += results.filter((r) => r.price && r.price > 0).length;

      sseWrite({
        type: "progress",
        scraped,
        total: productUrls.length,
        matched,
        priced,
        pct: Math.round((scraped / productUrls.length) * 100),
      });
    }

    sseWrite({ type: "done", scraped, matched, priced, total: productUrls.length });
    res.end();
  } catch (err: any) {
    sseWrite({ type: "error", message: err.message });
    res.end();
  }
});

export default router;
