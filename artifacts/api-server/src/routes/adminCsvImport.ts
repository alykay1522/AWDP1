import { Router } from "express";
import multer from "multer";
import * as os from "os";
import * as fs from "fs";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { ilike, sql } from "drizzle-orm";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `awdp-csv-${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

const router = Router();

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

    // Load all products from DB (name + sku + description) for matching
    const allProducts = await db
      .select({ sku: productsTable.sku, name: productsTable.name, description: productsTable.description })
      .from(productsTable);

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

    // Apply mode — update products
    let updated = 0;
    let skipped = 0;

    for (const match of results) {
      if (!match.willUpdateDescription || !match.matchedSku) {
        skipped++;
        continue;
      }

      await db
        .update(productsTable)
        .set({ description: match.newDescription })
        .where(sql`${productsTable.sku} = ${match.matchedSku}`);

      updated++;
    }

    return res.json({
      mode: "apply",
      totalRows: rows.length,
      updated,
      skipped,
    });
  } catch (err: any) {
    console.error("[csv-import]", err);
    return res.status(500).json({ error: err.message ?? "Import failed" });
  }
});

export default router;
