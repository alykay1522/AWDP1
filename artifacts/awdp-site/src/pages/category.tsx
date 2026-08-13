import { useParams } from "wouter";
import { ProductBrowser } from "@/components/product-browser";
import { getCategoryBySlug } from "@/lib/categories";
import NotFound from "./not-found";

export default function CategoryPage() {
  const params = useParams();
  const category = params.slug ? getCategoryBySlug(params.slug) : undefined;

  if (!category) {
    return <NotFound />;
  }

  return <ProductBrowser canonicalPath={`/category/${category.slug}`} lockedCategoryName={category.name} />;
}
