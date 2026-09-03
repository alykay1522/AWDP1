/**
 * Canonical storefront URL for a product SKU.
 *
 * `encodeURIComponent(sku)` alone is not enough. Vercel's router and Express
 * both decode `%2F` back to `/` BEFORE matching a route, so a request for
 * `/product/AWDP-TA-OI%2F6735` reaches the router as two path segments and
 * never matches `/product/:sku` — it 404s even though the product exists.
 * 72 catalog SKUs contain a slash, and every one of them was unreachable.
 *
 * `GET /api/products/:sku` resolves a product by exact SKU, case-insensitive
 * SKU, legacy slug, slugified SKU, or slugified name — and slugify collapses
 * every run of non-alphanumerics to `-`. So a SKU whose slashes have become
 * hyphens still resolves to the same row. Replacing only `/` and `\` leaves
 * every other SKU byte-identical, so no already-indexed product URL changes.
 *
 * Mirrored at artifacts/api-server/src/lib/productUrl.mjs so each package
 * stays self-contained on Vercel's isolated installs. tests/product-url.test.mjs
 * fails if the two copies ever disagree.
 */

/** SKU with path-breaking separators replaced. Identity for every other SKU. */
export function productSlug(sku) {
  return String(sku ?? "").replace(/[/\\]+/g, "-");
}

/** Site-relative, fully encoded product path. */
export function productPath(sku) {
  return `/product/${encodeURIComponent(productSlug(sku))}`;
}
