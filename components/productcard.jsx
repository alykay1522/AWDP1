// /components/ProductCard.jsx
import React from "react";
import Link from "next/link";
import { getThumbnail } from "@/lib/image-resolver.js";

export default function ProductCard({ product }) {
  if (!product) return null;

  const thumb = getThumbnail(product.sku);

  return (
    <Link href={`/product/${product.sku}`} className="product-card">
      <div className="thumb">
        <img
          src={thumb}
          alt={product.name || product.sku}
          loading="lazy"
          onError={(e) => { e.target.src = "/images/fallback.png"; }}
        />
      </div>

      <div className="info">
        <h3>{product.name}</h3>
        <p className="sku">{product.sku}</p>
        {product.brand && <p className="brand">{product.brand}</p>}
        {product.price != null && product.price > 0 && (
          <p className="price">${Number(product.price).toFixed(2)}</p>
        )}
      </div>
    </Link>
  );
}
