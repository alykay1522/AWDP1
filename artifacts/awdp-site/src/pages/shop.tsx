import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { CategorySeoBlock } from "@/components/category-seo-block";
import { useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function buildPageMeta(search: string, category: string) {
  if (category) {
    return {
      title: `${category} – Replacement Parts`,
      description: `Shop ${category} replacement parts at All Window Door Parts. Hard-to-find and OEM-specific hardware for every major brand. Veteran-owned, 40+ years experience. Shipping calculated at checkout.`,
    };
  }
  if (search) {
    return {
      title: `"${search}" – Window & Door Parts`,
      description: `Shop replacement parts matching "${search}" at All Window Door Parts. 35,000+ parts including hard-to-find and discontinued hardware. Veteran-owned, 40+ years experience.`,
    };
  }
  return {
    title: "Shop Window & Door Parts",
    description: "Browse 35,000+ window and door replacement parts. Shop casement operators, window balances, door locks, rollers, glazing seals, screen frames, and more. Veteran-owned. Shipping calculated at checkout.",
  };
}

export default function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const [search, setSearch]         = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [category, setCategory]     = useState(searchParams.get("category") || "");
  const [page, setPage]             = useState(1);
  const [sort, setSort]             = useState("newest");

  // Sync URL params whenever the wouter location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch   = params.get("search") ?? "";
    const urlCategory = params.get("category") ?? "";

    if (urlSearch !== search) {
      setSearch(urlSearch);
      setSearchInput(urlSearch);
      setPage(1);
    }
    if (urlCategory !== category) {
      setCategory(urlCategory);
      setPage(1);
    }
  }, [location]);

  const { data: productsData, isLoading, isError, error } = useGetProducts({
    search:   search   || undefined,
    category: category || undefined,
    page,
    limit: 24,
    sort,
  }, {
    query: {
      queryKey: getGetProductsQueryKey({
        search:   search   || undefined,
        category: category || undefined,
        page,
        limit: 24,
        sort,
      }),
      retry: 3,
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setCategory("");
    setPage(1);
  };

  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
    setCategory("");
    setPage(1);
  };

  const { title: seoTitle, description: seoDesc } = buildPageMeta(search, category);

  const activeLabel = category
    ? category
    : search
    ? `"${search}"`
    : null;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <PageSeo
        title={seoTitle}
        path="/shop"
        description={seoDesc}
      />

      {/* Order minimum notice */}
      <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-3 text-sm font-semibold">
        <span className="text-amber-600 text-base leading-none" aria-hidden="true">!</span>
        $50 minimum on all orders &mdash; Anything below $50 will be cancelled
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
            {category ? category : "Shop Parts"}
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            {productsData?.total
              ? `${productsData.total.toLocaleString()} parts found`
              : isLoading ? "Loading…" : "0 parts found"}
            {activeLabel && ` for ${activeLabel}`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Input
              type="search"
              placeholder="Search parts…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-white w-56"
              aria-label="Search parts"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </form>
          {(search || category) && (
            <Button variant="ghost" size="sm" onClick={clearSearch} className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
              <X className="w-4 h-4 mr-1" aria-hidden="true" /> Clear
            </Button>
          )}
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger className="w-[180px] bg-white" aria-label="Sort products">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest Arrivals</SelectItem>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="name-asc">Name: A to Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array(24).fill(0).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 bg-white p-4 rounded-lg border">
              <Skeleton className="h-[160px] w-full rounded-md" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-6 w-1/3 mt-auto" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-24 bg-white rounded-xl border border-dashed">
          <h3 className="text-xl font-bold text-foreground mb-2">Unable to load products</h3>
          <p className="text-muted-foreground mb-2">There was a problem connecting to our catalog.</p>
          <p className="text-xs text-red-500 mb-6 font-mono">{String(error)}</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      ) : productsData?.products.length ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {productsData.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {productsData.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, productsData.totalPages) }).map((_, i) => {
                  let pageNum = page;
                  if (page <= 3) pageNum = i + 1;
                  else if (page >= productsData.totalPages - 2) pageNum = productsData.totalPages - 4 + i;
                  else pageNum = page - 2 + i;

                  if (pageNum > 0 && pageNum <= productsData.totalPages) {
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "ghost"}
                        className={`w-10 h-10 p-0 ${page === pageNum ? "pointer-events-none" : ""}`}
                        onClick={() => setPage(pageNum)}
                        aria-label={`Go to page ${pageNum}`}
                        aria-current={page === pageNum ? "page" : undefined}
                      >
                        {pageNum}
                      </Button>
                    );
                  }
                  return null;
                })}
              </div>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(productsData.totalPages, p + 1))}
                disabled={page === productsData.totalPages}
              >
                Next
              </Button>
            </div>
          )}

          {/* Category SEO text block — shown after results */}
          <CategorySeoBlock search={search} category={category} />
        </>
      ) : (
        <div className="text-center py-24 bg-white rounded-xl border border-dashed">
          <h3 className="text-xl font-bold text-foreground mb-2">No products found</h3>
          <p className="text-muted-foreground mb-6">We couldn't find any parts matching your search.</p>
          <Button onClick={clearSearch} variant="outline">Clear Search</Button>
        </div>
      )}
    </div>
  );
}
