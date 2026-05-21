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
        <img src={thumb} alt={product.name} />
      </div>

      <div className="info">
        <h3>{product.name}</h3>
        <p className="sku">{product.sku}</p>
        {product.price && <p className="price">${product.price}</p>}
      </div>
    </Link>
  );
}
