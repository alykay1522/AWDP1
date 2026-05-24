#!/usr/bin/env node
/**
 * Simple product import script
 * Directly imports CSV data to database
 */

import fs from "node:fs";
import path from "path";
import { db } from "../artifacts/api-server/node_modules/@workspace/db";
import { productsTable } from "../artifacts/api-server/node_modules/@workspace/db/schema";

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

async function main() {
  console.log("Starting simple product import...");
  console.log(`CSV file: ${CSV_FILE}`);
  
  if (!fs.existsSync(CSV_FILE)) {
    console.error("CSV file not found:", CSV_FILE);
    process.exit(1);
  }
  
  const text = fs.readFileSync(CSV_FILE, "utf8");
  const rows = parseCsv(text);
  
  console.log(`Found ${rows.length} products in CSV`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      // Check if product already exists
      const [existing] = await db
        .select({ sku: productsTable.sku })
        .from(productsTable)
        .where((productsTable) => productsTable.sku === row.sku)
        .limit(1);
      
      if (existing) {
        console.log(`Skipping existing SKU: ${row.sku}`);
        skipped++;
        continue;
      }
      
      // Insert new product
      await db.insert(productsTable).values({
        sku: row.sku,
        name: row.name,
        description: row.description || "",
        price: row.price ? parseFloat(row.price) : 0,
        originalPrice: row.originalPrice ? parseFloat(row.originalPrice) : null,
        category: row.category || "Window Hardware",
        supplier: row.supplier || "All Window Door Parts",
        inStock: row.inStock === "true" || row.inStock === "1",
        imageUrl: row.imageUrl || null,
        tags: row.tags ? row.tags.split(",").map(t => t.trim()) : [],
        compatibleBrands: row.compatibleBrands ? row.compatibleBrands.split(",").map(b => b.trim()) : [],
        specifications: row.specifications ? JSON.parse(row.specifications) : {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      imported++;
      console.log(`Imported: ${row.sku} - ${row.name}`);
      
    } catch (error) {
      console.error(`Error importing ${row.sku}:`, error.message);
      errors++;
    }
  }
  
  console.log("\nImport completed:");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  
  process.exit(0);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});