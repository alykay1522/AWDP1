#!/usr/bin/env node
/**
 * Chunked POST to POST /api/admin/products/import (same body shape as the admin UI).
 *
 * Usage (from repo root, API running on PORT):
 *   set ADMIN_PASSWORD=...
 *   node artifacts/api-server/scripts/bulk-product-import.mjs path/to/products.csv
 *
 * Env:
 *   API_BASE       — default http://127.0.0.1:3000
 *   ADMIN_PASSWORD — required
 *   CHUNK_SIZE     — default 400 (must be <= MAX_PRODUCT_IMPORT_ROWS on server)
 */
import fs from "node:fs";
import path from "node:path";

const API_BASE = (process.env.API_BASE ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const CHUNK = Math.max(1, Number.parseInt(process.env.CHUNK_SIZE ?? "400", 10) || 400);
const password = process.env.ADMIN_PASSWORD;

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];
  function splitLine(line) {
    const fields = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') inQuote = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") {
          fields.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }
  const headers = splitLine(lines[0]);
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const vals = splitLine(l);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = vals[i] ?? "";
      });
      return row;
    });
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie?.length) return "";
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const file = process.argv[2];
  if (!file || !password) {
    console.error(
      "Usage: ADMIN_PASSWORD=... node artifacts/api-server/scripts/bulk-product-import.mjs <file.csv>\n" +
        "Optional: API_BASE=http://127.0.0.1:3000 CHUNK_SIZE=400",
    );
    process.exit(1);
  }

  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(text);
  if (rows.length === 0) {
    console.error("No data rows in CSV.");
    process.exit(1);
  }

  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!loginRes.ok) {
    const j = await loginRes.json().catch(() => ({}));
    console.error("Login failed:", j.error ?? loginRes.status);
    process.exit(1);
  }

  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookie = cookieHeaderFromSetCookie(setCookie);
  if (!cookie) {
    console.error("No Set-Cookie from login — session not established.");
    process.exit(1);
  }

  const totals = { inserted: 0, updated: 0, errored: 0, skipped: 0, needsPricing: 0 };
  const nChunks = Math.ceil(rows.length / CHUNK);

  for (let i = 0; i < nChunks; i++) {
    const slice = rows.slice(i * CHUNK, (i + 1) * CHUNK);
    const res = await fetch(`${API_BASE}/api/admin/products/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ rows: slice }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Batch ${i + 1}/${nChunks} failed (${res.status}):`, body.error ?? body);
      process.exit(1);
    }
    totals.inserted += body.inserted ?? 0;
    totals.updated += body.updated ?? 0;
    totals.errored += body.errored ?? 0;
    totals.skipped += body.skipped ?? 0;
    totals.needsPricing += body.needsPricing ?? 0;
    console.log(`Batch ${i + 1}/${nChunks} OK —`, body);
  }

  console.log("Done.", totals);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
