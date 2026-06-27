import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, "..");
const indexPath = path.join(siteRoot, "dist/public/index.html");
const vercelPath = path.join(siteRoot, "vercel.json");
const robotsPath = path.join(siteRoot, "public/robots.txt");

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${message}`);
  }
}

assert(fs.existsSync(indexPath), "Vite produced dist/public/index.html");
if (!fs.existsSync(indexPath)) process.exit(1);

const html = fs.readFileSync(indexPath, "utf8");
const vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
const robots = fs.readFileSync(robotsPath, "utf8");

assert(/<title>[^<]+<\/title>/i.test(html), "default HTML has a title");
assert(/<meta\s+name=["']description["']/i.test(html), "default HTML has a meta description");
assert(/<link\s+rel=["']canonical["']/i.test(html), "default HTML has a canonical URL");
assert(/application\/ld\+json/i.test(html), "default HTML includes structured data");
assert(!html.includes("PROPERTY_ID/WIDGET_ID"), "no placeholder chat widget is shipped");
assert(!html.includes("localhost:3000"), "production HTML contains no localhost API URL");

assert(vercel.outputDirectory === "dist/public", "Vercel serves the actual Vite output directory");
assert(
  Array.isArray(vercel.rewrites) && vercel.rewrites.some((rewrite) => rewrite.destination?.includes("/api/ssr")),
  "public routes use the SEO renderer",
);
assert(!vercel.routes, "legacy Vercel routes are not mixed with modern headers");

const allHeaders = (vercel.headers || []).flatMap((entry) => entry.headers || []);
const headerNames = new Set(allHeaders.map((header) => String(header.key).toLowerCase()));
for (const required of [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
]) {
  assert(headerNames.has(required), `security header configured: ${required}`);
}

const sitemapLines = robots.split(/\r?\n/).filter((line) => /^Sitemap:/i.test(line));
assert(sitemapLines.length === 1, "robots.txt declares one canonical sitemap");
assert(!robots.includes("/api/sitemap.xml"), "robots.txt does not advertise the broken API sitemap");

if (process.exitCode) process.exit(process.exitCode);
console.log("SEO build verification passed.");
