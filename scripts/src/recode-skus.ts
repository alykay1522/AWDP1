/**
 * Re-encode all product SKUs to AWDP-XX-XXXX format using the encoding:
 * P=1, R=2, O=3, F=4, I=5, T=6, A=7, B=8, L=9, E=0
 * 
 * Takes the numeric portion of each original SKU, pads to 6 digits,
 * encodes each digit as a letter, and formats as AWDP-XX-XXXX.
 */

import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const DIGIT_TO_CHAR: Record<string, string> = {
  "0": "E",
  "1": "P",
  "2": "R",
  "3": "O",
  "4": "F",
  "5": "I",
  "6": "T",
  "7": "A",
  "8": "B",
  "9": "L",
};

function encodeDigits(digits: string): string {
  return digits.split("").map((d) => DIGIT_TO_CHAR[d] ?? "E").join("");
}

/**
 * Given an original SKU string, extract numeric digits,
 * pad to 6 digits, and encode as AWDP-XX-XXXX.
 */
function buildAwdpSku(rawSku: string, suffix = ""): string {
  // Extract only numeric characters
  const digits = rawSku.replace(/[^0-9]/g, "");

  // If no digits at all, use a hash of the string
  const numStr = digits.length > 0
    ? digits.slice(-6).padStart(6, "0")  // take last 6 digits, pad from left
    : String(hashCode(rawSku) % 1000000).padStart(6, "0");

  const encoded = encodeDigits(numStr);
  const base = `AWDP-${encoded.slice(0, 2)}-${encoded.slice(2, 6)}`;
  return suffix ? `${base}${suffix}` : base;
}

function hashCode(str: string): number {
  let hash = 0;
  for (const c of str) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

async function main() {
  console.log("Fetching all products...");
  const products = await db.select().from(productsTable).orderBy(productsTable.id);
  console.log(`Found ${products.length} products.\n`);

  // Track generated SKUs to detect collisions
  const usedSkus = new Map<string, number>(); // encoded SKU → product id

  const updates: Array<{ id: number; oldSku: string; newSku: string }> = [];

  for (const p of products) {
    const specs = (p.specifications ?? {}) as Record<string, string>;

    // Determine the numeric source for encoding:
    // - Alcosupply products (ALCO- prefix): use specs["Original SKU"] (their part number like "1531")
    // - Existing AWDP products (AWDP-NNNNN): strip the AWDP- prefix to get the wp product ID number
    // - Already-encoded AWDP products (AWDP-XX-XXXX): already done, re-derive from same source
    let sourceNum: string;
    if (p.sku.startsWith("ALCO-")) {
      // Use the original part number (e.g. "1531", "422CSTR")
      sourceNum = specs["Original SKU"] || p.sku.replace("ALCO-", "");
    } else {
      // AWDP-{number} — use the numeric part directly
      sourceNum = p.sku.replace(/^AWDP-/, "").replace(/-/g, "");
    }

    let newSku = buildAwdpSku(sourceNum);

    // Handle collisions — add alphabetic suffix A, B, C...
    let suffixIdx = 0;
    while (usedSkus.has(newSku) && usedSkus.get(newSku) !== p.id) {
      suffixIdx++;
      const suffix = String.fromCharCode(64 + suffixIdx); // A, B, C...
      newSku = buildAwdpSku(sourceNum, suffix);
    }

    usedSkus.set(newSku, p.id);
    updates.push({ id: p.id, oldSku: p.sku, newSku });
  }

  // Apply updates — rename to avoid unique constraint violations
  // First pass: rename to temp SKUs
  console.log("Pass 1: Renaming to temp SKUs to avoid constraint conflicts...");
  for (const u of updates) {
    await db.update(productsTable)
      .set({ sku: `__TEMP_${u.id}__` })
      .where(eq(productsTable.id, u.id));
  }

  // Second pass: apply new SKUs and store old one in specs
  console.log("Pass 2: Applying AWDP-encoded SKUs...");
  let changed = 0;
  let unchanged = 0;
  for (const u of updates) {
    const product = products.find((p) => p.id === u.id)!;
    const specs = { ...((product.specifications ?? {}) as Record<string, string>) };

    // Preserve the old SKU if not already stored
    if (!specs["ALCO SKU"] && u.oldSku.startsWith("ALCO-")) {
      specs["ALCO SKU"] = u.oldSku;
    }
    if (!specs["Previous SKU"] && u.oldSku !== u.newSku) {
      specs["Previous SKU"] = u.oldSku;
    }

    await db.update(productsTable)
      .set({ sku: u.newSku, specifications: specs })
      .where(eq(productsTable.id, u.id));

    if (u.oldSku !== u.newSku) {
      console.log(`  [UPDATED] ${u.oldSku.padEnd(20)} → ${u.newSku}`);
      changed++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nDone. ${changed} SKUs updated, ${unchanged} already correct.`);

  // Spot-check a few
  console.log("\nSample AWDP-encoded SKUs:");
  const sample = await db.select({ sku: productsTable.sku, name: productsTable.name })
    .from(productsTable)
    .limit(5);
  sample.forEach((r) => console.log(`  ${r.sku}  ${r.name}`));
}

main().catch(console.error);
