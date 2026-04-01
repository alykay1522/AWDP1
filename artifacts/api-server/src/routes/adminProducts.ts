import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// PROFITABLE cipher: P=1 R=2 O=3 F=4 I=5 T=6 A=7 B=8 L=9 E=0
const DIGIT_TO_LETTER: Record<string, string> = {
  "0": "E", "1": "P", "2": "R", "3": "O", "4": "F",
  "5": "I", "6": "T", "7": "A", "8": "B", "9": "L",
};

function encodeNumber(n: number, padLen: number): string {
  return n
    .toString()
    .padStart(padLen, "0")
    .split("")
    .map((d) => DIGIT_TO_LETTER[d] ?? "E")
    .join("");
}

async function generateSku(categoryIndex: number): Promise<string> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(productsTable);

  const seq = Number(total) + 1;
  const catPart = encodeNumber(categoryIndex, 2);
  const seqPart = encodeNumber(seq, 4);
  const candidate = `AWDP-${catPart}-${seqPart}`;

  // Ensure uniqueness — if collision, increment until free
  const [existing] = await db
    .select({ sku: productsTable.sku })
    .from(productsTable)
    .where(eq(productsTable.sku, candidate))
    .limit(1);

  if (!existing) return candidate;

  // Fallback: use seq + salt
  const altSeq = seq + 1000 + Math.floor(Math.random() * 99);
  return `AWDP-${catPart}-${encodeNumber(altSeq, 4)}`;
}

const CreateProductSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().default(""),
  price: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  category: z.string().min(1),
  categoryIndex: z.number().int().min(0).max(99),
  supplier: z.string().default(""),
  inStock: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  compatibleBrands: z.array(z.string()).default([]),
  specifications: z.record(z.string()).default({}),
  imageUrl: z.string().url().optional(),
});

// GET /api/admin/products/preview-sku — preview a SKU before creating
router.get("/admin/products/preview-sku", async (req, res) => {
  try {
    const categoryIndex = Number(req.query.categoryIndex ?? 0);
    const sku = await generateSku(categoryIndex);
    res.json({ sku });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/products — list all products (admin, all fields)
router.get("/admin/products", async (req, res) => {
  try {
    const products = await db
      .select()
      .from(productsTable)
      .orderBy(sql`${productsTable.createdAt} desc`)
      .limit(200);
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
    const sku = await generateSku(data.categoryIndex);

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
      return res.status(409).json({ error: "A product with this SKU already exists. Please try again." });
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
