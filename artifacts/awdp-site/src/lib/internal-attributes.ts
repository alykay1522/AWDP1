/**
 * Import / scraper bookkeeping that lives alongside real product attributes.
 *
 * Product rows built by the scrapers carry fields such as `source`,
 * `product_url`, `image_urls`, `all_categories` and `site_specs`. Those are
 * internal only: they must never surface on the storefront, where every other
 * attribute renders as a customer-selectable product option.
 */

const INTERNAL_KEYS = new Set([
  "subcategory",
  "original_sku",
  "source",
  "source_sku",
  "source_site",
  "source_url",
  "product_url",
  "url",
  "link",
  "permalink",
  "slug",
  "id",
  "image",
  "images",
  "image_url",
  "image_urls",
  "image_file_name",
  "thumbnail",
  "all_categories",
  "categories",
  "category",
  "breadcrumb",
  "breadcrumbs",
  "site_specs",
  "specs",
  "raw_specs",
  "scraped_at",
  "imported_at",
  "vendor",
  "supplier",
  "cost",
  "wholesale_price",
  "margin",
  "markup",
  "competitor_price",
  "internal_notes",
]);

/**
 * Catch-all for bookkeeping that arrives under a key we haven't seen before,
 * so a new scraper field can't leak onto the product page by default.
 * Matches whole underscore-delimited words only, which keeps real attributes
 * such as `compatibility`, `sold_by` and `material` visible.
 */
const INTERNAL_KEY_PATTERN =
  /(^|_)(url|urls|uri|src|href|id|uuid|source|sources|scrape|scraped|scraper|import|imported|raw|internal|meta|metadata|json|cost|margin|markup|supplier|vendor)(_|$)/i;

export function isInternalAttributeKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return INTERNAL_KEYS.has(normalized) || INTERNAL_KEY_PATTERN.test(normalized);
}

/**
 * Values that are plainly machine data rather than something a customer picks:
 * links, stringified objects and raw JSON blobs.
 */
export function isInternalAttributeValue(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/^\[object [^\]]*\]$/i.test(text)) return true;
  if (/^(https?:\/\/|www\.)/i.test(text)) return true;
  if (/^[[{]/.test(text) && /[\]}]$/.test(text)) return true;
  return false;
}

/** True when an attribute should be hidden from the storefront entirely. */
export function isInternalAttribute(key: string, value: unknown): boolean {
  if (isInternalAttributeKey(key)) return true;
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) {
    return value.every((item) => isInternalAttributeValue(String(item)));
  }
  if (typeof value === "boolean") return false;
  return isInternalAttributeValue(String(value));
}
