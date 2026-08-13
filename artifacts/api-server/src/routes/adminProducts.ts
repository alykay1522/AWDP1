import { Router } from "express";
import multer from "multer";
import * as os from "os";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { and, eq, sql, inArray, ilike } from "drizzle-orm";
import { z } from "zod";
import AdmZip from "adm-zip";
import * as fs from "fs";
import * as path from "path";
import { objectStorageClient } from "../lib/objectStorage";
import { resolveProductCategory } from "../lib/resolveProductCategory";

// Multer: write uploads to OS temp dir, accept up to 2 GB
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    // multer does NOT sanitise file.originalname. Interpolating it straight into
    // the on-disk filename lets a crafted upload ("../../x") escape tmpdir and
    // write anywhere the process can. Strip directory components and restrict to
    // a safe character set before use.
    filename: (_req, file, cb) => {
      const base = path.basename(file.originalname || "");
      const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 120);
      cb(null, `awdp-upload-${Date.now()}-${safe || "upload"}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

const router = Router();

function buildSku(originalSku: string): string {
  const clean = originalSku.trim().toUpperCase();
  // If already prefixed, return as-is
  if (clean.startsWith("AWDP-")) return clean;
  return "AWDP-" + clean;
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
    const zeroPrice = req.query.zeroPrice === "true";
    if (zeroPrice) conditions.push(sql`${productsTable.price}::numeric = 0`);

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
export function normalizeRow(raw: Record<string, string>): Record<string, string> {
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
    // Structured variant data — deliberately distinct aliases from "attributes"/"attrs"
    // above, which are reserved for the free-text specifications column.
    variantAttributes: pick("variantattributes", "dropdownoptions", "variantoptions", "options"),
    variantGroupId: pick("variantgroupid", "variantgroup", "productgroup", "groupid", "family"),
    variantLabel:   pick("variantlabel", "optionlabel", "variant"),
    soldAs:         pick("soldas", "soldby", "packaging", "unitofsale"),
  };
}

export type ImportExistingProduct = {
  sku: string;
  price: string;
  category: string;
  name: string;
};

export function buildProductImportValues(
  row: ReturnType<typeof normalizeRow>,
  rawSku: string,
  sku: string,
  existing?: ImportExistingProduct,
): { values: Record<string, unknown>; needsPricing: boolean } {
  const isUpdate = Boolean(existing);
  // Price resolution order:
  // 1. Direct sell-price column (price, sellingprice, ourprice, etc.)
  // 2. Cost column x supplier markup (Strybuc=1.45x, Alcosupply=2.5x, default=1.5x)
  // 3. No price - import as placeholder (price=0, inStock=false) for later pricing
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

  const needsPricingFlag = !priceValid && !existing;

  const inStockRaw = row.inStock.toLowerCase();
  const inStockFromCsv = inStockRaw === "true" || inStockRaw === "1"
    || inStockRaw === "yes" || inStockRaw === "y" || inStockRaw === "in stock";
  const inStock = needsPricingFlag
    ? false
    : (isUpdate && inStockRaw === "" ? undefined : (inStockRaw === "" || inStockFromCsv));

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

  let attributes: Record<string, string[]> | undefined;
  if (row.variantAttributes) {
    try {
      const parsed = JSON.parse(row.variantAttributes);
      if (parsed && typeof parsed === "object") attributes = parsed;
    } catch {}
  }

  const productName = row.name || existing?.name || rawSku;
  const category = resolveProductCategory({
    rawCategory: row.category,
    sku,
    name: productName,
    existingCategory: existing?.category,
  });

  const values: Record<string, unknown> = {
    name:           row.name || (existing ? undefined : rawSku),
    description:    row.description || (isUpdate ? undefined : ""),
    category,
    supplier:       row.supplier || (isUpdate ? undefined : "All Window Door Parts"),
    inStock,
    imageUrl:       row.imageUrl || (existing ? undefined : null),
    tags:           row.tags || !isUpdate ? tags : undefined,
    compatibleBrands: row.compatibleBrands || !isUpdate ? compatibleBrands : undefined,
    specifications: row.specifications || !isUpdate ? specifications : undefined,
    attributes:     attributes ?? (isUpdate ? undefined : null),
    variantGroupId: row.variantGroupId || (isUpdate ? undefined : null),
    variantLabel:   row.variantLabel || (isUpdate ? undefined : null),
    soldAs:         row.soldAs || (isUpdate ? undefined : null),
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

  for (const k of Object.keys(values)) {
    if (values[k] === undefined) delete values[k];
  }

  return { values, needsPricing: needsPricingFlag };
}

export type BulkProductFilter = {
  search?: string;
  category?: string;
  zeroPrice?: boolean;
  inStock?: string;
};

export function hasBulkProductFilterConstraints(filter: BulkProductFilter): boolean {
  return Boolean(
    filter
      && typeof filter === "object"
      && (
        filter.search?.trim()
        || filter.category?.trim()
        || filter.zeroPrice === true
        || filter.inStock === "true"
        || filter.inStock === "false"
      ),
  );
}

// POST /api/admin/products/bulk-rename
// Accepts CSV rows with "Original Title" → "AWDP Title" mapping.
// Matches products by name (case-insensitive) and renames them.
// Body: { rows: Array<Record<string,string>> } — already parsed from CSV client-side.
/**
 * Produce candidate search strings from an "Original Title" value.
 * The DB has inconsistent formatting (34in vs 34", spaces, dashes, dots, parens)
 * so we try several normalizations in order.
 */
function titleVariants(raw: string): string[] {
  const seen = new Set<string>();
  const push = (s: string) => { const t = s.trim(); if (t) seen.add(t); };

  push(raw);

  // 34in → 34" (with and without space)
  const v1 = raw.replace(/(\d+)\s*in\s+/gi, '$1"');
  push(v1);
  push(v1.replace(/"\s+/g, '"'));           // remove space after "

  // 34" → 34in (reverse direction for DB entries that use "in")
  const v2 = raw.replace(/(\d+)"\s*/gi, '$1in ');
  push(v2);

  // Trailing dot/punctuation removal
  push(raw.replace(/[.\s]+$/, ""));
  push(v1.replace(/[.\s]+$/, ""));

  // Weight format normalization across many DB styles:
  //   "32LBS" ↔ "(32LBS)" ↔ "-32LBS" ↔ "-32LBS." ↔ " 32 Lbs" ↔ "32 Lbs"
  const normalizeWeight = (s: string) =>
    // collapse "32 Lbs" / "32 LBS" / "32lbs" all to "32LBS"
    s.replace(/(\d+)\s+[Ll][Bb][Ss]\.?\s*$/g, "$1LBS")
     .replace(/(\d+)[Ll][Bb][Ss]\.?\s*$/g,    "$1LBS");

  const rn = normalizeWeight(raw);
  const v1n = normalizeWeight(v1);
  push(rn);
  push(v1n);

  // Remove parens around weight
  push(rn.replace(/\s*\((\d+LBS)\)\s*$/i, " $1"));
  push(v1n.replace(/\s*\((\d+LBS)\)\s*$/i, " $1"));
  // Add parens around weight
  push(rn.replace(/\s+(\d+LBS)\.?\s*$/i, " ($1)"));
  push(v1n.replace(/\s+(\d+LBS)\.?\s*$/i, " ($1)"));
  // Dash-weight
  push(rn.replace(/\s+(\d+LBS)\.?\s*$/i, "-$1"));
  push(v1n.replace(/\s+(\d+LBS)\.?\s*$/i, "-$1"));
  push(rn.replace(/\s+(\d+LBS)\.?\s*$/i, "-$1."));
  push(v1n.replace(/\s+(\d+LBS)\.?\s*$/i, "-$1."));
  // Space-separated weight (DB stores "34 Lbs" pattern)
  push(rn.replace(/(\d+)LBS$/i, "$1 Lbs"));
  push(v1n.replace(/(\d+)LBS$/i, "$1 Lbs"));

  return [...seen];
}

router.post("/admin/products/bulk-rename", async (req, res) => {
  try {
    const { rows } = req.body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    let updated    = 0;
    let notFound   = 0;
    let skipped    = 0;
    const misses: string[] = [];

    for (const row of rows) {
      const originalTitle = (
        row["Original Title"] ?? row["original title"] ?? row["original_title"] ?? ""
      ).trim();
      const awdpTitle = (
        row["AWDP Title"] ?? row["awdp title"] ?? row["awdp_title"] ?? ""
      ).trim();

      if (!originalTitle || !awdpTitle) { skipped++; continue; }
      if (originalTitle === awdpTitle)  { skipped++; continue; }

      // Try each normalized variant until we get a match
      let matched: { id: number }[] = [];
      for (const variant of titleVariants(originalTitle)) {
        const hits = await db
          .select({ id: productsTable.id })
          .from(productsTable)
          .where(ilike(productsTable.name, variant));
        if (hits.length > 0) { matched = hits; break; }
      }

      if (matched.length === 0) {
        notFound++;
        if (misses.length < 100) misses.push(originalTitle);
        continue;
      }

      const ids = matched.map((m) => m.id);
      await db
        .update(productsTable)
        .set({ name: awdpTitle })
        .where(inArray(productsTable.id, ids));

      updated += matched.length;
    }

    res.json({
      message: "Bulk rename complete",
      rowsProcessed: rows.length,
      productsUpdated: updated,
      notFound,
      skipped,
      misses: misses.length > 0 ? misses : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products/import — upsert products from CSV rows (parsed client-side)
// Accepts both AWDP-format SKUs (update) and raw supplier part numbers (insert as new).
// The admin UI sends multiple chunked requests for very large files (see MAX_PRODUCT_IMPORT_ROWS).
router.post("/admin/products/import", async (req, res) => {
  try {
    const { rows } = req.body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    const maxRows = Math.min(
      100_000,
      Math.max(1, Number.parseInt(process.env.MAX_PRODUCT_IMPORT_ROWS ?? "10000", 10) || 10_000),
    );
    if (rows.length > maxRows) {
      return res.status(413).json({
        error: `This request has ${rows.length} rows; maximum per request is ${maxRows}. Use smaller batches or raise MAX_PRODUCT_IMPORT_ROWS.`,
      });
    }

    let inserted = 0, updated = 0, errored = 0, skipped = 0, needsPricing = 0;
    const errors: string[] = [];

    type PreparedImportRow = {
      rawRow: Record<string, string>;
      row: ReturnType<typeof normalizeRow>;
      rawSku: string;
      sku: string;
    };
    const prepared: PreparedImportRow[] = [];

    for (const rawRow of rows) {
      const row = normalizeRow(rawRow);
      const rawSku = row.sku;
      if (!rawSku) {
        skipped++;
        continue;
      }

      try {
        let sku: string;
        if (rawSku.toUpperCase().startsWith("AWDP-")) {
          sku = rawSku.toUpperCase();
        } else {
          sku = await generateUniqueSku(rawSku);
        }
        prepared.push({ rawRow, row, rawSku, sku });
      } catch (e: any) {
        errored++;
        if (errors.length < 50) errors.push(`${rawSku}: ${e.message}`);
      }
    }

    const existingBySku = new Map<
      string,
      ImportExistingProduct
    >();
    if (prepared.length > 0) {
      const skuList = [...new Set(prepared.map((p) => p.sku))];
      const existingRows = await db
        .select({
          sku: productsTable.sku,
          price: productsTable.price,
          category: productsTable.category,
          name: productsTable.name,
        })
        .from(productsTable)
        .where(inArray(productsTable.sku, skuList));
      for (const ex of existingRows) {
        existingBySku.set(ex.sku, ex);
      }
    }

    for (const { row, rawSku, sku } of prepared) {
      try {
        const existing = existingBySku.get(sku);
        const { values, needsPricing: needsPricingFlag } =
          buildProductImportValues(row, rawSku, sku, existing);

        if (existing) {
          await db.update(productsTable).set(values).where(eq(productsTable.sku, sku));
          updated++;
          existingBySku.set(sku, {
            sku,
            price: (values.price as string | undefined) ?? existing.price,
            category: (values.category as string | undefined) ?? existing.category,
            name: (values.name as string | undefined) ?? existing.name,
          });
        } else {
          await db.insert(productsTable).values({ sku, ...(values as any) });
          inserted++;
          if (needsPricingFlag) needsPricing++;
          existingBySku.set(sku, {
            sku,
            price: (values.price as string | undefined) ?? "0.00",
            category: values.category as string,
            name: (values.name as string | undefined) ?? rawSku,
          });
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

// POST /api/admin/products/delete-all — delete every product (requires confirm:true in body)
router.post("/admin/products/delete-all", async (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: "Send { confirm: true } in request body to delete all products" });
  }
  try {
    const result = await db.delete(productsTable).returning({ id: productsTable.id });
    res.json({ deleted: result.length, message: `Deleted all ${result.length} products` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// POST /api/admin/products/bulk-update
// Body: { skus?: string[]; filter?: { search?:string; category?:string; zeroPrice?:boolean; inStock?:string }; updates: { ... } }
router.post("/admin/products/bulk-update", async (req, res) => {
  try {
    const { skus, filter, updates } = req.body as {
      skus?: string[];
      filter?: { search?: string; category?: string; zeroPrice?: boolean; inStock?: string };
      updates: {
        price?: number;
        priceAdjustPercent?: number;
        category?: string;
        inStock?: boolean;
        descriptionSet?: string;
        descriptionAppend?: string;
        variantGroupId?: string;
        variantLabel?: string;
      };
    };

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "updates object is required" });
    }

    const hasSkus   = Array.isArray(skus) && skus.length > 0;
    const hasFilter = filter && typeof filter === "object";

    if (!hasSkus && !hasFilter) {
      return res.status(400).json({ error: "Provide either skus[] or a filter object" });
    }
    if (!hasSkus && !hasBulkProductFilterConstraints(filter!)) {
      return res.status(400).json({ error: "Refusing to bulk update without at least one filter constraint" });
    }

    // Build WHERE clause
    let whereClause: any;
    if (hasSkus) {
      whereClause = inArray(productsTable.sku, skus!);
    } else {
      const { ilike: iL, and: aN, or: oR, eq: eQ } = await import("drizzle-orm");
      const conditions: any[] = [];
      if (filter!.search) {
        const s = filter!.search;
        conditions.push(oR(iL(productsTable.name, `%${s}%`), iL(productsTable.sku, `%${s}%`)));
      }
      if (filter!.category) conditions.push(eQ(productsTable.category, filter!.category));
      if (filter!.zeroPrice)  conditions.push(sql`${productsTable.price}::numeric = 0`);
      if (filter!.inStock === "true")  conditions.push(eQ(productsTable.inStock, true));
      if (filter!.inStock === "false") conditions.push(eQ(productsTable.inStock, false));
      whereClause = conditions.length ? aN(...conditions) : sql`1=1`;
    }

    let updated = 0;

    // ── Price percentage adjustment
    if (updates.priceAdjustPercent !== undefined) {
      const pct = Number(updates.priceAdjustPercent);
      if (isNaN(pct)) return res.status(400).json({ error: "Invalid priceAdjustPercent" });
      const multiplier = 1 + pct / 100;
      const rows = await db
        .update(productsTable)
        .set({ price: sql`GREATEST(0, ROUND(${productsTable.price}::numeric * ${multiplier}, 2))` })
        .where(and(whereClause, sql`${productsTable.price}::numeric > 0`))
        .returning({ sku: productsTable.sku });
      updated = rows.length;
    }

    // ── Regular field updates
    const setFields: Record<string, unknown> = {};
    if (updates.price !== undefined) {
      const p = Number(updates.price);
      if (!isNaN(p) && p >= 0) setFields.price = p.toFixed(2);
    }
    if (updates.category       !== undefined) setFields.category       = updates.category;
    if (updates.inStock        !== undefined) setFields.inStock        = Boolean(updates.inStock);
    if (updates.descriptionSet !== undefined) setFields.description    = updates.descriptionSet;
    if (updates.variantGroupId !== undefined) setFields.variantGroupId = updates.variantGroupId;
    if (updates.variantLabel   !== undefined) setFields.variantLabel   = updates.variantLabel;

    if (Object.keys(setFields).length > 0) {
      const rows = await db.update(productsTable).set(setFields).where(whereClause).returning({ sku: productsTable.sku });
      updated = rows.length;
    }

    // ── Append to description
    if (updates.descriptionAppend && !updates.descriptionSet) {
      const rows = await db
        .update(productsTable)
        .set({ description: sql`${productsTable.description} || ${updates.descriptionAppend}` })
        .where(whereClause)
        .returning({ sku: productsTable.sku });
      updated = rows.length;
    }

    res.json({ updated, message: `${updated} product${updated === 1 ? "" : "s"} updated` });
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

// ── Auto-group similar products ─────────────────────────────────────────────
// POST /api/admin/products/auto-group
// Groups window balance products by extracting base names (removing weight/part-number suffixes).
// Also groups exact-name duplicates across all categories.
// Safe to run multiple times — only updates products where variant_group_id IS NULL.
router.post("/admin/products/auto-group", async (req, res) => {
  try {
    // Step 1: Window balances — group by length + balance type
    await db.execute(sql`
      WITH base_names AS (
        SELECT sku, name,
          TRIM(REGEXP_REPLACE(
            REGEXP_REPLACE(name,
              E'\\\\s*(\\\\([^)]+\\\\)|[Ww][/:][^\\\\s].*|[Ww]\\\\d[-/].*|-(?:WHT|BLK|BGE|ALM|WH|BK|wht|bge|CHR|brz)\\\\s*$)',
              '', 'i'),
            E'\\\\s+$', ''
          )) AS base_name
        FROM products
        WHERE category = 'Window Balances'
      ),
      groups_with_count AS (
        SELECT base_name, COUNT(*) AS cnt
        FROM base_names
        GROUP BY base_name
        HAVING COUNT(*) > 1
      )
      UPDATE products p
      SET
        variant_group_id = bn.base_name,
        variant_label = p.name
      FROM base_names bn
      JOIN groups_with_count gwc ON bn.base_name = gwc.base_name
      WHERE p.sku = bn.sku
        AND p.variant_group_id IS NULL
    `);

    // Step 2: Exact-name duplicates across other categories
    await db.execute(sql`
      WITH same_name AS (
        SELECT name, category,
          COUNT(*) OVER (PARTITION BY name, category) AS cnt
        FROM products
        WHERE variant_group_id IS NULL
          AND category != 'Window Balances'
      )
      UPDATE products p
      SET
        variant_group_id = 'dup:' || s.name,
        variant_label = p.sku
      FROM same_name s
      WHERE p.name = s.name
        AND p.category = s.category
        AND s.cnt > 1
        AND p.variant_group_id IS NULL
    `);

    // Stats
    const [stats] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE variant_group_id IS NOT NULL)::int AS grouped_products,
        COUNT(DISTINCT variant_group_id) FILTER (WHERE variant_group_id IS NOT NULL)::int AS unique_groups,
        COUNT(*) FILTER (WHERE variant_group_id IS NULL)::int AS ungrouped_products
      FROM products
    `);

    res.json({ success: true, stats: stats });
  } catch (err: any) {
    req.log?.error({ err }, "Error in auto-group");
    res.status(500).json({ error: err.message });
  }
});

export default router;
