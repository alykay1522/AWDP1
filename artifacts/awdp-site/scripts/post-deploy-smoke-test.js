const BASE_URL = (process.env.SITE_URL || "https://www.allwindowdoorparts.com").replace(/\/+$/, "");
const ALLOW_WRITE_TESTS = process.env.ALLOW_WRITE_SMOKE_TESTS === "true";
const results = [];

function log(message, success = true) {
  const icon = success ? "✅" : "❌";
  console.log(`${icon} ${message}`);
  results.push({ message, success });
}

async function read(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...options,
  });
}

async function checkPage(path, expectedHeading, expectedCanonical) {
  try {
    const response = await read(path);
    const html = await response.text();
    if (!response.ok) {
      log(`${path} returned ${response.status}`, false);
      return;
    }
    if (!html.includes(expectedHeading)) {
      log(`${path} did not contain its crawler-visible heading`, false);
      return;
    }
    if (expectedCanonical && !html.includes(`rel="canonical" href="${expectedCanonical}"`)) {
      log(`${path} did not contain the expected canonical URL`, false);
      return;
    }
    log(`${path} serves route-specific HTML and metadata`);
  } catch (error) {
    log(`${path} failed: ${error.message}`, false);
  }
}

async function checkHealth() {
  try {
    const response = await read("/api/health");
    const body = await response.json().catch(() => ({}));
    log(response.ok ? "API health endpoint is reachable" : `API health returned ${response.status}: ${body.error || "unknown error"}`, response.ok);
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
    const hasRawWhitespace = locs.some((url) => /\s/.test(url));
    const hasBrokenCategoryDetail = locs.some((url) => /\/categories\/.+/.test(url));
    const valid = response.ok
      && response.headers.get("content-type")?.includes("application/xml")
      && xml.includes("<urlset")
      && locs.length > 10
      && !hasRawWhitespace
      && !hasBrokenCategoryDetail;
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

async function runOptionalWriteTests() {
  if (!ALLOW_WRITE_TESTS) {
    console.log("ℹ️  Skipping form submissions. Set ALLOW_WRITE_SMOKE_TESTS=true only in an isolated test environment.");
    return;
  }

  const marker = `Automated smoke test ${new Date().toISOString()}`;
  for (const [path, payload, label] of [
    ["/api/contact", { name: "Smoke Test", email: "smoketest@example.com", message: marker, subject: "Smoke Test" }, "Contact form"],
    ["/api/parts-id", { name: "Smoke Test", email: "smoketest@example.com", description: marker, windowDoorBrand: "Test Brand", windowDoorAge: "5-10 years" }, "Parts ID form"],
  ]) {
    try {
      const response = await read(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      log(response.ok && body.success ? `${label} submission succeeded` : `${label} submission failed: ${body.error || response.status}`, response.ok && body.success);
    } catch (error) {
      log(`${label} submission failed: ${error.message}`, false);
    }
  }
}

async function runSmokeTests() {
  console.log(`\n🚀 Running read-only deployment smoke tests on: ${BASE_URL}\n`);
  await checkPage("/", "Replacement Window &amp; Door Parts", `${BASE_URL}/`);
  await checkPage("/shop", "Shop Replacement Window &amp; Door Parts", `${BASE_URL}/shop`);
  await checkPage("/parts-identification", "Free Parts Identification", `${BASE_URL}/parts-identification`);
  await checkHealth();
  await checkRobots();
  await checkSitemap();
  await checkUnknownProduct404();
  await runOptionalWriteTests();

  const passed = results.filter((result) => result.success).length;
  const failed = results.length - passed;
  console.log(`\n--- Summary ---\n✅ Passed: ${passed}\n❌ Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
