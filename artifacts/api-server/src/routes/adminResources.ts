import { Router } from "express";
import { db } from "@workspace/db";
import { pdfResourcesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";

const router = Router();

// GET /api/resources — public, returns active resources sorted by category + sortOrder
router.get("/resources", async (_req, res) => {
  try {
    const resources = await db
      .select()
      .from(pdfResourcesTable)
      .where(eq(pdfResourcesTable.isActive, true))
      .orderBy(asc(pdfResourcesTable.sortOrder), asc(pdfResourcesTable.id));
    res.json({ resources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/resources — admin, all resources including inactive
router.get("/admin/resources", async (_req, res) => {
  try {
    const resources = await db
      .select()
      .from(pdfResourcesTable)
      .orderBy(asc(pdfResourcesTable.sortOrder), asc(pdfResourcesTable.id));
    res.json({ resources });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/resources — create
router.post("/admin/resources", async (req, res) => {
  try {
    const { title, brand, category, type, url, description, sortOrder, isActive } = req.body as {
      title: string; brand?: string; category: string; type: string;
      url: string; description?: string; sortOrder?: number; isActive?: boolean;
    };
    if (!title || !category || !type || !url) {
      return res.status(400).json({ error: "title, category, type, and url are required" });
    }
    const [resource] = await db
      .insert(pdfResourcesTable)
      .values({
        title, brand: brand ?? "", category, type, url,
        description: description ?? "",
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
      })
      .returning();
    res.status(201).json({ resource });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/resources/:id — update
router.patch("/admin/resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, brand, category, type, url, description, sortOrder, isActive } = req.body as Partial<{
      title: string; brand: string; category: string; type: string;
      url: string; description: string; sortOrder: number; isActive: boolean;
    }>;
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (brand !== undefined) updates.brand = brand;
    if (category !== undefined) updates.category = category;
    if (type !== undefined) updates.type = type;
    if (url !== undefined) updates.url = url;
    if (description !== undefined) updates.description = description;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;

    const [resource] = await db
      .update(pdfResourcesTable)
      .set(updates)
      .where(eq(pdfResourcesTable.id, id))
      .returning();
    if (!resource) return res.status(404).json({ error: "Resource not found" });
    res.json({ resource });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/resources/:id
router.delete("/admin/resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(pdfResourcesTable)
      .where(eq(pdfResourcesTable.id, id))
      .returning({ id: pdfResourcesTable.id });
    if (!deleted) return res.status(404).json({ error: "Resource not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
