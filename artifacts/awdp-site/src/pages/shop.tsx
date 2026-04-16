import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { CategorySeoBlock } from "@/components/category-seo-block";
import { useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

const CATEGORIES = [
  "Window Balances",
  "Window Hardware",
  "Sash Hardware",
  "Door Hardware",
  "Window Glazing and Weatherstrip",
  "Screen Hardware and Accessories",
  "Other Hardware",
];

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
  const [, navigate] = useLocation();
  const rawSearch = useSearch();

  const urlParams   = new URLSearchParams(rawSearch);
  const urlSearch   = urlParams.get("search")   ?? "";
  const urlCategory = urlParams.get("category") ?? "";

  const [searchInput, setSearchInput] = useState(urlSearch);
  const [page, setPage]               = useState(1);
  const [sort, setSort]               = useState("newest");

  useEffect(() => {
    setSearchInput(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    setPage(1);
  }, [urlCategory]);

  const { data: productsData, isLoading, isError, error } = useGetProducts({
    search:   urlSearch   || undefined,
    category: urlCategory || undefined,
    page,
    limit: 24,
    sort,
  }, {
    query: {
      queryKey: getGetProductsQueryKey({
        search:   urlSearch   || undefined,
        category: urlCategory || undefined,
        page,
        limit: 24,
        sort,
      }),
      retry: 3,
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  };

  const clearSearch = () => {
    setSearchInput("");
    navigate("/shop");
  };

  const { title: seoTitle, description: seoDesc } = buildPageMeta(urlSearch, urlCategory);

  const activeLabel = urlCategory
    ? urlCategory
    : urlSearch
    ? `"${urlSearch}"`
    : null;

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <PageSeo title={seoTitle} path="/shop" description={seoDesc} />

      {/* Order minimum notice */}
      <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-3 text-sm font-semibold">
        <span className="text-amber-600 text-base leading-none" aria-hidden="true">!</span>
        $50 minimum on all orders &mdash; Anything below $50 will be cancelled
      </div>

      <div className="flex gap-8 items-start">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-24 bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Categories
              </h2>
            </div>
            <nav className="p-2 space-y-0.5">
              <Link
                href="/shop"
                onClick={() => { setSearchInput(""); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  !urlCategory && !urlSearch
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                All Parts
              </Link>
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={`/shop?category=${encodeURIComponent(cat)}`}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors leading-tight ${
                    urlCategory === cat
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {cat}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0">

          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b pb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
                {urlCategory ? urlCategory : "Shop Parts"}
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">
                {productsData?.total
                  ? `${productsData.total.toLocaleString()} parts found`
                  : isLoading ? "Loading…" : "0 parts found"}
                {activeLabel && ` for ${activeLabel}`}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <Input
                  type="search"
                  placeholder="Search parts…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-10 bg-white w-56"
                  aria-label="Search parts"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Submit search"
                >
                  <Search className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </form>
              {(urlSearch || urlCategory) && (
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

          {/* Mobile category pills */}
          <div className="flex lg:hidden gap-2 flex-wrap mb-6">
            <Link
              href="/shop"
              onClick={() => setSearchInput("")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                !urlCategory && !urlSearch
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-slate-700 border-slate-200 hover:border-primary"
              }`}
            >
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={`/shop?category=${encodeURIComponent(cat)}`}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  urlCategory === cat
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-700 border-slate-200 hover:border-primary"
                }`}
              >
                {cat}
              </Link>
            ))}
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
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

              <CategorySeoBlock search={urlSearch} category={urlCategory} />
            </>
          ) : (
            <div className="text-center py-24 bg-white rounded-xl border border-dashed">
              <h3 className="text-xl font-bold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground mb-6">We couldn't find any parts matching your search.</p>
              <Button onClick={clearSearch} variant="outline">Clear Search</Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
