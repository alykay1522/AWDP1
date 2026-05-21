// /pages/search.jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCatalog, useSearch } from "@/lib/hooks.js";
import ProductGrid from "@/components/ProductGrid.jsx";
import SearchBar from "@/components/SearchBar.jsx";

export default function SearchPage() {
  const router = useRouter();
  const { q } = router.query;

  const { ready } = useCatalog();
  const { results } = useSearch(q || "");

  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    setQuery(q || "");
  }, [q]);

  if (!ready) {
    return <div className="loading">Loading catalog…</div>;
  }

  return (
    <div className="search-page">
      <SearchBar />

      <h1 className="search-title">
        Search results for: <span className="query">{query}</span>
      </h1>

      {results.length === 0 && (
        <div className="no-results">
          No products found. Try another search.
        </div>
      )}

      <ProductGrid items={results} />
    </div>
  );
}
