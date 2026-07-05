import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import sharp from "sharp";

const router: IRouter = Router();

function originalImageCandidate(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/sites/default/files/styles/uc_product_list/public/";
    if (!parsed.pathname.includes(marker)) return null;
    parsed.pathname = parsed.pathname.replace(marker, "/sites/default/files/");
    parsed.search = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function inspectImage(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "AWDP catalog quality audit" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { url, ok: false, status: response.status };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer, { failOn: "none" }).metadata();
    return {
      url,
      ok: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      bytes: buffer.length,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      format: metadata.format ?? null,
    };
  } catch (error) {
    return { url, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

router.get("/catalog-audit", async (req, res) => {
  if (process.env.VERCEL_ENV === "production") return res.status(404).json({ error: "not_found" });

  try {
    const [summary, normalizedNames, exactListings, duplicateImages, imageHosts, samples] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS "totalRows",
          COUNT(DISTINCT sku)::int AS "distinctSkus",
          COUNT(DISTINCT LOWER(TRIM(name)))::int AS "distinctExactNames",
          COUNT(*) FILTER (WHERE image_url IS NULL OR image_url = '')::int AS "missingImages",
          COUNT(*) FILTER (WHERE image_url LIKE '%/styles/uc_product_list/%')::int AS "thumbnailStyleImages"
        FROM products
      `),
      db.execute(sql`
        WITH normalized AS (
          SELECT
            LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '', 'g')) AS key,
            COUNT(*)::int AS count,
            COUNT(DISTINCT COALESCE(variant_group_id, ''))::int AS "variantGroupCount",
            ARRAY_AGG(sku ORDER BY sku) AS skus,
            ARRAY_AGG(name ORDER BY sku) AS names,
            ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS "variantGroups"
          FROM products
          GROUP BY 1
        )
        SELECT * FROM normalized
        WHERE count > 1
        ORDER BY count DESC, key
        LIMIT 150
      `),
      db.execute(sql`
        SELECT
          LOWER(TRIM(name)) AS name,
          price,
          COALESCE(image_url, '') AS "imageUrl",
          COUNT(*)::int AS count,
          ARRAY_AGG(sku ORDER BY sku) AS skus,
          ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS "variantGroups"
        FROM products
        GROUP BY 1, 2, 3
        HAVING COUNT(*) > 1
        ORDER BY count DESC, name
        LIMIT 150
      `),
      db.execute(sql`
        SELECT
          image_url AS "imageUrl",
          COUNT(*)::int AS count,
          ARRAY_AGG(sku ORDER BY sku) AS skus,
          ARRAY_AGG(name ORDER BY sku) AS names,
          ARRAY_AGG(COALESCE(variant_group_id, '') ORDER BY sku) AS "variantGroups"
        FROM products
        WHERE image_url IS NOT NULL AND image_url <> ''
        GROUP BY image_url
        HAVING COUNT(*) > 1
        ORDER BY count DESC, image_url
        LIMIT 150
      `),
      db.execute(sql`
        SELECT
          CASE
            WHEN image_url IS NULL OR image_url = '' THEN '(missing)'
            ELSE REGEXP_REPLACE(image_url, '^https?://([^/]+).*$','\\1')
          END AS host,
          COUNT(*)::int AS count
        FROM products
        GROUP BY 1
        ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT sku, name, image_url AS "imageUrl"
        FROM products
        WHERE image_url IS NOT NULL AND image_url <> ''
        ORDER BY id DESC
        LIMIT 24
      `),
    ]);

    const sampleRows = samples.rows as Array<{ sku: string; name: string; imageUrl: string }>;
    const imageSamples = await mapWithConcurrency(sampleRows, 4, async (product) => {
      const source = await inspectImage(product.imageUrl);
      const originalUrl = originalImageCandidate(product.imageUrl);
      const original = originalUrl ? await inspectImage(originalUrl) : null;
      return { ...product, source, originalUrl, original };
    });

    const normalizedRows = normalizedNames.rows as Array<{ count: number; variantGroups: string[] }>;
    const suspiciousNormalizedGroups = normalizedRows.filter((group) => {
      const nonEmptyGroups = new Set((group.variantGroups || []).filter(Boolean));
      return nonEmptyGroups.size !== 1;
    });

    return res.json({
      summary: summary.rows[0],
      duplicateAudit: {
        normalizedNameGroupCount: normalizedRows.length,
        suspiciousNormalizedGroupCount: suspiciousNormalizedGroups.length,
        suspiciousNormalizedGroups,
        exactListingGroups: exactListings.rows,
        duplicateImageGroups: duplicateImages.rows,
      },
      imageAudit: {
        hosts: imageHosts.rows,
        samples: imageSamples,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Catalog audit failed");
    return res.status(500).json({ error: "catalog_audit_failed", message: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
