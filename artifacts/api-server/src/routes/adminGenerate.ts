import { Router, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { isNull, or, eq, sql } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

function getOpenAI(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) throw new Error("OpenAI integration not configured");
  return new OpenAI({ baseURL, apiKey });
}

function getBucketId(): string {
  const id = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!id) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return id;
}

function sseWrite(res: Response, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function buildImagePrompt(productName: string): string {
  return `Professional product photograph of "${productName}", window and door hardware component, isolated on pure white background, sharp focus, studio lighting, no text, no watermarks, commercial catalog photo`;
}

// ── POST /api/admin/products/generate-images ────────────────────────────────
// SSE stream: generates AI images for products without images
router.post("/admin/products/generate-images", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const openai = getOpenAI();
    const bucketId = getBucketId();

    const products = await db
      .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
      .from(productsTable)
      .where(isNull(productsTable.imageUrl))
      .orderBy(productsTable.id)
      .limit(limit);

    sseWrite(res, { type: "start", total: products.length });

    let uploaded = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const prompt = buildImagePrompt(product.name);

        const response = await openai.images.generate({
          model: "gpt-image-1",
          prompt,
          n: 1,
          size: "1024x1024",
        });

        const b64 = (response.data?.[0] as any)?.b64_json;
        if (!b64) throw new Error("No image data returned");

        const buffer = Buffer.from(b64, "base64");
        const slug = product.sku.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
        const objectName = `product-images/${Date.now()}-${slug}.png`;

        const bucket = objectStorageClient.bucket(bucketId);
        const file = bucket.file(objectName);

        await new Promise<void>((resolve, reject) => {
          const stream = file.createWriteStream({
            metadata: { contentType: "image/png" },
            resumable: false,
          });
          stream.on("error", reject);
          stream.on("finish", resolve);
          stream.end(buffer);
        });

        const imageUrl = `/api/admin/images/serve/${objectName}`;

        await db
          .update(productsTable)
          .set({ imageUrl })
          .where(eq(productsTable.id, product.id));

        uploaded++;
        sseWrite(res, { type: "progress", sku: product.sku, name: product.name, uploaded, failed, total: products.length, status: "ok" });
      } catch (err: any) {
        failed++;
        sseWrite(res, { type: "progress", sku: product.sku, name: product.name, uploaded, failed, total: products.length, status: "error", error: err.message });
      }

      // Small delay to avoid hammering the API
      await new Promise((r) => setTimeout(r, 200));
    }

    sseWrite(res, { type: "done", uploaded, failed, total: products.length });
  } catch (err: any) {
    sseWrite(res, { type: "error", error: err.message });
  }

  res.end();
});

// ── POST /api/admin/products/generate-prices ────────────────────────────────
// SSE stream: estimates prices for products with price = 0
router.post("/admin/products/generate-prices", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const batchSize = 20;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const openai = getOpenAI();

    // Exclude obvious non-product entries (scraped info pages, PDFs)
    const products = await db
      .select({ id: productsTable.id, sku: productsTable.sku, name: productsTable.name })
      .from(productsTable)
      .where(
        sql`(${productsTable.price} IS NULL OR ${productsTable.price} = '0')
          AND length(${productsTable.name}) < 100
          AND ${productsTable.name} NOT ILIKE '%[PDF]%'
          AND ${productsTable.name} NOT ILIKE '%Parts and Info%'
          AND ${productsTable.name} NOT ILIKE '%.com%'
          AND ${productsTable.name} NOT ILIKE '%Master List%'
          AND ${productsTable.name} NOT ILIKE '%Help%'
          AND ${productsTable.name} NOT LIKE '% | %'
          AND ${productsTable.name} NOT LIKE '%/%'`
      )
      .orderBy(productsTable.id)
      .limit(limit);

    sseWrite(res, { type: "start", total: products.length });

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const listText = batch.map((p) => `${p.sku}: ${p.name}`).join("\n");

      const systemPrompt = `You are a pricing specialist for a wholesale window and door hardware distributor. 
Estimate realistic US retail prices for each product. 
Return ONLY a JSON object like {"AWDP-XX-YY": 12.50, ...} — no explanation, no markdown, just JSON.
Price range context: simple clips/seals $3-$15, handles/locks $15-$80, operators/cranks $30-$150, glass panels $100-$500.
Prices should end in .99, .95, .50, .75, .88, or .00.`;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5-nano",
          max_completion_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Estimate prices for these products:\n${listText}` },
          ],
        });

        const raw = response.choices[0]?.message?.content ?? "{}";
        const jsonStart = raw.indexOf("{");
        const jsonEnd = raw.lastIndexOf("}");
        const rawMap: Record<string, unknown> = jsonStart >= 0
          ? JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
          : {};
        // Normalize keys to uppercase for case-insensitive matching
        const priceMap: Record<string, number> = {};
        for (const [k, v] of Object.entries(rawMap)) {
          priceMap[k.trim().toUpperCase()] = Number(v);
        }

        for (const product of batch) {
          const price = priceMap[product.sku.toUpperCase()];
          if (price && price > 0) {
            await db
              .update(productsTable)
              .set({ price: String(price) })
              .where(eq(productsTable.id, product.id));
            updated++;
            sseWrite(res, { type: "progress", sku: product.sku, name: product.name, price, updated, failed, total: products.length, status: "ok" });
          } else {
            failed++;
            sseWrite(res, { type: "progress", sku: product.sku, name: product.name, updated, failed, total: products.length, status: "skip", error: "no price returned" });
          }
        }
      } catch (err: any) {
        failed += batch.length;
        sseWrite(res, { type: "batch_error", batchStart: i, error: err.message });
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    sseWrite(res, { type: "done", updated, failed, total: products.length });
  } catch (err: any) {
    sseWrite(res, { type: "error", error: err.message });
  }

  res.end();
});

export default router;
