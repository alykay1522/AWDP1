// /components/SearchBar.jsx
import React, { useState } from "react";
import { useSearch } from "@/lib/hooks.js";
import Link from "next/link";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const { suggestions } = useSearch(query);

  return (
    <div className="search-bar">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by SKU, name, or keyword"
      />

      {query && suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map((s) => (
            <Link key={s.sku} href={`/product/${s.sku}`}>
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
