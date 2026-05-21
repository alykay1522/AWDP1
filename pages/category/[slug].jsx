// /pages/category/[slug].jsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCatalog, useCategory } from "@/lib/hooks.js";
import ProductGrid from "@/components/ProductGrid.jsx";
import CategorySidebar from "@/components/CategorySidebar.jsx";

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;

  const { ready } = useCatalog();

  const [filters, setFilters] = useState({
    brand: null,
    attributes: {},
    page: 1,
    perPage: 20
  });

  const data = useCategory(slug, filters);

  if (!ready) {
    return <div className="loading">Loading catalog…</div>;
  }

  if (!slug) {
    return <div className="not-found">Category not found</div>;
  }

  return (
    <div className="category-page">
      <CategorySidebar />

      <div className="category-main">
        <h1 className="category-title">
          {slug.replace(/-/g, " ").toUpperCase()}
        </h1>

        <ProductGrid items={data.items} />

        <div className="pagination">
          {Array.from({ length: data.totalPages }).map((_, i) => (
            <button
              key={i}
              className={data.page === i + 1 ? "active" : ""}
              onClick={() =>
                setFilters((f) => ({ ...f, page: i + 1 }))
              }
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
