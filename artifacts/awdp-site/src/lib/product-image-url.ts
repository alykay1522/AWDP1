const DRUPAL_PRODUCT_THUMBNAIL = "/sites/default/files/styles/uc_product_list/public/";
const DRUPAL_ORIGINAL_FILES = "/sites/default/files/";

/**
 * Legacy catalog imports stored Drupal's 85–100 px product-list thumbnails.
 * Convert those URLs to the original uploaded file while preserving all other URLs.
 */
export function getOriginalProductImageUrl(src: string | null | undefined): string | null {
  if (!src) return null;

  try {
    const url = new URL(src, typeof window === "undefined" ? "https://www.allwindowdoorparts.com" : window.location.origin);
    if (!url.pathname.includes(DRUPAL_PRODUCT_THUMBNAIL)) return src;

    url.pathname = url.pathname.replace(DRUPAL_PRODUCT_THUMBNAIL, DRUPAL_ORIGINAL_FILES);
    url.search = "";
    return url.toString();
  } catch {
    return src;
  }
}

export function getProductImageCandidates(src: string | null | undefined): string[] {
  if (!src) return [];
  const original = getOriginalProductImageUrl(src);
  return [...new Set([original, src].filter((value): value is string => Boolean(value)))];
}
