// /lib/product-resolver.js
// Resolves parent products, variations, attributes, pricing, and images.

let _products = [];
let _variations = [];
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
 * Initialize resolver
 */
export async function initProductResolver({
  productsPath = "/data/awdp-products.json",
  variationsPath = "/data/awdp-variations.json",
  imagesPath = "/data/awdp-images.json" // optional
} = {}) {
  const [products, variations, images] = await Promise.allSettled([
    loadJson(productsPath),
    loadJson(variationsPath),
    loadJson(imagesPath)
  ]);

  if (products.status === "fulfilled") {
    _products = products.value.products || [];
  } else {
    throw new Error("Failed to load awdp-products.json");
  }

  if (variations.status === "fulfilled") {
    _variations = variations.value.variations || [];
  } else {
    throw new Error("Failed to load awdp-variations.json");
  }

  if (images.status === "fulfilled") {
    _images = images.value || {};
  } else {
    _images = {}; // fallback if no image manifest yet
  }

  _ready = true;
}

function ensureReady() {
  if (!_ready) {
    throw new Error("Product resolver not initialized. Call initProductResolver() first.");
  }
}

/**
 * Get parent product by SKU
 */
export function getParentProduct(parentSku) {
  ensureReady();
  return _products.find(p => p.sku === parentSku) || null;
}

/**
 * Get all variations for a parent SKU
 */
export function getVariations(parentSku) {
  ensureReady();
  return _variations.filter(v => v.parent_sku === parentSku);
}

/**
 * Get a single variation by SKU
 */
export function getVariationBySku(variationSku) {
  ensureReady();
  return _variations.find(v => v.sku === variationSku) || null;
}

/**
 * Resolve SKU → parent + variation
 */
export function resolveSku(sku) {
  ensureReady();
  const normalized = sku.trim().toUpperCase();

  // 1) Parent match
  const parent = _products.find(p => p.sku.toUpperCase() === normalized);
  if (parent) {
    return {
      type: "parent",
      parent,
      variation: null,
      images: getImagesForSku(parent.sku)
    };
  }

  // 2) Variation match
  const variation = _variations.find(v => v.sku.toUpperCase() === normalized);
  if (variation) {
    const parentProduct = getParentProduct(variation.parent_sku);
    return {
      type: "variation",
      parent: parentProduct,
      variation,
      images: getImagesForSku(variation.sku) || getImagesForSku(variation.parent_sku)
    };
  }

  return null;
}

/**
 * Get images for a SKU (variation or parent)
 */
export function getImagesForSku(sku) {
  ensureReady();
  return _images[sku] || null;
}

/**
 * Build a full product detail object
 */
export function getProductDetail(sku) {
  ensureReady();
  const resolved = resolveSku(sku);
  if (!resolved) return null;

  const { parent, variation } = resolved;

  // If we have a variation but no parent (data inconsistency), return null
  if (!parent) return null;

  return {
    sku: variation ? variation.sku : parent.sku,
    parent_sku: parent.sku,
    name: parent.name,
    category: parent.category,
    sub_category: parent.sub_category,
    brand: parent.brand,
    attributes: {
      ...(parent.attributes || {}),
      ...(variation ? variation.attributes : {})
    },
    price: variation?.price ?? parent.price ?? null,
    variations: getVariations(parent.sku),
    images: resolved.images
  };
}
