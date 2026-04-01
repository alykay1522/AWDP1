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

    // Store original supplier part number in specifications
    const specifications = {
      ...data.specifications,
      "Supplier Part No.": data.originalSku,
    };

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
        specifications,
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
