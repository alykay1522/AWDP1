// /pages/product/[sku].jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useCatalog, useProduct } from "@/lib/hooks.js";
import VariantSelector from "@/components/VariantSelector.jsx";
import ProductGrid from "@/components/ProductGrid.jsx";
import { getImagesForSku } from "@/lib/image-resolver.js";

export default function ProductPage() {
  const router = useRouter();
  const { sku } = router.query;

  const { ready } = useCatalog();
  const { product } = useProduct(sku);

  const [selectedSku, setSelectedSku] = useState(sku);

  useEffect(() => {
    setSelectedSku(sku);
  }, [sku]);

  if (!ready) {
    return <div className="loading">Loading catalog…</div>;
  }

  if (!product) {
    return <div className="not-found">Product not found</div>;
  }

  const images = getImagesForSku(selectedSku);

  return (
    <div className="product-page">
      <div className="product-main">
        <div className="product-images">
          {images.map((img, i) => (
            <img key={i} src={img} alt={product.name} />
          ))}
        </div>

        <div className="product-info">
          <h1>{product.name}</h1>
          <p className="sku">SKU: {selectedSku}</p>

          {product.price && (
            <p className="price">${product.price}</p>
          )}

          {product.variations && product.variations.length > 0 && (
            <VariantSelector
              variations={product.variations}
              selectedSku={selectedSku}
              onChange={(newSku) => router.push(`/product/${newSku}`)}
            />
          )}

          <div className="attributes">
            <h3>Attributes</h3>
            <ul>
              {Object.entries(product.attributes || {}).map(([key, val]) => (
                <li key={key}>
                  <strong>{key}:</strong> {val}
                </li>
              ))}
            </ul>
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
