#!/usr/bin/env node
/**
 * API-based product import
 * Uses admin API endpoints to import products
 */

import fs from "node:fs";
import path from "path";

const API_BASE = "http://127.0.0.1:3000";
const ADMIN_PASSWORD = "admin123";  // Using simple password for demo
const CSV_FILE = process.argv[2] || "scrapers/awdp_output/allbrand_simple_sku_import_20260523_235747.csv";

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
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = splitLine(l);
    const row = {};
    headers.forEach((h, i) => row[h] = vals[i] ?? "");
    return row;
  });
}

function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie?.length) return "";
  return setCookie.map(c => c.split(";")[0]).join("; ");
}

async function main() {
  console.log("Starting API-based product import...");
  console.log(`CSV file: ${CSV_FILE}`);
  console.log(`API: ${API_BASE}`);
  
  if (!fs.existsSync(CSV_FILE)) {
    console.error("CSV file not found:", CSV_FILE);
    process.exit(1);
  }
  
  const text = fs.readFileSync(CSV_FILE, "utf8");
  const rows = parseCsv(text);
  
  console.log(`Found ${rows.length} products in CSV`);
  
  // Login to get session cookie
  console.log("Logging in to admin API...");
  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  
  if (!loginRes.ok) {
    const j = await loginRes.json().catch(() => ({}));
    console.error("Login failed:", j.error ?? loginRes.status);
    process.exit(1);
  }
  
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookie = cookieHeaderFromSetCookie(setCookie);
  if (!cookie) {
    console.error("No session cookie from login");
    process.exit(1);
  }
  
  console.log("Login successful");
  
  // Import in chunks
  const CHUNK_SIZE = 100;
  const nChunks = Math.ceil(rows.length / CHUNK_SIZE);
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrored = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < nChunks; i++) {
    const slice = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    console.log(`Processing chunk ${i + 1}/${nChunks} (${slice.length} rows)...`);
    
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
      console.error(`Chunk ${i + 1}/${nChunks} failed (${res.status}):`, body.error ?? body);
      totalErrored += slice.length;
    } else {
      totalInserted += body.inserted ?? 0;
      totalUpdated += body.updated ?? 0;
      totalSkipped += body.skipped ?? 0;
      totalErrored += body.errored ?? 0;
      console.log(`  Inserted: ${body.inserted ?? 0}, Updated: ${body.updated ?? 0}, Skipped: ${body.skipped ?? 0}, Errored: ${body.errored ?? 0}`);
    }
  }
  
  console.log("\nImport completed:");
  console.log(`  Total Inserted: ${totalInserted}`);
  console.log(`  Total Updated: ${totalUpdated}`);
  console.log(`  Total Skipped: ${totalSkipped}`);
  console.log(`  Total Errored: ${totalErrored}`);
  
  process.exit(0);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});