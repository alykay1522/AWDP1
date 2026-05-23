// /lib/hooks.js
// React hooks wrapping the AWDP catalog engine.

import { useEffect, useState } from "react";
import { initCatalog, isCatalogReady, getCatalogError } from "./catalog.js";
import { searchProducts, suggest, searchBySku } from "./search.js";
import { getProductDetail } from "./product-resolver.js";
import { filterProducts, getProductsByCategory } from "./filter.js";

/**
 * Initialize catalog once at app load
 */
export function useCatalog() {
  const [ready, setReady] = useState(isCatalogReady());
  const [error, setError] = useState(getCatalogError());

  useEffect(() => {
    if (!ready && !error) {
      initCatalog()
        .then(() => {
          const initError = getCatalogError();
          if (initError) {
            setError(initError);
          } else {
            setReady(true);
          }
        });
    }
  }, [ready, error]);

  return { ready, error };
}

/**
 * Search hook
 */
export function useSearch(query, options = {}) {
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!query || !isCatalogReady()) {
      setResults([]);
      setSuggestions([]);
      return;
    }

    const r = searchProducts(query, options);
    const s = suggest(query);

    setResults(r);
    setSuggestions(s);
  }, [query, JSON.stringify(options)]);

  return { results, suggestions };
}

/**
 * Product detail hook
 */
export function useProduct(sku) {
  const [product, setProduct] = useState(null);

  useEffect(() => {
    if (!sku || !isCatalogReady()) {
      setProduct(null);
      return;
    }

    const detail = getProductDetail(sku);
    setProduct(detail);
  }, [sku]);

  return { product };
}

/**
 * Category hook
 */
export function useCategory(slug, { brand = null, attributes = {}, page = 1, perPage = 20 } = {}) {
  const [data, setData] = useState({
    items: [],
    total: 0,
    totalPages: 1,
    page: 1
  });

  useEffect(() => {
    if (!slug || !isCatalogReady()) {
      setData({ items: [], total: 0, totalPages: 1, page: 1 });
      return;
    }

    const filtered = filterProducts({
      category: slug,
      brand,
      attributes,
      page,
      perPage
    });

    setData(filtered);
  }, [slug, brand, JSON.stringify(attributes), page, perPage]);

  return data;
}

/**
 * Filter hook — for sidebar filters, mobile filters, etc.
 */
export function useFilters({ category = null, brand = null, attributes = {}, page = 1, perPage = 20 } = {}) {
  const [data, setData] = useState({
    items: [],
    total: 0,
    totalPages: 1,
    page: 1
  });

  useEffect(() => {
    if (!isCatalogReady()) {
      setData({ items: [], total: 0, totalPages: 1, page: 1 });
      return;
    }

    const filtered = filterProducts({
      category,
      brand,
      attributes,
      page,
      perPage
    });

    setData(filtered);
  }, [category, brand, JSON.stringify(attributes), page, perPage]);

  return data;
}
