// /lib/filter.js
// High‑performance filtering for AWDP static catalog.
// Supports category pages, brand filters, attribute filters, and pagination.

let _products = [];
let _variations = [];
let _taxonomy = {};
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
 * Initialize filter engine
 */
export async function initFilterEngine({
  productsPath = "/data/products.json",
  variationsPath = "/data/variations.json",
  taxonomyPath = "/data/taxonomy.json"
} = {}) {
  const [products, variations, taxonomy] = await Promise.allSettled([
    loadJson(productsPath),
    loadJson(variationsPath),
    loadJson(taxonomyPath)
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

  if (taxonomy.status === "fulfilled") {
    _taxonomy = taxonomy.value || {};
  } else {
    console.error("Failed to load taxonomy.json:", taxonomy.reason);
    _taxonomy = { categories: [], brands: [], attributes: [] };
  }

  _ready = true;
}

function ensureReady() {
  if (!_ready) {
    throw new Error("Filter engine not initialized. Call initFilterEngine() first.");
  }
}

/**
 * Get all products in a category (including subcategories)
 */
export function getProductsByCategory(categorySlug) {
  ensureReady();
  if (!categorySlug) return [];

  const slug = categorySlug.toLowerCase();

  return _products.filter(p => {
    const cat = p.category?.toLowerCase();
    const sub = p.sub_category?.toLowerCase();
    return cat === slug || sub === slug;
  });
}

/**
 * Filter by brand
 */
export function filterByBrand(products, brand) {
  if (!brand) return products;
  const b = brand.toLowerCase();
  return products.filter(p => p.brand?.toLowerCase() === b);
}

/**
 * Filter by attribute key/value pairs
 * Example:
 *   filterByAttributes(products, { Color: "White", Length_in: 37 })
 */
export function filterByAttributes(products, attributes = {}) {
  const keys = Object.keys(attributes);
  if (keys.length === 0) return products;

  return products.filter(p => {
    return keys.every(key => {
      const val = attributes[key];
      if (val == null) return true;

      const parentAttr = p.attributes?.[key];
      const variationMatch = _variations.some(v =>
        v.parent_sku === p.sku && v.attributes?.[key] === val
      );

      return parentAttr === val || variationMatch;
    });
  });
}

/**
 * Pagination helper
 */
export function paginate(items, page = 1, perPage = 20) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return {
    page,
    perPage,
    total: items.length,
    totalPages: Math.ceil(items.length / perPage),
    items: items.slice(start, end)
  };
}

/**
 * Full filter pipeline
 * - category
 * - brand
 * - attributes
 * - pagination
 */
export function filterProducts({
  category = null,
  brand = null,
  attributes = {},
  page = 1,
  perPage = 20
} = {}) {
  ensureReady();

  let results = _products;

  if (category) {
    results = getProductsByCategory(category);
  }

  if (brand) {
    results = filterByBrand(results, brand);
  }

  if (attributes && Object.keys(attributes).length > 0) {
    results = filterByAttributes(results, attributes);
  }

  return paginate(results, page, perPage);
}

/**
 * Expose taxonomy (categories, subcategories, filters)
 */
export function getTaxonomy() {
  ensureReady();
  return _taxonomy;
}
