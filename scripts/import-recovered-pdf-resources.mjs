import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import pg from "pg";

const { Client } = pg;
const repoRoot = process.cwd();
const markerKey = "pdf_resources_scraped_import_v1";

const BRANDS = [
  "Marvin", "WeatherShield", "Truth", "Peachtree", "Andersen", "Pella",
  "BiltBest", "Oldach", "Wenco", "Lincoln", "Eagle", "Hurd", "Traco",
  "Silverline", "Guardian", "Thermal-Guard", "Seal-Rite", "Kolbe",
  "Crestline", "Vetter", "Norco", "Pozzi", "Jeld-Wen", "Atrium",
  "Milgard", "Ply Gem", "CertainTeed", "Caradco", "Malta", "Roto",
  "Ashland", "Amesbury", "Strybuc", "Hoppe", "Wright", "Stanley",
  "Lawson", "PGT", "Herculite",
];

function inferBrand(title) {
  const lower = title.toLowerCase();
  return BRANDS.find((brand) => lower.includes(brand.toLowerCase())) ?? "All Brands";
}

function inferCategory(title) {
  const lower = title.toLowerCase();
  if (["balance", "jambliner", "jamb liner", "sash support", "block & tackle", "block and tackle"].some((term) => lower.includes(term))) {
    return "Support Guides & Balances";
  }
  if (["double hung", "single hung", "tilt pac", "tilt-pac", "tilt window", "glider", "slider", " sash"].some((term) => lower.includes(term))) {
    return "Double Hung Windows";
  }
  if (["casement", "awning", "operator", "hinge", "crank", "roof window", "tilt-turn", "hopper"].some((term) => lower.includes(term))) {
    return "Casement Windows";
  }
  if (["patio door", "sliding door", "screen door", "door roller", "door handle", "door lock", "multipoint", "multi-point", "threshold", "swing door"].some((term) => lower.includes(term))) {
    return "Patio Doors";
  }
  return "Hardware & Accessories";
}

function inferType(title) {
  const lower = title.toLowerCase();
  if (["how to measure", "measurement", "measure "].some((term) => lower.includes(term))) return "Measurement Guide";
  if (["how to", "install", "instruction", "adjustment", "service manual"].some((term) => lower.includes(term))) return "How-To Guide";
  if (["catalog", "collection", "parts reference", "replacement parts", "parts manual", "parts list"].some((term) => lower.includes(term))) return "Product Catalog";
  return "Reference";
}

function loadRecoveredRows() {
  const sourcePath = path.join(
    repoRoot,
    "artifacts",
    "api-server",
    "src",
    "data",
    "recoveredPdfResources.ts",
  );
  const source = fs.readFileSync(sourcePath, "utf8");
  const match = source.match(/const RECOVERED_PDF_DATA = "([A-Za-z0-9+/=]+)";/);
  if (!match) throw new Error("Could not locate RECOVERED_PDF_DATA");
  return JSON.parse(gunzipSync(Buffer.from(match[1], "base64")).toString("utf8"));
}

async function insertBatch(client, resources) {
  if (!resources.length) return;
  const columnsPerRow = 8;
  const values = [];
  const placeholders = resources.map((resource, rowIndex) => {
    const base = rowIndex * columnsPerRow;
    values.push(
      resource.title,
      resource.brand,
      resource.category,
      resource.type,
      resource.url,
      resource.description,
      resource.sortOrder,
      resource.isActive,
    );
    return `(${Array.from({ length: columnsPerRow }, (_, columnIndex) => `$${base + columnIndex + 1}`).join(",")})`;
  });

  await client.query(
    `INSERT INTO pdf_resources
      (title, brand, category, type, url, description, sort_order, is_active)
     VALUES ${placeholders.join(",")}`,
    values,
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[pdf-resource-import] DATABASE_URL is not configured; skipping import");
    return;
  }

  const compactRows = loadRecoveredRows();
  const resources = compactRows.map(([sequence, title, archiveTimestamp, sourceUrl]) => ({
    title,
    brand: inferBrand(title),
    category: inferCategory(title),
    type: inferType(title),
    url: `https://web.archive.org/web/${archiveTimestamp}id_/${sourceUrl}`,
    description: `Imported scraped PDF from the former AllBrand Window & Door Parts resource library. Original source: ${sourceUrl}`,
    sortOrder: sequence,
    isActive: true,
  }));

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const marker = await client.query("SELECT value FROM site_settings WHERE key = $1", [markerKey]);
    if (marker.rowCount && marker.rows[0]?.value) {
      console.log(`[pdf-resource-import] already completed: ${marker.rows[0].value}`);
      return;
    }

    const existingResult = await client.query("SELECT url FROM pdf_resources");
    const existingUrls = new Set(existingResult.rows.map((row) => row.url));
    const missing = resources.filter((resource) => !existingUrls.has(resource.url));

    await client.query("BEGIN");
    for (let index = 0; index < missing.length; index += 50) {
      await insertBatch(client, missing.slice(index, index + 50));
    }

    const markerValue = JSON.stringify({
      imported: missing.length,
      totalRecovered: resources.length,
      completedAt: new Date().toISOString(),
    });
    await client.query(
      `INSERT INTO site_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [markerKey, markerValue],
    );
    await client.query("COMMIT");

    console.log(`[pdf-resource-import] imported=${missing.length} total=${resources.length}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[pdf-resource-import] failed", error);
  process.exitCode = 1;
});
