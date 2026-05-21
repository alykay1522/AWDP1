// /lib/catalog.js
// Centralized initializer for all AWDP modules.
// Loads search engine, product resolver, filter engine, and image resolver.

import { initSearch } from "./search.js";
import { initProductResolver } from "./product-resolver.js";
import { initFilterEngine } from "./filter.js";
import { initImageResolver } from "./image-resolver.js";

let _ready = false;

/**
 * Initialize the entire AWDP catalog system
 */
export async function initCatalog({
  searchIndex = "/data/awdp-search-index.json",
  fuseConfig = "/data/awdp-fuse-config.json",
  products = "/data/awdp-products.json",
  variations = "/data/awdp-variations.json",
  taxonomy = "/data/awdp-taxonomy.json",
  images = "/data/awdp-images.json",
  fallbackImage = "/images/fallback.png"
} = {}) {
  // Load all modules in parallel for maximum speed
  await Promise.all([
    initSearch({
      indexPath: searchIndex,
      configPath: fuseConfig
    }),
    initProductResolver({
      productsPath: products,
      variationsPath: variations,
      imagesPath: images
    }),
    initFilterEngine({
      productsPath: products,
      variationsPath: variations,
      taxonomyPath: taxonomy
    }),
    initImageResolver({
      imagesPath: images,
      fallbackImage
    })
  ]);

  _ready = true;
}

/**
 * Check if catalog is initialized
 */
export function isCatalogReady() {
  return _ready;
}
