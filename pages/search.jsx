// /pages/search.jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCatalog, useSearch } from "@/lib/hooks.js";
import ProductGrid from "@/components/ProductGrid.jsx";
import SearchBar from "@/components/SearchBar.jsx";

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;

  const { ready, error } = useCatalog();
  const { results } = useSearch(q || "");

  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    setQuery(q || "");
  }, [q]);

  if (error) {
    return <div className="error">Failed to load catalog. Please try again later.</div>;
  }

  if (!ready) {
    return <div className="loading">Loading catalog…</div>;
  }

  return (
    <div className="search-page">
      <SearchBar />

      <h1 className="search-title">
        Search results for: <span className="query">{query}</span>
      </h1>

      {results.length === 0 && query && (
        <div className="no-results">
          No products found for &ldquo;{query}&rdquo;. Try another search term.
        </div>
      )}

      {results.length > 0 && (
        <p className="result-count">{results.length} product{results.length !== 1 ? "s" : ""} found</p>
      )}

      <ProductGrid items={results} />
    </div>
  );
}
