// /components/VariantSelector.jsx
import React from "react";

export default function VariantSelector({ variations, selectedSku, onChange }) {
  if (!variations || variations.length === 0) return null;

  return (
    <div className="variant-selector">
      <label htmlFor="variant-select">Choose Variation</label>
      <select
        id="variant-select"
        value={selectedSku}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Select product variation"
      >
        {variations.map((v) => (
          <option key={v.sku} value={v.sku}>
            {v.sku}{v.price != null ? ` — $${Number(v.price).toFixed(2)}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
