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
  productsPath = "/data/products.json",
  variationsPath = "/data/variations.json"
} = {}) {
  const [products, variations] = await Promise.allSettled([
    loadJson(productsPath),
    loadJson(variationsPath)
  ]);

  if (products.status === "fulfilled") {
    _products = products.value.products || [];
  } else {
    console.error("Failed to load products.json:", products.reason);
    _products = [];
  }

  if (variations.status === "fulfilled") {
    _variations = variations.value.variations || [];
  } else {
    console.error("Failed to load variations.json:", variations.reason);
    _variations = [];
  }

  // Build images lookup from product data (each product may have an images array)
  _images = {};
  for (const p of _products) {
    if (p.images && Array.isArray(p.images) && p.images.length > 0) {
      _images[p.sku] = p.images;
    }
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
 * Get the entire images map (used by catalog.js to sync with image-resolver)
 */
export function getImagesMap() {
  ensureReady();
  return { ..._images };
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
    description: parent.description || "",
    category: parent.category,
    sub_category: parent.sub_category,
    brand: parent.brand,
    type: parent.type || "simple",
    attributes: {
      ...(parent.attributes || {}),
      ...(variation ? variation.attributes : {})
    },
    price: variation?.price ?? parent.price ?? null,
    variations: getVariations(parent.sku),
    images: resolved.images
  };
}
