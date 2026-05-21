// /components/ProductGrid.jsx
import React from "react";
import ProductCard from "./ProductCard.jsx";

export default function ProductGrid({ items = [] }) {
  return (
    <div className="product-grid">
      {items.map((p) => (
        <ProductCard key={p.sku} product={p} />
      ))}
    </div>
  );
}
