// /components/SearchBar.jsx
import React, { useState } from "react";
import { useSearch } from "@/lib/hooks.js";
import Link from "next/link";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const { suggestions } = useSearch(query);

  return (
    <div className="search-bar" role="search">
      <label htmlFor="search-input" className="sr-only">Search products</label>
      <input
        id="search-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by SKU, name, or keyword"
        aria-label="Search products by SKU, name, or keyword"
        aria-autocomplete="list"
        aria-expanded={query && suggestions.length > 0 ? "true" : "false"}
        aria-controls="search-suggestions"
        type="search"
        autoComplete="off"
      />

      {query && suggestions.length > 0 && (
        <div className="suggestions" id="search-suggestions" role="listbox" aria-label="Search suggestions">
          {suggestions.map((s) => (
            <Link key={s.sku} href={`/product/${s.sku}`} role="option">
              <div className="suggestion-item">
                <span className="sku">{s.sku}</span>
                <span className="name">{s.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
