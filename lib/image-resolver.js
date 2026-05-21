// /lib/image-resolver.js
// Resolves images for parent SKUs, variation SKUs, and fallback images.

let _images = {};
let _ready = false;

/**
 * Load JSON helper
 */
async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

/**
 * Initialize image resolver
 */
export async function initImageResolver({
  imagesPath = "/data/awdp-images.json",
  fallbackImage = "/images/fallback.png"
} = {}) {
  const images = await loadJson(imagesPath).catch(() => null);

  _images = images || {};
  _images.__fallback = fallbackImage;

  _ready = true;
}

function ensureReady() {
  if (!_ready) {
    throw new Error("Image resolver not initialized. Call initImageResolver() first.");
  }
}

/**
 * Get images for a SKU (variation or parent)
 */
export function getImagesForSku(sku) {
  ensureReady();
  if (!sku) return [_images.__fallback];

  const entry = _images[sku];
  if (entry && Array.isArray(entry) && entry.length > 0) {
    return entry;
  }

  return [_images.__fallback];
}

/**
 * Resolve image set with fallback logic:
 * 1. Variation images
 * 2. Parent images
 * 3. Global fallback
 */
export function resolveImages({ sku, parent_sku }) {
  ensureReady();

  // Variation first
  const variationImages = sku ? _images[sku] : null;
  if (variationImages && variationImages.length > 0) {
    return variationImages;
  }

  // Parent fallback
  const parentImages = parent_sku ? _images[parent_sku] : null;
  if (parentImages && parentImages.length > 0) {
    return parentImages;
  }

  // Global fallback
  return [_images.__fallback];
}

/**
 * Get thumbnail (first image)
 */
export function getThumbnail(sku) {
  const imgs = getImagesForSku(sku);
  return imgs[0] || _images.__fallback;
}

/**
 * Check if SKU has images
 */
export function hasImages(sku) {
  ensureReady();
  const entry = _images[sku];
  return Array.isArray(entry) && entry.length > 0;
}
