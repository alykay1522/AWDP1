// /pages/product/[sku].jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCatalog, useProduct } from "@/lib/hooks.js";
import VariantSelector from "@/components/VariantSelector.jsx";
import ProductGrid from "@/components/ProductGrid.jsx";
import { resolveImages } from "@/lib/image-resolver.js";

export default function ProductPage() {
  const router = useRouter();
  const { sku } = router.query;

  const { ready, error } = useCatalog();
  const { product } = useProduct(sku);

  const [selectedSku, setSelectedSku] = useState(sku);

  useEffect(() => {
    setSelectedSku(sku);
  }, [sku]);

  if (error) {
    return <div className="error">Failed to load catalog. Please try again later.</div>;
  }

  if (!ready) {
    return <div className="loading">Loading catalog…</div>;
  }

  if (!product) {
    return <div className="not-found">Product not found</div>;
  }

  const images = resolveImages({
    sku: selectedSku,
    parent_sku: product.parent_sku
  });

  return (
    <div className="product-page">
      <div className="product-main">
        <div className="product-images">
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`${product.name} - Image ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              onError={(e) => { e.target.src = "/images/fallback.png"; }}
            />
          ))}
        </div>

        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="sku">SKU: {selectedSku}</p>

          {product.brand && (
            <p className="brand">Brand: {product.brand}</p>
          )}

          {product.category && (
            <p className="category">Category: {product.category}</p>
          )}

          {product.price != null && product.price > 0 && (
            <p className="price">${Number(product.price).toFixed(2)}</p>
          )}

          {product.description && (
            <div className="description">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          {product.variations && product.variations.length > 0 && (
            <VariantSelector
              variations={product.variations}
              selectedSku={selectedSku}
              onChange={(newSku) => router.push(`/product/${newSku}`)}
            />
          )}

          <div className="attributes">
            {product.attributes && Object.keys(product.attributes).length > 0 && (
              <>
                <h3>Specifications</h3>
                <ul>
                  {Object.entries(product.attributes).map(([key, val]) => (
                    <li key={key}>
                      <strong>{key.replace(/_/g, " ")}:</strong>{" "}
                      {Array.isArray(val) ? val.join(", ") : String(val)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="related">
        <h2>More from this category</h2>
        <ProductGrid items={[]} />
      </div>
    </div>
  );
}
