import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

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
router.get("/admin/products", async (_req, res) => {
  try {
    const products = await db
      .select()
      .from(productsTable)
      .orderBy(sql`${productsTable.createdAt} desc`)
      .limit(500);
    res.json({ products });
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
                         "listprice", "saleprice", "suggestedprice", "baseprice", "msrp");
  const rawOrig  = pick("originalprice", "msrp", "listprice", "suggestedretail",
                         "suggestedprice", "regularprice", "baseprice");

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
    category:       pick("category", "producttype", "type", "dept", "department",
                         "productcategory", "group"),
    supplier:       pick("supplier", "vendor", "brand", "manufacturer", "source"),
    inStock:        pick("instock", "stock", "available", "availability", "qty",
                         "quantity", "qtyavailable", "qoh"),
    imageUrl:       pick("imageurl", "image", "imagelink", "photo", "thumbnail", "img"),
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

    let inserted = 0, updated = 0, errored = 0, skipped = 0;
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

        // Price: required. If missing AND this is a new product, skip with error.
        const priceStr = row.price;
        const price = parseFloat(priceStr);
        const priceValid = !isNaN(price) && price > 0;

        // For existing products a missing price just means "don't change price"
        const [existing] = await db
          .select({ sku: productsTable.sku, price: productsTable.price })
          .from(productsTable)
          .where(eq(productsTable.sku, sku))
          .limit(1);

        if (!priceValid && !existing) {
          errored++;
          errors.push(`${rawSku}: no valid price — row skipped`);
          continue;
        }

        const inStockRaw = row.inStock.toLowerCase();
        const inStock = inStockRaw === "" || inStockRaw === "true" || inStockRaw === "1"
          || inStockRaw === "yes" || inStockRaw === "y" || inStockRaw === "in stock";

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
          imageUrl:       row.imageUrl || null,
          tags,
          compatibleBrands,
          specifications,
        };

        if (priceValid) {
          values.price = price.toFixed(2);
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
        }
      } catch (e: any) {
        errored++;
        if (errors.length < 50) errors.push(`${rawSku || "?"}: ${e.message}`);
      }
    }

    res.json({ inserted, updated, errored, skipped, errors });
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

export default router;
