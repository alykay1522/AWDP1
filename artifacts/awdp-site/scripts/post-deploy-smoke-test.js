const BASE_URL = (process.env.SITE_URL || "https://www.allwindowdoorparts.com").replace(/\/+$/, "");
const APEX_URL = "https://allwindowdoorparts.com";
const results = [];

function log(message, success = true) {
  console.log(`${success ? "✅" : "❌"} ${message}`);
  results.push({ message, success });
}

async function requestAbsolute(url) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
}

async function read(path) {
  return requestAbsolute(`${BASE_URL}${path}`);
}

async function checkApexRedirect() {
  try {
    const response = await requestAbsolute(`${APEX_URL}/shop?search=balance`);
    const location = response.headers.get("location") || "";
    const valid = [301, 302, 307, 308].includes(response.status)
      && location.startsWith(`${BASE_URL}/shop`)
      && location.includes("search=balance");
    log(valid ? "Apex domain redirects to the canonical www host" : `Apex redirect failed: ${response.status} ${location}`, valid);
  } catch (error) {
    log(`Apex redirect check failed: ${error.message}`, false);
  }
}

async function checkPage(path, expectedHeading, expectedCanonical) {
  try {
    const response = await read(path);
    const html = await response.text();
    const valid = response.ok
      && html.includes(expectedHeading)
      && html.includes(`rel="canonical" href="${expectedCanonical}"`);
    log(valid ? `${path} serves route-specific HTML and metadata` : `${path} failed crawler HTML validation`, valid);
  } catch (error) {
    log(`${path} failed: ${error.message}`, false);
  }
}

async function checkHealth() {
  try {
    const response = await read("/api/healthz");
    const body = await response.json().catch(() => ({}));
    const valid = response.ok && body.status === "ok";
    log(valid ? "API healthz endpoint and database checks pass" : `API healthz returned ${response.status}: ${body.error || body.status || "unknown error"}`, valid);
  } catch (error) {
    log(`API health check failed: ${error.message}`, false);
  }
}

async function checkRobots() {
  try {
    const response = await read("/robots.txt");
    const text = await response.text();
    const valid = response.ok
      && /User-agent:\s*\*/i.test(text)
      && /Sitemap:\s*https:\/\/www\.allwindowdoorparts\.com\/sitemap\.xml/i.test(text)
      && /Disallow:\s*\/admin\//i.test(text);
    log(valid ? "robots.txt is valid and protects admin routes" : "robots.txt is missing required directives", valid);
  } catch (error) {
    log(`robots.txt check failed: ${error.message}`, false);
  }
}

async function checkSitemap() {
  try {
    const response = await read("/sitemap.xml");
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const valid = response.ok
      && response.headers.get("content-type")?.includes("application/xml")
      && xml.includes("<urlset")
      && locs.length > 10
      && !locs.some((url) => /\s/.test(url) || /\/categories\/.+/.test(url));
    log(valid ? `Sitemap contains ${locs.length} valid URLs` : "Sitemap contains malformed or unsupported URLs", valid);
  } catch (error) {
    log(`Sitemap check failed: ${error.message}`, false);
  }
}

async function checkUnknownProduct404() {
  try {
    const response = await read("/product/AWDP-SMOKE-TEST-NOT-FOUND");
    const robots = response.headers.get("x-robots-tag") || "";
    const valid = response.status === 404 && robots.includes("noindex");
    log(valid ? "Unknown product returns a noindex 404" : `Unknown product returned ${response.status} with X-Robots-Tag=${robots || "missing"}`, valid);
  } catch (error) {
    log(`Unknown-product check failed: ${error.message}`, false);
  }
}

async function checkCatalogQuarantine() {
  try {
    const response = await read("/api/products?search=handyman&limit=10");
    const body = await response.json().catch(() => ({}));
    const products = Array.isArray(body.products) ? body.products : [];
    const valid = response.ok && products.length === 0 && Number(body.total || 0) === 0;
    log(valid ? "Legacy service listings are quarantined from the public catalog" : `Legacy service search returned ${products.length} products`, valid);
  } catch (error) {
    log(`Catalog quarantine check failed: ${error.message}`, false);
  }
}

async function checkLegacyImageFallback() {
  try {
    const response = await read("/api/admin/images/serve/product-images/smoke-test-missing-image.jpg");
    const type = response.headers.get("content-type") || "";
    const fallback = response.headers.get("x-awdp-image-fallback") || "";
    const valid = response.ok && type.includes("image/svg+xml") && Boolean(fallback);
    log(valid ? "Missing legacy images return a stable placeholder" : `Legacy image fallback failed: ${response.status} ${type} ${fallback}`, valid);
  } catch (error) {
    log(`Legacy image fallback check failed: ${error.message}`, false);
  }
}

async function runSmokeTests() {
  console.log(`\n🚀 Running read-only deployment smoke tests on: ${BASE_URL}\n`);
  await checkApexRedirect();
  await checkPage("/", "Replacement Window &amp; Door Parts", `${BASE_URL}/`);
  await checkPage("/shop", "Shop Replacement Window &amp; Door Parts", `${BASE_URL}/shop`);
  await checkPage("/parts-identification", "Free Parts Identification", `${BASE_URL}/parts-identification`);
  await checkHealth();
  await checkRobots();
  await checkSitemap();
  await checkUnknownProduct404();
  await checkCatalogQuarantine();
  await checkLegacyImageFallback();

  const passed = results.filter((result) => result.success).length;
  const failed = results.length - passed;
  console.log(`\n--- Summary ---\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
