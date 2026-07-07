// /components/VariantSelector.jsx
import React, { useEffect, useMemo, useState } from "react";

function normalizeOptions(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))];
  }

  const text = String(value).trim();
  if (!text) return [];

  return [...new Set(text.split("|").map((item) => item.trim()).filter(Boolean))];
}

function labelize(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function publishSelection(selection) {
  if (typeof window !== "undefined") {
    window.__awdpSelectedAttributes = selection;
  }
}

export default function VariantSelector({ variations, selectedSku, onChange, specifications }) {
  const specGroups = useMemo(() => {
    if (!specifications || typeof specifications !== "object") return [];
    return Object.entries(specifications)
      .map(([key, value]) => ({ key, label: labelize(key), options: normalizeOptions(value) }))
      .filter((group) => group.options.length > 0);
  }, [specifications]);

  const initialSelection = useMemo(() => {
    return Object.fromEntries(
      specGroups.map((group) => [group.key, group.options[0]])
    );
  }, [specGroups]);

  const [selection, setSelection] = useState(initialSelection);

  useEffect(() => {
    setSelection(initialSelection);
    publishSelection(initialSelection);
    return () => publishSelection({});
  }, [initialSelection]);

  const updateSelection = (key, value) => {
    setSelection((current) => {
      const next = { ...current, [key]: value };
      publishSelection(next);
      return next;
    });
  };

  if (specGroups.length > 0) {
    return (
      <div className="variant-selector">
        {specGroups.map((group) => (
          <div className="variant-selector__group" key={group.key}>
            <label htmlFor={`variant-select-${group.key}`}>{group.label}</label>
            <select
              id={`variant-select-${group.key}`}
              value={selection[group.key] || group.options[0]}
              onChange={(e) => updateSelection(group.key, e.target.value)}
              aria-label={`Select ${group.label}`}
            >
              {group.options.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

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
            {v.variantLabel || v.name || v.sku}{v.price != null ? ` — $${Number(v.price).toFixed(2)}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
