// /lib/catalog.js
// Centralized initializer for all AWDP modules.
// Loads search engine, product resolver, filter engine, and image resolver.

import { initSearch } from "./search.js";
import { initProductResolver, getImagesMap } from "./product-resolver.js";
import { initFilterEngine } from "./filter.js";
import { initImageResolver, setImagesMap } from "./image-resolver.js";

let _ready = false;
let _initError = null;

/**
 * Initialize the entire AWDP catalog system
 */
export async function initCatalog({
  searchIndex = "/data/search-index.json",
  fuseConfig = "/data/fuse-config.json",
  products = "/data/products.json",
  variations = "/data/variations.json",
  taxonomy = "/data/taxonomy.json",
  fallbackImage = "/images/fallback.png"
} = {}) {
  try {
    const results = await Promise.allSettled([
      initSearch({
        indexPath: searchIndex,
        configPath: fuseConfig
      }),
      initProductResolver({
        productsPath: products,
        variationsPath: variations
      }),
      initFilterEngine({
        productsPath: products,
        variationsPath: variations,
        taxonomyPath: taxonomy
      }),
      initImageResolver({
        fallbackImage
      })
    ]);

    const failures = results.filter(r => r.status === "rejected");
    if (failures.length > 0) {
      console.warn("Catalog init partial failures:", failures.map(f => f.reason?.message));
    }

    // Sync images from product-resolver to image-resolver
    // This ensures resolveImages() has access to product image data
    try {
      const imagesMap = getImagesMap();
      setImagesMap(imagesMap);
    } catch (err) {
      console.warn("Failed to sync images map:", err.message);
    }

    _ready = true;
  } catch (err) {
    _initError = err;
    console.error("Catalog initialization failed:", err);
    _ready = false;
  }
}

/**
 * Check if catalog is initialized
 */
export function isCatalogReady() {
  return _ready;
}

/**
 * Get any initialization error
 */
export function getCatalogError() {
  return _initError;
}
