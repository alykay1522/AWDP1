import { Router } from "express";
import { db } from "@workspace/db";
import { siteSettingsTable, categoriesTable, partsIdRequestsTable, contactSubmissionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

const DEFAULT_SETTINGS: Record<string, string> = {
  businessName: "All Window Door Parts",
  phone: "785-533-0244",
  email: "Info@allwindowdoorparts.com",
  address: "",
  orderMinimum: "50",
  bannerEnabled: "false",
  bannerText: "",
  metaDescription: "All Window Door Parts — veteran-owned supplier with 40+ years experience. Shop 454 window and door parts.",
  freeShippingThreshold: "0",
  taxRate: "0",
};

// GET /api/admin/settings
router.get("/admin/settings", async (_req, res) => {
  try {
    const rows = await db.select().from(siteSettingsTable);
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/settings  — upsert multiple key-value pairs
router.put("/admin/settings", async (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must be a key-value object" });
    }

    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }

    const rows = await db.select().from(siteSettingsTable);
    const settings: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) settings[row.key] = row.value;

    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Categories ────────────────────────────────────────────────────────────────

// GET /api/admin/categories
router.get("/admin/categories", async (_req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/categories
router.post("/admin/categories", async (req, res) => {
  try {
    const { name, slug, description, imageUrl } = req.body as {
      name: string; slug: string; description?: string; imageUrl?: string;
    };
    if (!name || !slug) return res.status(400).json({ error: "name and slug are required" });

    const [cat] = await db
      .insert(categoriesTable)
      .values({ name, slug, description: description ?? "", imageUrl: imageUrl ?? null })
      .returning();
    res.status(201).json({ category: cat });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "A category with that slug already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/categories/:id
router.patch("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, slug, description, imageUrl } = req.body as Partial<{
      name: string; slug: string; description: string; imageUrl: string;
    }>;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (slug !== undefined) updates.slug = slug;
    if (description !== undefined) updates.description = description;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;

    const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, id)).returning();
    if (!cat) return res.status(404).json({ error: "Category not found" });
    res.json({ category: cat });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/categories/:id
router.delete("/admin/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning({ id: categoriesTable.id });
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Parts ID Requests ──────────────────────────────────────────────────────────

router.get("/admin/parts-id", async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(partsIdRequestsTable)
      .orderBy(desc(partsIdRequestsTable.createdAt));
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/admin/parts-id/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };
    const [updated] = await db
      .update(partsIdRequestsTable)
      .set({ status })
      .where(eq(partsIdRequestsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Request not found" });
    res.json({ request: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Contact Submissions ────────────────────────────────────────────────────────

router.get("/admin/contacts", async (_req, res) => {
  try {
    const submissions = await db
      .select()
      .from(contactSubmissionsTable)
      .orderBy(desc(contactSubmissionsTable.createdAt));
    res.json({ submissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
