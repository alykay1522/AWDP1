import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { publicListingCondition } from "../lib/catalogVisibility";
import { logger } from "../lib/logger";

const router = Router();
const BASE_URL = (process.env.PUBLIC_SITE_URL || "https://www.allwindowdoorparts.com").replace(/\/+$/, "");

const STATIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/shop", priority: "0.9", changefreq: "daily" },
  { path: "/categories", priority: "0.8", changefreq: "weekly" },
  { path: "/parts-identification", priority: "0.9", changefreq: "monthly" },
  { path: "/identify-balance", priority: "0.7", changefreq: "monthly" },
  { path: "/about", priority: "0.6", changefreq: "monthly" },
  { path: "/contact", priority: "0.6", changefreq: "monthly" },
  { path: "/policies", priority: "0.5", changefreq: "yearly" },
  { path: "/guides", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/window-balance", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/window-operator", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/patio-door-roller", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/weatherstripping", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/door-lock", priority: "0.7", changefreq: "monthly" },
  { path: "/guides/glazing-bead", priority: "0.7", changefreq: "monthly" },
  { path: "/resources", priority: "0.6", changefreq: "monthly" },
];

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productPath(sku: string): string {
  return `/product/${encodeURIComponent(sku)}`;
}

function categoryPath(slug: string): string {
  return `/category/${encodeURIComponent(slug)}`;
}

function renderUrl(path: string, changefreq: string, priority: string, lastmod?: Date | null): string {
  const modified = lastmod && Number.isFinite(lastmod.getTime())
    ? `\n    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>`
    : "";
  return `  <url>
    <loc>${xmlEscape(`${BASE_URL}${path}`)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${modified}
  </url>`;
}

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const [products, categories] = await Promise.all([
      db
        .select({
          sku: productsTable.sku,
          createdAt: productsTable.createdAt,
        })
        .from(productsTable)
        .where(publicListingCondition),
      db.select({ slug: categoriesTable.slug }).from(categoriesTable),
    ]);

    const urls = [
      ...STATIC_PAGES.map((page) => renderUrl(page.path, page.changefreq, page.priority)),
      ...categories.map((category: { slug: string }) => renderUrl(categoryPath(category.slug), "weekly", "0.8")),
      ...products.map((product: { sku: string; createdAt: Date | null }) => renderUrl(productPath(product.sku), "monthly", "0.6", product.createdAt)),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(xml);
  } catch (error) {
    logger.error({ err: error }, "Failed to generate sitemap");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><error>Sitemap temporarily unavailable</error>");
  }
});

export default router;
