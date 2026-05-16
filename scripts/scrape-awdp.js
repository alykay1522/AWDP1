// scripts/scrape-awdp.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE = "https://www.allbrandwindowdoorparts.com";

async function getSoup(url) {
  const res = await axios.get(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  return cheerio.load(res.data);
}

async function getCategories() {
  const $ = await getSoup(`${BASE}/catalog`);
  const categories = new Set();

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith("/catalog/")) {
      categories.add(new URL(href, BASE).toString());
    }
  });

  return [...categories];
}

async function getPaginatedPages(categoryUrl) {
  const pages = new Set([categoryUrl]);
  const $ = await getSoup(categoryUrl);

  $("li.pager-item a, li.pager-next a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) pages.add(new URL(href, BASE).toString());
  });

  return [...pages];
}

async function getProductLinks(pageUrl) {
  const $ = await getSoup(pageUrl);
  const products = new Set();

  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith("/content/") || href.startsWith("/product/")) {
      products.add(new URL(href, BASE).toString());
    }
  });

  return [...products];
}

async function scrapeProduct(url) {
  const $ = await getSoup(url);

  const title = $("h1").first().text().trim();

  // SKU (Drupal often uses field labels; adjust selectors as needed)
  const sku =
    $('[class*="sku"], [id*="sku"]').first().text().trim() ||
    $("div:contains('SKU')").next().text().trim() ||
    "";

  const price =
    $('[class*="price"]').first().text().trim() ||
    $("div:contains('$')").first().text().trim() ||
    "";

  const description =
    $('[class*="field--name-body"]').text().trim() ||
    $('[class*="description"]').text().trim() ||
    "";

  const images = new Set();
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src) return;

    const full = new URL(src, BASE).toString();

    // Skip obvious header/branding images if needed
    if (full.includes("logo") || full.includes("header")) return;

    images.add(full);
  });

  return {
    url,
    title,
    sku,
    price,
    description,
    images: [...images],
  };
}

async function scrapeAll() {
  const allProducts = [];
  const categories = await getCategories();

  for (const cat of categories) {
    const pages = await getPaginatedPages(cat);

    for (const page of pages) {
      const productLinks = await getProductLinks(page);

      for (const productUrl of productLinks) {
        console.log("Scraping:", productUrl);
        try {
          const product = await scrapeProduct(productUrl);
          allProducts.push(product);
        } catch (e) {
          console.error("Error scraping", productUrl, e.message);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  return allProducts;
}

(async () => {
  const products = await scrapeAll();

  const outDir = path.join(__dirname, "..", "data");
  const outFile = path.join(outDir, "catalog.json");

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  fs.writeFileSync(outFile, JSON.stringify(products, null, 2), "utf8");
  console.log(`Wrote ${products.length} products to ${outFile}`);
})();
