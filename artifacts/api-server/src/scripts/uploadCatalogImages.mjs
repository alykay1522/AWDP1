/**
 * One-off: upload AWDP catalog images (1–281) to GCS, then update categories
 * and products with category-level representative images.
 *
 * Run from repo root:
 *   node artifacts/api-server/src/scripts/uploadCatalogImages.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import path from "path";

// Use createRequire to load CJS modules from their installed locations
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiServerDir = path.resolve(__dirname, "../../");
const rootDir = path.resolve(__dirname, "../../../../");
const libDbDir = path.resolve(__dirname, "../../../../lib/db");

// @google-cloud/storage lives in api-server/node_modules (it's a direct dep there)
const requireFromApiServer = createRequire(path.join(apiServerDir, "package.json"));
const { Storage } = requireFromApiServer("@google-cloud/storage");

// pg lives in lib/db/node_modules (it's a direct dep of @workspace/db)
const requireFromLibDb = createRequire(path.join(libDbDir, "package.json"));
const pg = requireFromLibDb("pg");
const { Pool } = pg;

// ─── Config ──────────────────────────────────────────────────────────────────
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
if (!BUCKET_ID) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const IMAGE_DIR = "/tmp/awdp_images/AWDP_Combined (1)";
const FILENAME_PREFIX = "1777086914266-1b5bfa16-73f8-4397-83c5-ff75dd03a0d4_";
const GCS_PREFIX = "product-images/awdp-catalog";

// ─── GCS client (Replit sidecar auth) ────────────────────────────────────────
const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

// ─── Category → best representative image number ──────────────────────────────
const CATEGORY_IMAGE = {
  "Window Balances": 80,                       // "Window Balances - All Types"
  "Window Hardware": 190,                      // "Marvin Awning Hardware"
  "Door Hardware": 205,                        // "Sliding Glass Patio Door Parts & Hardware"
  "Window Glazing and Weatherstrip": 281,      // "Weather Strip and Seals"
  "Screen Hardware and Accessories": 220,      // "Screen Corners" (brand collage)
  "Sash Hardware": 195,                        // "Marvin Sash Carrier Tracks"
  "Other Hardware": 210,                       // AWDP general marketing
};

const CATEGORY_SLUG_IMAGE = {
  "window-balances": 80,
  "window-hardware": 190,
  "door-hardware": 205,
  "window-glazing-and-weatherstrip": 281,
  "screen-hardware-and-accessories": 220,
  "sash-hardware": 195,
  "other-hardware": 210,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function localPath(n) {
  return path.join(IMAGE_DIR, `${FILENAME_PREFIX}${n}.jpg`);
}
function gcsObjectName(n) {
  return `${GCS_PREFIX}/image_${n}.jpg`;
}
function serveUrl(objectName) {
  return `/api/admin/images/serve/${objectName}`;
}

async function uploadImage(n) {
  const filePath = localPath(n);
  const objectName = gcsObjectName(n);
  const bucket = gcs.bucket(BUCKET_ID);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (exists) {
    return serveUrl(objectName);
  }

  await bucket.upload(filePath, {
    destination: objectName,
    metadata: { contentType: "image/jpeg" },
  });
  return serveUrl(objectName);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== AWDP Catalog Image Upload ===\n");
  console.log(`GCS bucket: ${BUCKET_ID}`);
  console.log(`Image dir: ${IMAGE_DIR}\n`);

  // 1. Find available images
  const available = [];
  for (let n = 1; n <= 281; n++) {
    if (existsSync(localPath(n))) available.push(n);
  }
  console.log(`Found ${available.length} images to upload.`);

  // 2. Upload in batches of 10
  const urlMap = {};
  const BATCH = 10;
  let uploaded = 0;
  let skipped = 0;

  for (let i = 0; i < available.length; i += BATCH) {
    const batch = available.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (n) => {
        try {
          const url = await uploadImage(n);
          return { n, url, ok: true };
        } catch (err) {
          console.error(`\n  ✗ image_${n}: ${err.message}`);
          return { n, url: "", ok: false };
        }
      })
    );
    for (const r of results) {
      if (r.ok) { urlMap[r.n] = r.url; uploaded++; }
    }
    process.stdout.write(
      `  Progress: ${Math.min(i + BATCH, available.length)}/${available.length} images...    \r`
    );
  }
  console.log(`\n\nUpload complete: ${uploaded} images.\n`);

  // 3. Update DB
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: false });
  const client = await pool.connect();

  try {
    // Update categories.image_url
    console.log("Updating categories...");
    const { rows: cats } = await client.query(
      "SELECT id, name, slug FROM categories"
    );
    for (const cat of cats) {
      const imgNum = CATEGORY_SLUG_IMAGE[cat.slug];
      if (!imgNum || !urlMap[imgNum]) {
        console.log(`  ⚠ No image mapped: ${cat.slug}`);
        continue;
      }
      await client.query(
        "UPDATE categories SET image_url = $1 WHERE id = $2",
        [urlMap[imgNum], cat.id]
      );
      console.log(`  ✓ ${cat.name} → image_${imgNum}`);
    }

    // Supplier overrides (set before category fallback)
    console.log("\nApplying supplier overrides...");
    const supplierMap = [
      { keyword: "truth", imageNum: 270 },   // Truth Hardware
      { keyword: "oldach", imageNum: 220 },  // Oldach (Screen Corners)
    ];
    for (const { keyword, imageNum } of supplierMap) {
      const imgUrl = urlMap[imageNum];
      if (!imgUrl) { console.log(`  ⚠ image_${imageNum} not uploaded`); continue; }
      const { rowCount } = await client.query(
        "UPDATE products SET image_url = $1 WHERE LOWER(supplier) LIKE $2 AND image_url IS NULL",
        [imgUrl, `%${keyword}%`]
      );
      console.log(`  ✓ supplier~'${keyword}' → image_${imageNum} (${rowCount} rows)`);
    }

    // Category-level fallback for all remaining NULL imageUrl
    console.log("\nApplying category-level images...");
    for (const [catName, imgNum] of Object.entries(CATEGORY_IMAGE)) {
      const imgUrl = urlMap[imgNum];
      if (!imgUrl) { console.log(`  ⚠ image_${imgNum} not uploaded`); continue; }
      const { rowCount } = await client.query(
        "UPDATE products SET image_url = $1 WHERE category = $2 AND image_url IS NULL",
        [imgUrl, catName]
      );
      console.log(`  ✓ '${catName}' → image_${imgNum} (${rowCount} rows)`);
    }

    // Summary
    const { rows: [{ with_img }] } = await client.query(
      "SELECT COUNT(*) as with_img FROM products WHERE image_url IS NOT NULL"
    );
    const { rows: [{ without_img }] } = await client.query(
      "SELECT COUNT(*) as without_img FROM products WHERE image_url IS NULL"
    );
    console.log(`\n=== Summary ===`);
    console.log(`Products WITH imageUrl:    ${with_img}`);
    console.log(`Products WITHOUT imageUrl: ${without_img}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
