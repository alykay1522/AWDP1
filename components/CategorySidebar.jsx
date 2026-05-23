// /components/CategorySidebar.jsx
import React from "react";
import Link from "next/link";
import { getTaxonomy } from "@/lib/filter.js";

export default function CategorySidebar() {
  const taxonomy = getTaxonomy();
  const categories = taxonomy.categories || [];

  return (
    <aside className="category-sidebar">
      <h3>Categories</h3>
      <ul>
        {categories.map((c) => (
          <li key={c.key}>
            <Link href={`/category/${c.key}`}>{c.label}</Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
