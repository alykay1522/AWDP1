// /components/VariantSelector.jsx
import React from "react";

export default function VariantSelector({ variations, selectedSku, onChange }) {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="variant-selector">
      <label>Choose Variation</label>
      <select value={selectedSku} onChange={(e) => onChange(e.target.value)}>
        {variations.map((v) => (
          <option key={v.sku} value={v.sku}>
            {v.sku}
          </option>
        ))}
      </select>
    </div>
  );
}
