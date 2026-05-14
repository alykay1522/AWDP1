import { Router } from "express";
import multer from "multer";
import * as os from "os";
import * as fs from "fs";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `awdp-csv-${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const router = Router();

type DescriptionColumn = "description" | "long_description";

function pgErrorCode(err: unknown): string | undefined {
  let cur: unknown = err;
  for (let d = 0; d < 6 && cur; d++) {
    const c = cur as { code?: string; cause?: unknown };
    if (typeof c.code === "string" && c.code.length > 0) return c.code;
    cur = c.cause;
  }
  return undefined;
}

function csvImportDbMessage(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  const code = pgErrorCode(err);
  if (code === "42P01") {
    return `${base} — The products table was not found. Run: DATABASE_URL="…" pnpm --filter @workspace/db run push`;
  }
  if (code === "42703") {
    return `${base} — A column on products does not match the app schema (expected description, or legacy long_description). Run drizzle push against this DATABASE_URL or inspect the table.`;
  }
  return base;
}

async function productsTableExists(): Promise<boolean> {
  const r = await db.execute(sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = current_schema() and table_name = 'products'
    limit 1
  `);
  return (r.rows as { ok?: number }[]).length > 0;
}

/** Prefer description; fall back to legacy long_description if present. */
async function resolveDescriptionColumn(): Promise<DescriptionColumn> {
  const r = await db.execute(sql`
    select column_name::text as column_name
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'products'
      and column_name in ('description', 'long_description')
    order by case column_name
      when 'description' then 0
      when 'long_description' then 1
      else 2
    end
    limit 1
  `);
  const row = (r.rows as { column_name?: string }[])[0];
  const name = row?.column_name;
  if (name === "description" || name === "long_description") {
    return name;
  }
  throw new Error(
    "Schema mismatch: products has neither description nor long_description. Align the database with lib/db/src/schema/products.ts (pnpm --filter @workspace/db run push).",
  );
}

async function loadProductsForMatching(
  descCol: DescriptionColumn,
): Promise<Array<{ sku: string; name: string; description: string | null }>> {
  if (descCol === "description") {
    return db
      .select({ sku: productsTable.sku, name: productsTable.name, description: productsTable.description })
      .from(productsTable);
  }
  const r = await db.execute(sql`
    select sku, name, long_description as description
    from products
  `);
  return r.rows as Array<{ sku: string; name: string; description: string | null }>;
}

/* ── Simple CSV parser (no extra dep) ─────────────────────────────────── */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  const headers = splitRow(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

/* ── Title-based matching ──────────────────────────────────────────────── */
function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function extractKeywords(title: string): string[] {
  const stop = new Set(["the", "a", "an", "and", "or", "for", "of", "in", "with", "window", "door"]);
  return normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 3 && !stop.has(w));
}

function scoreMatch(csvTitle: string, productName: string): number {
  const csvWords = new Set(extractKeywords(csvTitle));
  const prodWords = new Set(extractKeywords(productName));
  if (csvWords.size === 0) return 0;
  let hits = 0;
  csvWords.forEach((w) => { if (prodWords.has(w)) hits++; });
  return hits / Math.max(csvWords.size, prodWords.size);
}

interface CsvRow {
  product_title?: string;
  source_site?: string;
  product_url?: string;
  description_clean?: string;
  min_order_qty?: string;
  sold_in_pairs?: string;
  sold_in_packs?: string;
  min_lineal_feet?: string;
  unit_type?: string;
  notes_raw_rules?: string;
  [key: string]: string | undefined;
}

interface MatchResult {
  rowIndex: number;
  csvTitle: string;
  csvDescription: string;
  csvNotes: string;
  matchedSku: string | null;
  matchedName: string | null;
  matchScore: number;
  currentDescription: string | null;
  isGenericCurrent: boolean;
  willUpdateDescription: boolean;
  newDescription: string;
  orderingNotes: string;
}

function buildOrderingNotes(row: CsvRow): string {
  const parts: string[] = [];
  if (row.min_lineal_feet) parts.push(`Minimum ${row.min_lineal_feet} lineal feet`);
  if (row.min_order_qty) parts.push(`Minimum order: ${row.min_order_qty}`);
  if (row.sold_in_pairs === "yes") parts.push("Sold in pairs");
  if (row.sold_in_packs) parts.push(`Sold in ${row.sold_in_packs.replace("_", " ")}`);
  if (row.unit_type && row.unit_type !== "each") parts.push(`Unit: ${row.unit_type}`);
  if (row.notes_raw_rules) parts.push(row.notes_raw_rules);
  return parts.join(" · ");
}

function isGenericDescription(desc: string | null | undefined): boolean {
  if (!desc || desc.trim().length < 20) return true;
  const d = desc.toLowerCase();
  return d.includes("email us photos") || d.includes("email us a photo");
}

async function buildMatchResults(rows: CsvRow[], allProducts: Array<{ sku: string; name: string; description: string | null }>): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const csvTitle = (row.product_title ?? "").trim();
    if (!csvTitle) continue;

    // Find best matching product
    let bestSku: string | null = null;
    let bestName: string | null = null;
    let bestScore = 0;
    let bestDesc: string | null = null;

    for (const p of allProducts) {
      const score = scoreMatch(csvTitle, p.name);
      if (score > bestScore) {
        bestScore = score;
        bestSku = p.sku;
        bestName = p.name;
        bestDesc = p.description;
      }
    }

    // Only accept matches with score >= 0.35
    const matched = bestScore >= 0.35;

    const csvDesc = (row.description_clean ?? "").trim();
    const orderingNotes = buildOrderingNotes(row);

    // Build the new description to apply
    const genericCurrent = isGenericDescription(bestDesc);
    const newDesc = csvDesc && csvDesc.length > 30
      ? csvDesc + (orderingNotes ? `\n\n${orderingNotes}` : "")
      : (orderingNotes || "");

    const willUpdate = matched && !!newDesc && (genericCurrent || !bestDesc);

    results.push({
      rowIndex: i,
      csvTitle,
      csvDescription: csvDesc.slice(0, 200),
      csvNotes: orderingNotes,
      matchedSku: matched ? bestSku : null,
      matchedName: matched ? bestName : null,
      matchScore: matched ? Math.round(bestScore * 100) : 0,
      currentDescription: matched ? (bestDesc ?? null) : null,
      isGenericCurrent: matched ? genericCurrent : false,
      willUpdateDescription: willUpdate,
      newDescription: willUpdate ? newDesc.slice(0, 300) : "",
      orderingNotes,
    });
  }

  return results;
}

/* ── POST /api/admin/csv-import ──────────────────────────────────────── */
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const mode = (req.query.mode as string) ?? "preview"; // "preview" | "apply"

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvText = fs.readFileSync(req.file.path, "utf-8");
    fs.unlinkSync(req.file.path); // clean up temp file

    const rows = parseCsv(csvText) as CsvRow[];
    if (rows.length === 0) {
      return res.status(400).json({ error: "CSV appears empty or malformed" });
    }

    if (!(await productsTableExists())) {
      return res.status(500).json({
        error:
          'The database has no "products" table in the current schema. Run: DATABASE_URL="…" pnpm --filter @workspace/db run push',
      });
    }

    const descCol = await resolveDescriptionColumn();
    const allProducts = await loadProductsForMatching(descCol);

    if (allProducts.length === 0) {
      return res.status(400).json({
        error:
          "Product catalog is empty (0 rows in products). Import or seed products before running this description CSV import.",
      });
    }

    const results = await buildMatchResults(rows, allProducts);

    if (mode === "preview") {
      return res.json({
        mode: "preview",
        totalRows: rows.length,
        matched: results.filter((r) => r.matchedSku).length,
        willUpdate: results.filter((r) => r.willUpdateDescription).length,
        skipped: results.filter((r) => !r.matchedSku).length,
        results: results.slice(0, 200), // cap preview at 200 rows
      });
    }

    // Apply mode — batched parallel updates (same semantics as sequential; faster on large CSVs)
    const pending = results.filter((m) => m.willUpdateDescription && m.matchedSku);
    const skipped = results.length - pending.length;
    const CONCURRENCY = 32;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const slice = pending.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map((m) =>
          descCol === "description"
            ? db
                .update(productsTable)
                .set({ description: m.newDescription })
                .where(eq(productsTable.sku, m.matchedSku!))
            : db.execute(sql`
                update products
                set long_description = ${m.newDescription}
                where sku = ${m.matchedSku!}
              `),
        ),
      );
    }

    return res.json({
      mode: "apply",
      totalRows: rows.length,
      updated: pending.length,
      skipped,
    });
  } catch (err: unknown) {
    console.error("[csv-import]", err);
    return res.status(500).json({ error: csvImportDbMessage(err) || "Import failed" });
  }
});

export default router;
