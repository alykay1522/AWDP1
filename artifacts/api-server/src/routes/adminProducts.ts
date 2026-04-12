import { Router } from "express";
import multer from "multer";
import * as os from "os";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import { objectStorageClient } from "../lib/objectStorage";

// Multer: write uploads to OS temp dir, accept up to 2 GB
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `awdp-upload-${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

const router = Router();

// ── PROFITABLE Cipher ──────────────────────────────────────────────────────────
// P=1 R=2 O=3 F=4 I=5 T=6 A=7 B=8 L=9 E=0
// Each digit → its PROFITABLE letter, each PROFITABLE letter → its digit
// Every other character passes through unchanged

const NUM_TO_LETTER: Record<string, string> = {
  "0": "E", "1": "P", "2": "R", "3": "O", "4": "F",
  "5": "I", "6": "T", "7": "A", "8": "B", "9": "L",
};
const LETTER_TO_NUM: Record<string, string> = {
  "P": "1", "R": "2", "O": "3", "F": "4", "I": "5",
  "T": "6", "A": "7", "B": "8", "L": "9", "E": "0",
};

function applyCipher(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .map((ch) => {
      if (NUM_TO_LETTER[ch] !== undefined) return NUM_TO_LETTER[ch];
      if (LETTER_TO_NUM[ch] !== undefined) return LETTER_TO_NUM[ch];
      return ch;
    })
    .join("");
}

function buildSku(originalSku: string): string {
  return "AWDP-" + applyCipher(originalSku.trim());
}

async function generateUniqueSku(originalSku: string): Promise<string> {
  const base = buildSku(originalSku);

  const [existing] = await db
    .select({ sku: productsTable.sku })
    .from(productsTable)
    .where(eq(productsTable.sku, base))
    .limit(1);

  if (!existing) return base;

  // Collision: append numeric suffix until we find a free slot
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    const [ex2] = await db
      .select({ sku: productsTable.sku })
      .from(productsTable)
      .where(eq(productsTable.sku, candidate))
      .limit(1);
    if (!ex2) return candidate;
  }

  throw new Error(`Cannot generate a unique SKU for original part number "${originalSku}"`);
}

// ──────────────────────────────────────────────────────────────────────────────

const CreateProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().default(""),
  originalSku: z.string().min(1, "Supplier part number is required"),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  category: z.string().min(1),
  supplier: z.string().default(""),
  inStock: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  compatibleBrands: z.array(z.string()).default([]),
  specifications: z.record(z.string()).default({}),
  imageUrl: z.string().url().optional(),
});

// GET /api/admin/products/preview-sku?originalSku=35-1234
// Returns the AWDP SKU that would be generated for the given supplier part number
router.get("/admin/products/preview-sku", async (req, res) => {
  try {
    const originalSku = String(req.query.originalSku ?? "").trim();
    if (!originalSku) {
      return res.status(400).json({ error: "originalSku query param is required" });
    }
    const sku = buildSku(originalSku);
    res.json({ sku, originalSku });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/products — list all products (admin, all fields)
router.get("/admin/products", async (req, res) => {
  try {
    const pageNum   = Math.max(1, Number(req.query.page  ?? 1));
    const limitNum  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
    const offset    = (pageNum - 1) * limitNum;
    const search    = String(req.query.search   ?? "").trim();
    const category  = String(req.query.category ?? "").trim();
    const stockStr  = String(req.query.inStock  ?? "").trim(); // "true" | "false" | ""

    const { ilike, and, or, eq, count, desc } = await import("drizzle-orm");

    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(productsTable.name,        `%${search}%`),
          ilike(productsTable.sku,         `%${search}%`),
          ilike(productsTable.supplier,    `%${search}%`),
          ilike(productsTable.category,    `%${search}%`),
        )
      );
    }
    if (category) conditions.push(eq(productsTable.category, category));
    if (stockStr === "true")  conditions.push(eq(productsTable.inStock, true));
    if (stockStr === "false") conditions.push(eq(productsTable.inStock, false));

    const where = conditions.length ? and(...conditions) : undefined;

    const [products, [{ total }]] = await Promise.all([
      db.select()
        .from(productsTable)
        .where(where)
        .orderBy(desc(productsTable.id))
        .limit(limitNum)
        .offset(offset),
      db.select({ total: count() })
        .from(productsTable)
        .where(where),
    ]);

    res.json({
      products,
      total: Number(total),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(total) / limitNum),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products — create a new product
router.post("/admin/products", async (req, res) => {
  try {
    const parsed = CreateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    }

    const data = parsed.data;
    const sku = await generateUniqueSku(data.originalSku);

    const [product] = await db
      .insert(productsTable)
      .values({
        sku,
        name: data.name,
        description: data.description,
        price: String(data.price.toFixed(2)),
        originalPrice: data.originalPrice ? String(data.originalPrice.toFixed(2)) : undefined,
        category: data.category,
        supplier: data.supplier,
        inStock: data.inStock,
        tags: data.tags,
        compatibleBrands: data.compatibleBrands,
        specifications: data.specifications,
        imageUrl: data.imageUrl ?? null,
      })
      .returning();

    res.status(201).json({ product, sku });
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A product with this SKU already exists. Try a different part number." });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/products/:sku — update a product
router.patch("/admin/products/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const { name, description, price, originalPrice, inStock, supplier, tags, compatibleBrands, specifications } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = String(Number(price).toFixed(2));
    if (originalPrice !== undefined) updates.originalPrice = originalPrice ? String(Number(originalPrice).toFixed(2)) : null;
    if (inStock !== undefined) updates.inStock = inStock;
    if (supplier !== undefined) updates.supplier = supplier;
    if (tags !== undefined) updates.tags = tags;
    if (compatibleBrands !== undefined) updates.compatibleBrands = compatibleBrands;
    if (specifications !== undefined) updates.specifications = specifications;

    const [updated] = await db
      .update(productsTable)
      .set(updates)
      .where(eq(productsTable.sku, sku))
      .returning();

    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json({ product: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str: string;
  if (Array.isArray(val)) str = val.join(";");
  else if (typeof val === "object") str = JSON.stringify(val);
  else str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// GET /api/admin/products/export — download all products as CSV
router.get("/admin/products/export", async (_req, res) => {
  try {
    const products = await db
      .select()
      .from(productsTable)
      .orderBy(sql`${productsTable.name} asc`);

    const COLS = [
      "sku", "name", "description", "price", "originalPrice",
      "category", "supplier", "inStock", "imageUrl",
      "tags", "compatibleBrands", "specifications",
    ];

    const rows = products.map((p) =>
      COLS.map((col) => csvEscape((p as Record<string, unknown>)[col])).join(",")
    );

    const csv = [COLS.join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="awdp-products.csv"');
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Column-name normaliser for flexible CSV import ────────────────────────────
// Strips spaces/punctuation, lowercases, then maps common aliases to our field names.
function normalizeRow(raw: Record<string, string>): Record<string, string> {
  // Build a compact-lowercase keyed copy for fast alias lookup
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().replace(/[\s\-_.]+/g, "");
    lc[key] = v;
  }

  function pick(...aliases: string[]): string {
    for (const a of aliases) {
      const v = lc[a];
      if (v !== undefined && v.trim() !== "") return v.trim();
    }
    return "";
  }

  // Strip currency symbols and commas from numeric strings
  function cleanNum(s: string): string {
    return s.replace(/[$,\s]/g, "");
  }

  const rawPrice = pick("price", "sellingprice", "ourprice", "retailprice", "unitprice",
                         "listprice", "saleprice", "suggestedprice", "baseprice", "msrp",
                         "net", "netprice", "yourprice", "yournet", "myprice");
  const rawOrig  = pick("originalprice", "msrp", "listprice", "suggestedretail",
                         "suggestedprice", "regularprice", "baseprice");
  // Separate cost/dealer-price picker used for markup-based pricing when no sell price exists
  const rawCost  = pick("cost", "dealercost", "dealerprice", "wholesale", "wholesalecost",
                         "wholesaleprice", "distributorcost", "distributorprice", "mycost",
                         "yourcost", "netcost", "purchaseprice");

  return {
    sku:            pick("sku", "awdpsku", "awdp", "partnumber", "partno", "partnum",
                         "itemnumber", "itemno", "catalogno", "catalognumber", "code", "id",
                         "number", "part", "item"),
    name:           pick("name", "productname", "itemname", "title", "product",
                         "shortdescription", "shortdesc"),
    description:    pick("description", "longdescription", "productdescription",
                         "itemdescription", "details", "desc"),
    price:          cleanNum(rawPrice),
    originalPrice:  cleanNum(rawOrig),
    cost:           cleanNum(rawCost),
    category:       pick("category", "producttype", "type", "dept", "department",
                         "productcategory", "group"),
    supplier:       pick("supplier", "vendor", "brand", "manufacturer", "source"),
    inStock:        pick("instock", "stock", "available", "availability", "qty",
                         "quantity", "qtyavailable", "qoh"),
    imageUrl:       pick("imageurl", "imagelink", "imagepath", "imagefile", "image",
                         "photo", "photourl", "picture", "pictureurl", "thumbnail",
                         "thumbnailurl", "img", "imgurl", "productimage", "productphoto",
                         "productimageurl", "mainimage", "primaryimage"),
    tags:           pick("tags", "keywords", "tag", "keyword"),
    compatibleBrands: pick("compatiblebrands", "compatbrand", "brands", "fits",
                            "compatible", "fitment"),
    specifications: pick("specifications", "specs", "attributes", "attrs"),
  };
}

// POST /api/admin/products/import — upsert products from CSV rows (parsed client-side)
// Accepts both AWDP-format SKUs (update) and raw supplier part numbers (insert as new).
router.post("/admin/products/import", async (req, res) => {
  try {
    const { rows } = req.body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    let inserted = 0, updated = 0, errored = 0, skipped = 0, needsPricing = 0;
    const errors: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeRow(rawRow);
      const rawSku = row.sku;

      try {
        if (!rawSku) {
          skipped++;
          continue; // silently skip completely blank rows
        }

        // Resolve the AWDP SKU:
        // • If it already starts with AWDP- → use it as-is
        // • Otherwise run it through the cipher to generate one
        let sku: string;
        if (rawSku.toUpperCase().startsWith("AWDP-")) {
          sku = rawSku.toUpperCase();
        } else {
          sku = await generateUniqueSku(rawSku);
        }

        // For existing products a missing price just means "don't change price"
        const [existing] = await db
          .select({ sku: productsTable.sku, price: productsTable.price })
          .from(productsTable)
          .where(eq(productsTable.sku, sku))
          .limit(1);

        // Price resolution order:
        // 1. Direct sell-price column (price, sellingprice, ourprice, etc.)
        // 2. Cost column × supplier markup (Strybuc=1.45x, Alcosupply=2.5x, default=1.5x)
        // 3. No price — import as placeholder (price=0, inStock=false) for later pricing
        let price = parseFloat(row.price);
        let priceValid = !isNaN(price) && price > 0;

        if (!priceValid && row.cost) {
          const cost = parseFloat(row.cost);
          if (!isNaN(cost) && cost > 0) {
            const supplierLower = (row.supplier || "").toLowerCase();
            const markup = supplierLower.includes("strybuc") ? 1.45
                         : supplierLower.includes("alco")    ? 2.5
                         : 1.5;
            price = Math.round(cost * markup * 100) / 100;
            priceValid = true;
          }
        }

        // No valid price for a new product → import as unpublished placeholder
        const needsPricingFlag = !priceValid && !existing;

        const inStockRaw = row.inStock.toLowerCase();
        const inStockFromCsv = inStockRaw === "true" || inStockRaw === "1"
          || inStockRaw === "yes" || inStockRaw === "y" || inStockRaw === "in stock";
        // Products with no price must be out of stock so they can't be purchased
        const inStock = needsPricingFlag ? false : (inStockRaw === "" || inStockFromCsv);

        const tags = row.tags
          ? row.tags.split(/[;|,]/).map((t) => t.trim()).filter(Boolean)
          : [];
        const compatibleBrands = row.compatibleBrands
          ? row.compatibleBrands.split(/[;|,]/).map((b) => b.trim()).filter(Boolean)
          : [];

        let specifications: Record<string, string> = {};
        if (row.specifications) {
          try { specifications = JSON.parse(row.specifications); } catch {}
        }

        const values: Record<string, unknown> = {
          name:           row.name || (existing ? undefined : rawSku),
          description:    row.description || "",
          category:       row.category || "",
          supplier:       row.supplier || "All Window Door Parts",
          inStock,
          // Only set imageUrl if the CSV actually provides one;
          // if blank on an existing product, keep whatever URL is already stored.
          imageUrl:       row.imageUrl || (existing ? undefined : null),
          tags,
          compatibleBrands,
          specifications,
        };

        if (priceValid) {
          values.price = price.toFixed(2);
        } else if (needsPricingFlag) {
          values.price = "0.00";
        }

        const origPrice = parseFloat(row.originalPrice);
        if (!isNaN(origPrice) && origPrice > 0) {
          values.originalPrice = origPrice.toFixed(2);
        }

        // Remove undefined values so we don't overwrite existing data accidentally
        for (const k of Object.keys(values)) {
          if (values[k] === undefined) delete values[k];
        }

        if (existing) {
          await db.update(productsTable).set(values).where(eq(productsTable.sku, sku));
          updated++;
        } else {
          await db.insert(productsTable).values({ sku, ...(values as any) });
          inserted++;
          if (needsPricingFlag) needsPricing++;
        }
      } catch (e: any) {
        errored++;
        if (errors.length < 50) errors.push(`${rawSku || "?"}: ${e.message}`);
      }
    }

    res.json({ inserted, updated, errored, skipped, needsPricing, errors });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────

// DELETE /api/admin/products/:sku — delete a product
router.delete("/admin/products/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const [deleted] = await db
      .delete(productsTable)
      .where(eq(productsTable.sku, sku))
      .returning({ sku: productsTable.sku });

    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ deleted: true, sku });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk image import helpers ─────────────────────────────────────────────────

function pickMainImage(filenames: string[]): string | null {
  const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
  const candidates = filenames.filter((f) => {
    const lower = f.toLowerCase();
    if (lower.includes("amesbury")) return false;
    if (!IMAGE_EXTS.some((ext) => lower.endsWith(ext))) return false;
    // Skip obvious thumbnails / small variants
    if (lower.includes("thumb") || lower.includes("_sm") || lower.includes("-sm") || lower.includes("_small")) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  // Prefer JPG, then JPEG, then PNG, then anything; pick shortest name as tiebreaker (main image)
  const ordered = [...candidates].sort((a, b) => {
    const extRank = (f: string) => {
      const l = f.toLowerCase();
      if (l.endsWith(".jpg")) return 0;
      if (l.endsWith(".jpeg")) return 1;
      if (l.endsWith(".png")) return 2;
      return 3;
    };
    return extRank(a) - extRank(b) || a.length - b.length;
  });
  return ordered[0];
}

function imgContentType(filename: string): string {
  const ext = (filename.split(".").pop() ?? "").toLowerCase();
  return ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<string, string>)[ext] ?? "image/jpeg";
}

async function uploadBufToGCS(buf: Buffer, filename: string, contentType: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectName = `product-images/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${sanitized}`;
  const bucket = objectStorageClient.bucket(bucketId);
  await bucket.file(objectName).save(buf, { metadata: { contentType }, resumable: false });
  return `/api/admin/images/serve/${objectName}`;
}

// POST /api/admin/products/bulk-import-images
// Reads .zip files from attached_assets/, matches folders by AWDP cipher to SKUs,
// uploads main product images to GCS, and updates imageUrl on matched products.
router.post("/admin/products/bulk-import-images", async (req, res) => {
  try {
    const candidates = [
      path.resolve(process.cwd(), "attached_assets"),
      path.resolve(process.cwd(), "../../attached_assets"),
      "/home/runner/workspace/attached_assets",
    ];
    const zipDir = candidates.find((d) => fs.existsSync(d));
    if (!zipDir) {
      return res.status(400).json({ error: `attached_assets dir not found. Tried: ${candidates.join(", ")}` });
    }
    const zipFiles = fs.readdirSync(zipDir).filter((f) => f.endsWith(".zip")).map((f) => path.join(zipDir, f));
    if (zipFiles.length === 0) {
      return res.status(400).json({ error: "No .zip files found in attached_assets/" });
    }

    // Collect main image per supplier part number across all zips
    const imageMap = new Map<string, { filename: string; buffer: Buffer }>();
    for (const zipPath of zipFiles) {
      const zip = new AdmZip(zipPath);
      const byFolder = new Map<string, AdmZip.IZipEntry[]>();
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const parts = entry.entryName.split("/");
        if (parts.length < 2) continue;
        // Use immediate parent folder so any ZIP nesting level works:
        // "images/10-452SS/photo.jpg" → "10-452SS", not "images"
        const folder = parts[parts.length - 2];
        if (!byFolder.has(folder)) byFolder.set(folder, []);
        byFolder.get(folder)!.push(entry);
      }
      for (const [folder, entries] of byFolder) {
        if (imageMap.has(folder)) continue;
        const filenames = entries.map((e) => e.entryName.split("/").pop()!);
        const chosen = pickMainImage(filenames);
        if (!chosen) continue;
        const entry = entries.find((e) => e.entryName.endsWith(`/${chosen}`));
        if (!entry) continue;
        imageMap.set(folder, { filename: chosen, buffer: entry.getData() });
      }
    }

    // Map supplier part numbers → expected AWDP SKUs
    const skuToFolder = new Map<string, string>();
    for (const [folder] of imageMap) {
      skuToFolder.set(buildSku(folder), folder);
    }

    // Batch-fetch all matching products
    const allSkus = [...skuToFolder.keys()];
    const found: { sku: string; id: number; imageUrl: string | null }[] = [];
    const CHUNK = 500;
    for (let i = 0; i < allSkus.length; i += CHUNK) {
      const rows = await db
        .select({ sku: productsTable.sku, id: productsTable.id, imageUrl: productsTable.imageUrl })
        .from(productsTable)
        .where(inArray(productsTable.sku, allSkus.slice(i, i + CHUNK)));
      found.push(...rows);
    }

    // Only update products that have no local image yet
    const toUpdate = found.filter((r) => !r.imageUrl || r.imageUrl.startsWith("http"));

    let uploaded = 0, failed = 0;
    const errors: string[] = [];

    for (const product of toUpdate) {
      const folder = skuToFolder.get(product.sku)!;
      const img = imageMap.get(folder)!;
      try {
        const url = await uploadBufToGCS(img.buffer, img.filename, imgContentType(img.filename));
        await db.update(productsTable).set({ imageUrl: url }).where(eq(productsTable.id, product.id));
        uploaded++;
      } catch (err: any) {
        failed++;
        errors.push(`${product.sku}: ${err.message}`);
      }
    }

    res.json({
      zipsProcessed: zipFiles.length,
      uniqueFolders: imageMap.size,
      dbMatched: found.length,
      alreadyHadImage: found.length - toUpdate.length,
      uploaded,
      failed,
      unmatched: allSkus.length - found.length,
      errors: errors.slice(0, 20),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/products/upload-images-zip ─────────────────────────────
// Accepts a multipart ZIP upload, matches image folders → AWDP SKUs, uploads to GCS.
// Matching strategies (tried in order for each folder):
//   1. Direct AWDP SKU (folder = "AWDP-XX-YY")
//   2. AWDP cipher on folder name (supplier part# → cipher → AWDP SKU)
//   3. Strip Windows " (N)" duplicate suffix, then retry both
router.post(
  "/admin/products/upload-images-zip",
  upload.single("file"),
  async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    // forceOverwrite=true replaces existing GCS images too
    const forceOverwrite = req.query.forceOverwrite === "true" || req.body?.forceOverwrite === true;

    try {
      const zip = new AdmZip(file.path);

      // Group entries by immediate parent folder (works at any ZIP nesting depth).
      // e.g. "images/10-452SS/photo.jpg" → key "10-452SS", not "images"
      const byFolder = new Map<string, AdmZip.IZipEntry[]>();
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const parts = entry.entryName.split("/");
        if (parts.length < 2) continue;
        const folder = parts[parts.length - 2];
        if (!byFolder.has(folder)) byFolder.set(folder, []);
        byFolder.get(folder)!.push(entry);
      }

      // Collect diagnostic: first few raw ZIP entries and files-per-folder
      const sampleEntries = zip.getEntries().slice(0, 5).map((e) => e.entryName);
      const sampleFolderFiles: Record<string, string[]> = {};
      for (const [folder, entries] of [...byFolder.entries()].slice(0, 3)) {
        sampleFolderFiles[folder] = entries.map((e) => e.entryName.split("/").pop()!).slice(0, 5);
      }

      // Normalize folder name: strip Windows " (N)" suffix
      function normalizeFolder(f: string): string {
        return f.replace(/\s*\(\d+\)\s*$/, "").trim();
      }

      // Build candidate SKUs for a folder name (normalized)
      function candidateSkus(raw: string): string[] {
        const norm = normalizeFolder(raw);
        const direct = norm.toUpperCase().startsWith("AWDP-") ? norm.toUpperCase() : null;
        const ciphered = buildSku(norm);
        const candidates: string[] = [];
        if (direct) candidates.push(direct);
        if (ciphered !== direct) candidates.push(ciphered);
        return candidates;
      }

      // Build map: candidate SKU → { folder, filename, buffer }
      const skuMap = new Map<string, { folder: string; filename: string; buffer: Buffer }>();
      let noImageFile = 0;
      for (const [folder, entries] of byFolder) {
        const filenames = entries.map((e) => e.entryName.split("/").pop()!);
        const chosen = pickMainImage(filenames);
        if (!chosen) { noImageFile++; continue; }
        const entry = entries.find((e) => {
          const name = e.entryName.split("/").pop();
          return name === chosen;
        });
        if (!entry) continue;
        for (const sku of candidateSkus(folder)) {
          if (!skuMap.has(sku)) {
            skuMap.set(sku, { folder, filename: chosen, buffer: entry.getData() });
          }
        }
      }

      // Batch-fetch matching products from DB
      const allCandidates = [...skuMap.keys()];
      const found: { sku: string; id: number; imageUrl: string | null }[] = [];
      const CHUNK = 500;
      for (let i = 0; i < allCandidates.length; i += CHUNK) {
        const rows = await db
          .select({ sku: productsTable.sku, id: productsTable.id, imageUrl: productsTable.imageUrl })
          .from(productsTable)
          .where(inArray(productsTable.sku, allCandidates.slice(i, i + CHUNK)));
        found.push(...rows);
      }

      // Skip products that already have a GCS image (unless forceOverwrite)
      const toUpdate = found.filter((r) => {
        if (!r.imageUrl) return true;           // no image → always update
        if (r.imageUrl.startsWith("http")) return true; // external URL → replace with GCS
        if (forceOverwrite) return true;         // force mode → replace everything
        return false;                            // has GCS image and no force → skip
      });

      let uploaded = 0, failed = 0, skipped = 0;
      const errors: string[] = [];

      for (const product of toUpdate) {
        const img = skuMap.get(product.sku);
        if (!img) { skipped++; continue; }
        try {
          const url = await uploadBufToGCS(img.buffer, img.filename, imgContentType(img.filename));
          await db.update(productsTable).set({ imageUrl: url }).where(eq(productsTable.id, product.id));
          uploaded++;
        } catch (err: any) {
          failed++;
          errors.push(`${product.sku}: ${err.message}`);
        }
      }

      // Clean up temp file
      fs.unlink(file.path, () => {});

      res.json({
        foldersInZip: byFolder.size,
        foldersWithNoImage: noImageFile,
        candidateSkus: allCandidates.length,
        dbMatched: found.length,
        alreadyHadImage: found.length - toUpdate.length,
        uploaded,
        failed,
        skipped,
        errors: errors.slice(0, 20),
        // Diagnostics to help understand ZIP structure
        sampleEntries,
        sampleFolders: [...byFolder.keys()].slice(0, 10),
        sampleFolderFiles,
      });
    } catch (err: any) {
      fs.unlink(file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/admin/products/diagnose-zip ─────────────────────────────────
// Dry-run analysis: shows exactly what would happen for each folder without uploading.
router.post(
  "/admin/products/diagnose-zip",
  upload.single("file"),
  async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const zip = new AdmZip(file.path);
      const allEntries = zip.getEntries();

      // Raw ZIP structure sample
      const rawEntries = allEntries.slice(0, 10).map((e) => e.entryName);

      // Group by immediate parent folder
      const byFolder = new Map<string, AdmZip.IZipEntry[]>();
      for (const entry of allEntries) {
        if (entry.isDirectory) continue;
        const parts = entry.entryName.split("/");
        if (parts.length < 2) continue;
        const folder = parts[parts.length - 2];
        if (!byFolder.has(folder)) byFolder.set(folder, []);
        byFolder.get(folder)!.push(entry);
      }

      function normalizeFolder(f: string) { return f.replace(/\s*\(\d+\)\s*$/, "").trim(); }
      function candidateSkus(raw: string): string[] {
        const norm = normalizeFolder(raw);
        const direct = norm.toUpperCase().startsWith("AWDP-") ? norm.toUpperCase() : null;
        const ciphered = buildSku(norm);
        const out: string[] = [];
        if (direct) out.push(direct);
        if (ciphered !== direct) out.push(ciphered);
        return out;
      }

      // Analyse up to 50 folders
      const folderList = [...byFolder.entries()].slice(0, 50);
      const allSkus = folderList.flatMap(([f]) => candidateSkus(f));
      const dbRows = allSkus.length > 0
        ? await db.select({ sku: productsTable.sku, imageUrl: productsTable.imageUrl })
            .from(productsTable).where(inArray(productsTable.sku, allSkus))
        : [];
      const dbMap = new Map(dbRows.map((r) => [r.sku, r.imageUrl]));

      const rows = folderList.map(([folder, entries]) => {
        const filenames = entries.map((e) => e.entryName.split("/").pop()!);
        const chosen = pickMainImage(filenames);
        const skus = candidateSkus(folder);
        const matchedSku = skus.find((s) => dbMap.has(s)) ?? null;
        const existingImage = matchedSku ? dbMap.get(matchedSku) : undefined;
        return {
          folder,
          normalized: normalizeFolder(folder),
          files: filenames.slice(0, 5),
          chosenImage: chosen,
          candidateSkus: skus,
          dbMatch: matchedSku,
          existingImage: existingImage ?? null,
          wouldUpload: matchedSku !== null && (existingImage === null || existingImage === undefined || (existingImage as string).startsWith("http")),
        };
      });

      fs.unlink(file.path, () => {});
      res.json({
        totalEntries: allEntries.length,
        foldersFound: byFolder.size,
        rawEntries,
        rows,
        summary: {
          wouldUpload: rows.filter((r) => r.wouldUpload).length,
          dbMatched: rows.filter((r) => r.dbMatch).length,
          alreadyHasImage: rows.filter((r) => r.dbMatch && r.existingImage && !(r.existingImage as string).startsWith("http")).length,
          noDbMatch: rows.filter((r) => !r.dbMatch).length,
          noImageFile: rows.filter((r) => !r.chosenImage).length,
        },
      });
    } catch (err: any) {
      fs.unlink(file.path, () => {});
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/admin/products/import-image-urls ─────────────────────────────
// Accepts a CSV file with columns: sku,imageUrl  (header row required)
// Updates imageUrl on matched products (overwrites existing).
router.post(
  "/admin/products/import-image-urls",
  upload.single("file"),
  async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const text = fs.readFileSync(file.path, "utf-8");
      fs.unlink(file.path, () => {});

      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"(.*)"$/, "$1"));
      const skuIdx = header.indexOf("sku");
      const urlIdx = header.findIndex((h) => h === "imageurl" || h === "image_url" || h === "url");
      if (skuIdx === -1 || urlIdx === -1) {
        return res.status(400).json({ error: `CSV must have 'sku' and 'imageUrl' columns. Found: ${header.join(", ")}` });
      }

      const rows: { sku: string; imageUrl: string }[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
        const sku = cols[skuIdx];
        const imageUrl = cols[urlIdx];
        if (sku && imageUrl) rows.push({ sku, imageUrl });
      }

      if (rows.length === 0) return res.status(400).json({ error: "No valid rows found in CSV" });

      let updated = 0, notFound = 0;
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const skus = chunk.map((r) => r.sku);
        const existing = await db
          .select({ id: productsTable.id, sku: productsTable.sku })
          .from(productsTable)
          .where(inArray(productsTable.sku, skus));
        const skuToId = new Map(existing.map((r) => [r.sku, r.id]));
        for (const row of chunk) {
          const id = skuToId.get(row.sku);
          if (!id) { notFound++; continue; }
          await db.update(productsTable).set({ imageUrl: row.imageUrl }).where(eq(productsTable.id, id));
          updated++;
        }
      }

      res.json({ totalRows: rows.length, updated, notFound });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
