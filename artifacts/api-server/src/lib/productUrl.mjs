/**
 * Canonical storefront URL for a product SKU.
 *
 * Mirror of artifacts/awdp-site/src/lib/product-url.mjs — see that file for
 * the full explanation. In short: Vercel and Express both decode `%2F` back
 * to `/` before route matching, so `encodeURIComponent(sku)` alone produces a
 * 404 for the 72 catalog SKUs that contain a slash. Turning `/` into `-`
 * still resolves through `GET /api/products/:sku` (its slugified-SKU lookup
 * collapses runs of non-alphanumerics to `-`) and leaves every other SKU
 * byte-identical.
 *
 * The two copies exist so each package stays self-contained on Vercel's
 * isolated installs. tests/product-url.test.mjs fails if they ever disagree.
 */

/** SKU with path-breaking separators replaced. Identity for every other SKU. */
export function productSlug(sku) {
  return String(sku ?? "").replace(/[/\\]+/g, "-");
}

/** Site-relative, fully encoded product path. */
export function productPath(sku) {
  return `/product/${encodeURIComponent(productSlug(sku))}`;
}
