import { z } from "zod";

// Mirrors the real `products` table (lib/db/src/schema/products.ts) as it is
// actually serialized by GET /api/products/:sku and GET /api/products
// (artifacts/api-server/src/routes/products.ts). Decimal columns (price,
// originalPrice) come back as strings, timestamps as ISO strings, and
// `attributes` is widened because the API route merges the `attributes` and
// `specifications` json columns before responding.
export const ProductSchema = z
  .object({
    id: z.number(),
    sku: z.string(),
    name: z.string(),
    description: z.string(),
    price: z.string(),
    originalPrice: z.string().nullable(),
    category: z.string(),
    subcategory: z.string().nullable(),
    supplier: z.string(),
    inStock: z.boolean(),
    imageUrl: z.string().nullable(),
    tags: z.array(z.string()).nullable(),
    specifications: z.record(z.string(), z.string()).nullable(),
    compatibleBrands: z.array(z.string()).nullable(),
    variantGroupId: z.string().nullable(),
    variantLabel: z.string().nullable(),
    attributes: z.record(z.string(), z.unknown()).nullable(),
    soldAs: z.string().nullable(),
    createdAt: z.string().nullable(),
  })
  .catchall(z.unknown());

export type Product = z.infer<typeof ProductSchema>;
