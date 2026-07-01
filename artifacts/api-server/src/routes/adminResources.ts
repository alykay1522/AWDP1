import { Router } from "express";
import { db } from "@workspace/db";
import { pdfResourcesTable, type PdfResource } from "@workspace/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { recoveredPdfResources } from "../data/recoveredPdfResources";
import {
  getSafeResourceRedirectUrl,
  parsePublicResourceId,
} from "../lib/resourceRedirect";

const router = Router();

function mergeWithRecovered(resources: PdfResource[]): PdfResource[] {
  const seenUrls = new Set(resources.map((resource) => resource.url));
  const recovered = recoveredPdfResources.filter((resource) => !seenUrls.has(resource.url));
  return [...resources, ...recovered];
}

function toPublicResource(resource: PdfResource): PdfResource {
  return {
    ...resource,
    url: `/api/resources/${encodeURIComponent(String(resource.id))}/open`,
  };
}

function validateMutableResourceId(id: number) {
  if (!Number.isInteger(id)) return "Invalid resource id";
  if (id < 0) return "Recovered archive resources are read-only";
  return null;
}

// GET /api/resources — public, returns active database and recovered resources.
// The public URL remains same-origin so analytics does not run its delegated
// outbound-link handler during the user's click interaction.
router.get("/resources", async (_req, res) => {
  try {
    const resources = await db
      .select()
      .from(pdfResourcesTable)
      .where(eq(pdfResourcesTable.isActive, true))
      .orderBy(asc(pdfResourcesTable.sortOrder), asc(pdfResourcesTable.id));

    res.json({ resources: mergeWithRecovered(resources).map(toPublicResource) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/resources/:id/open — same-origin link target for resource cards.
// The destination is resolved exclusively from active stored resources, so this
// cannot be used as an arbitrary open redirect.
router.get("/resources/:id/open", async (req, res) => {
  try {
    const id = parsePublicResourceId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Invalid resource id" });
    }

    let resourceUrl: string | null = null;

    if (id < 0) {
      const recovered = recoveredPdfResources.find(
        (resource) => resource.id === id && resource.isActive !== false,
      );
      resourceUrl = recovered?.url ?? null;
    } else {
      const [resource] = await db
        .select({ url: pdfResourcesTable.url })
        .from(pdfResourcesTable)
        .where(
          and(
            eq(pdfResourcesTable.id, id),
            eq(pdfResourcesTable.isActive, true),
          ),
        )
        .limit(1);
      resourceUrl = resource?.url ?? null;
    }

    const redirectUrl = getSafeResourceRedirectUrl(resourceUrl);
    if (!redirectUrl) {
      return res.status(404).json({ error: "Resource not found" });
    }

    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.redirect(302, redirectUrl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/resources — admin, all database resources plus read-only recovered PDFs.
router.get("/admin/resources", async (_req, res) => {
  try {
    const resources = await db
      .select()
      .from(pdfResourcesTable)
      .orderBy(asc(pdfResourcesTable.sortOrder), asc(pdfResourcesTable.id));

    res.json({ resources: mergeWithRecovered(resources) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/resources — create a normal editable database resource.
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

// PATCH /api/admin/resources/:id — update database-backed resources only.
router.patch("/admin/resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const invalidId = validateMutableResourceId(id);
    if (invalidId) return res.status(400).json({ error: invalidId });

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

// DELETE /api/admin/resources/:id — database-backed resources only.
router.delete("/admin/resources/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const invalidId = validateMutableResourceId(id);
    if (invalidId) return res.status(400).json({ error: invalidId });

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
