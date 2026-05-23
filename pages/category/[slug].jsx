// /pages/category/[slug].jsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import { useCatalog, useCategory } from "@/lib/hooks.js";
import ProductGrid from "@/components/ProductGrid.jsx";
import CategorySidebar from "@/components/CategorySidebar.jsx";

export default function CategoryPage() {
  const router = useRouter();
  const { slug } = router.query;

  const { ready, error } = useCatalog();

  const [filters, setFilters] = useState({
    brand: null,
    attributes: {},
    page: 1,
    perPage: 20
  });

  const data = useCategory(slug, filters);

  if (error) {
    return <div className="error">Failed to load catalog. Please try again later.</div>;
  }

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
          {slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
        </h1>

        {data.total > 0 && (
          <p className="result-count">{data.total} product{data.total !== 1 ? "s" : ""}</p>
        )}

        <ProductGrid items={data.items} />

        {data.totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: data.totalPages }).map((_, i) => (
              <button
                key={i}
                className={data.page === i + 1 ? "active" : ""}
                onClick={() =>
                  setFilters((f) => ({ ...f, page: i + 1 }))
                }
                aria-label={`Go to page ${i + 1}`}
                aria-current={data.page === i + 1 ? "page" : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
