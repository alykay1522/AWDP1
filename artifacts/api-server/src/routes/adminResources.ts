import { Router } from "express";
import { db } from "@workspace/db";
import { pdfResourcesTable } from "@workspace/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

const router = Router();

// ── CSV helpers (mirror adminProducts export/import style) ────────────────────

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str: string;
  if (typeof val === "object") str = JSON.stringify(val);
  else str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** Map flexible CSV headers to canonical keys (same names as export columns). */
function normalizeResourceRow(raw: Record<string, string>): Record<string, string> {
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.toLowerCase().replace(/[\s\-_.]+/g, "");
    lc[key] = typeof v === "string" ? v.trim() : "";
  }
  function pick(...aliases: string[]): string {
    for (const a of aliases) {
      const v = lc[a];
      if (v !== undefined && v !== "") return v;
    }
    return "";
  }
  return {
    id: pick("id", "pk", "resourceid"),
    title: pick("title", "name", "label"),
    brand: pick("brand", "manufacturer", "make"),
    category: pick("category", "group", "section"),
    type: pick("type", "doctype", "documenttype", "resourcetype"),
    url: pick("url", "pdfurl", "link", "href", "path"),
    description: pick("description", "desc", "notes", "summary"),
    sortOrder: pick("sortorder", "sort_order", "order", "position", "seq"),
    isActive: pick("isactive", "active", "visible", "published", "enabled"),
  };
}

function parseBoolCsv(s: string, defaultVal: boolean): boolean {
  const t = s.trim().toLowerCase();
  if (t === "") return defaultVal;
  return t === "true" || t === "1" || t === "yes" || t === "y";
}

function rowIsBlank(norm: Record<string, string>): boolean {
  return !norm.title && !norm.url && !norm.category && !norm.type && !norm.id;
}

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

// GET /api/admin/resources/export — CSV for round-trip bulk import (same columns as import)
router.get("/admin/resources/export", async (_req, res) => {
  try {
    const resources = await db
      .select()
      .from(pdfResourcesTable)
      .orderBy(asc(pdfResourcesTable.sortOrder), asc(pdfResourcesTable.id));

    const COLS = [
      "id", "title", "brand", "category", "type", "url", "description", "sortOrder", "isActive",
    ];

    const rows = resources.map((r) =>
      COLS.map((col) => csvEscape((r as Record<string, unknown>)[col])).join(","),
    );

    const csv = [COLS.join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="awdp-pdf-resources.csv"');
    res.send(csv);
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

// POST /api/admin/resources/import — upsert from client-parsed CSV rows ({ rows })
router.post("/admin/resources/import", async (req, res) => {
  try {
    const { rows } = req.body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No rows provided" });
    }

    const maxRows = Math.min(
      10_000,
      Math.max(1, Number.parseInt(process.env.MAX_RESOURCE_IMPORT_ROWS ?? "500", 10) || 500),
    );
    if (rows.length > maxRows) {
      return res.status(413).json({
        error: `This request has ${rows.length} rows; maximum per request is ${maxRows}. Send smaller batches or raise MAX_RESOURCE_IMPORT_ROWS.`,
      });
    }

    const dataRowNums = rows.map((_, i) => i + 2); // 1-based line in file (header = 1)

    const norms = rows.map((raw) => normalizeResourceRow(raw));
    const idsToCheck = new Set<number>();
    for (const n of norms) {
      if (!n.id) continue;
      const idNum = Number.parseInt(n.id, 10);
      if (!Number.isNaN(idNum) && idNum > 0) idsToCheck.add(idNum);
    }

    let existingIdSet = new Set<number>();
    if (idsToCheck.size > 0) {
      const found = await db
        .select({ id: pdfResourcesTable.id })
        .from(pdfResourcesTable)
        .where(inArray(pdfResourcesTable.id, [...idsToCheck]));
      existingIdSet = new Set(found.map((r) => r.id));
    }

    let inserted = 0;
    let updated = 0;
    let errored = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < norms.length; i++) {
      const norm = norms[i];
      const line = dataRowNums[i];

      if (rowIsBlank(norm)) {
        skipped++;
        continue;
      }

      const title = norm.title.trim();
      const category = norm.category.trim();
      const type = norm.type.trim();
      const url = norm.url.trim();

      if (!title || !category || !type || !url) {
        errored++;
        const miss: string[] = [];
        if (!title) miss.push("title");
        if (!category) miss.push("category");
        if (!type) miss.push("type");
        if (!url) miss.push("url");
        if (errors.length < 100) errors.push(`Line ${line}: missing ${miss.join(", ")}`);
        continue;
      }

      const brand = norm.brand.trim();
      const description = norm.description.trim();
      let sortOrder = Number.parseInt(norm.sortOrder, 10);
      if (Number.isNaN(sortOrder)) sortOrder = 0;
      const isActive = parseBoolCsv(norm.isActive, true);

      const idRaw = norm.id.trim();
      const idNum = idRaw ? Number.parseInt(idRaw, 10) : NaN;
      const updateById = !Number.isNaN(idNum) && idNum > 0 && existingIdSet.has(idNum);

      try {
        if (updateById) {
          await db
            .update(pdfResourcesTable)
            .set({
              title,
              brand,
              category,
              type,
              url,
              description,
              sortOrder,
              isActive,
            })
            .where(eq(pdfResourcesTable.id, idNum));
          updated++;
        } else {
          await db.insert(pdfResourcesTable).values({
            title,
            brand,
            category,
            type,
            url,
            description,
            sortOrder,
            isActive,
          });
          inserted++;
        }
      } catch (e: any) {
        errored++;
        if (errors.length < 100) errors.push(`Line ${line}: ${e?.message ?? String(e)}`);
      }
    }

    res.json({
      message: "Import complete",
      rowsProcessed: rows.length,
      inserted,
      updated,
      errored,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
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
