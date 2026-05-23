// /lib/search.js
// AWDP client-side search engine
// - Loads awdp-search-index.json (+ optional awdp-fuse-config.json)
// - Provides: initSearch, searchProducts, searchBySku, suggest, filterByCategory

let _index = [];
let _fuse = null;
let _ready = false;
let _config = null;

/**
 * Load JSON helper
 */
async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

/**
 * Initialize search engine
 * - indexPath: path to awdp-search-index.json
 * - configPath: optional path to awdp-fuse-config.json
 */
export async function initSearch({
  indexPath = "/data/search-index.json",
  configPath = "/data/fuse-config.json",
} = {}) {
  const [indexData, configData] = await Promise.allSettled([
    loadJson(indexPath),
    loadJson(configPath),
  ]);

  if (indexData.status === "fulfilled") {
    _index = indexData.value.index || [];
  } else {
    throw new Error("Search index failed to load");
  }

  if (configData.status === "fulfilled") {
    _config = configData.value;
  } else {
    // sensible defaults if config file is missing
    _config = {
      includeScore: true,
      threshold: 0.35,
      keys: [
        "sku",
        "name",
        "category",
        "sub_category",
        "brand",
        "keywords",
        "variations",
      ],
    };
  }

  // Expect Fuse to be globally available or imported elsewhere
  _fuse = new Fuse(_index, _config);
  _ready = true;
}

/**
 * Ensure initialized
 */
function ensureReady() {
  if (!_ready || !_fuse) {
    throw new Error("Search engine not initialized. Call initSearch() first.");
  }
}

/**
 * Exact SKU lookup (parent or variation)
 */
export function searchBySku(sku) {
  ensureReady();
  if (!sku) return null;

  const normalized = sku.trim().toUpperCase();

  // 1) direct parent SKU match
  const parent = _index.find((item) => item.sku.toUpperCase() === normalized);
  if (parent) return { type: "parent", item: parent };

  // 2) variation SKU match
  const variationParent = _index.find((item) =>
    (item.variations || []).some(
      (v) => String(v).trim().toUpperCase() === normalized
    )
  );
  if (variationParent) {
    return {
      type: "variation",
      parent: variationParent,
      variation_sku: normalized,
    };
  }

  return null;
}

/**
 * Fuzzy search by free-text query
 * - options.limit: max results
 * - options.category / brand: optional filters
 */
export function searchProducts(query, options = {}) {
  ensureReady();
  const q = (query || "").trim();
  if (!q) return [];

  const { limit = 20, category, brand } = options;

  let results = _fuse.search(q, { limit: limit * 3 }); // overshoot, then filter

  // Map to items
  results = results.map((r) => r.item);

  // Optional category filter
  if (category) {
    const cat = category.toLowerCase();
    results = results.filter(
      (item) =>
        item.category?.toLowerCase() === cat ||
        item.sub_category?.toLowerCase() === cat
    );
  }

  // Optional brand filter
  if (brand) {
    const b = brand.toLowerCase();
    results = results.filter(
      (item) => item.brand && item.brand.toLowerCase() === b
    );
  }

  // Deduplicate by SKU and trim to limit
  const seen = new Set();
  const deduped = [];
  for (const item of results) {
    if (!seen.has(item.sku)) {
      seen.add(item.sku);
      deduped.push(item);
      if (deduped.length >= limit) break;
    }
  }

  return deduped;
}

/**
 * Autocomplete suggestions
 * - lightweight: prioritizes SKU + name
 */
export function suggest(query, limit = 10) {
  ensureReady();
  const q = (query || "").trim();
  if (!q) return [];

  const lower = q.toLowerCase();
  const suggestions = [];

  for (const item of _index) {
    if (suggestions.length >= limit) break;

    const skuMatch = item.sku.toLowerCase().includes(lower);
    const nameMatch = item.name?.toLowerCase().includes(lower);
    const keywordMatch = (item.keywords || []).some((k) =>
      String(k).toLowerCase().includes(lower)
    );

    if (skuMatch || nameMatch || keywordMatch) {
      suggestions.push({
        sku: item.sku,
        name: item.name,
        category: item.category,
        brand: item.brand,
      });
    }
  }

  return suggestions;
}

/**
 * Filter by category (and optional brand)
 */
export function filterByCategory(category, brand = null, limit = 100) {
  ensureReady();
  if (!category) return [];

  const cat = category.toLowerCase();
  const b = brand ? brand.toLowerCase() : null;

  const results = [];
  for (const item of _index) {
    const catMatch =
      item.category?.toLowerCase() === cat ||
      item.sub_category?.toLowerCase() === cat;

    const brandMatch = !b || (item.brand && item.brand.toLowerCase() === b);

    if (catMatch && brandMatch) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Expose raw index (read-only)
 */
export function getIndex() {
  ensureReady();
  return _index.slice();
}
