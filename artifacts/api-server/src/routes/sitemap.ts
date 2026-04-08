import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { isNotNull } from "drizzle-orm";

const router = Router();

const BASE_URL = "https://www.allwindowdoorparts.com";

const STATIC_PAGES = [
  { path: "/",                    priority: "1.0", changefreq: "weekly" },
  { path: "/shop",                priority: "0.9", changefreq: "daily" },
  { path: "/categories",          priority: "0.8", changefreq: "weekly" },
  { path: "/parts-identification", priority: "0.9", changefreq: "monthly" },
  { path: "/about",               priority: "0.6", changefreq: "monthly" },
  { path: "/contact",             priority: "0.6", changefreq: "monthly" },
];

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const [categories, products] = await Promise.all([
      db.select({ name: categoriesTable.name, slug: categoriesTable.slug }).from(categoriesTable),
      db.select({ sku: productsTable.sku }).from(productsTable).where(isNotNull(productsTable.imageUrl)),
    ]);

    const today = new Date().toISOString().split("T")[0];

    const urls: string[] = [];

    // Static pages
    for (const page of STATIC_PAGES) {
      urls.push(`  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${today}</lastmod>
  </url>`);
    }

    // Category pages (via shop filter)
    for (const cat of categories) {
      const catPath = `/categories/${encodeURIComponent(cat.slug ?? cat.name.toLowerCase().replace(/\s+/g, "-"))}`;
      urls.push(`  <url>
    <loc>${BASE_URL}${catPath}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${today}</lastmod>
  </url>`);
    }

    // Product pages
    for (const product of products) {
      urls.push(`  <url>
    <loc>${BASE_URL}/product/${xmlEscape(product.sku)}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <lastmod>${today}</lastmod>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=86400"); // 24h cache
    res.send(xml);
  } catch (err: any) {
    res.status(500).send("<?xml version='1.0'?><error>Failed to generate sitemap</error>");
  }
});

export default router;
