import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { CategorySeoBlock } from "@/components/category-seo-block";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, SlidersHorizontal, ChevronDown } from "lucide-react";
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

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  "Window Balances": {
    title: "Replacement Window Balances | Channel, Block & Tackle, Spiral — Fast Shipping",
    description: "Shop replacement window balances for vinyl, aluminum, and wood windows. Block & tackle, spiral, constant force, and specialty balances. Fast shipping and expert support.",
  },
  "Door Hardware": {
    title: "Patio Door Rollers | Sliding Door Replacement Wheels — Veteran Owned",
    description: "Find the correct patio door rollers for sliding glass doors. Stainless steel, tandem, nylon, and precision rollers. Identify your part with our free Parts ID service.",
  },
  "Window Hardware": {
    title: "Casement & Awning Window Operators | Truth, EntryGard, Andersen",
    description: "Shop casement and awning window operators from Truth, EntryGard, Andersen, Pella, and more. Left/right handing, split arms, dual arms, and specialty operators.",
  },
  "Window Glazing and Weatherstrip": {
    title: "Weatherstripping for Windows & Doors | Kerf, Foam, Bulb, Fin Seal",
    description: "Replace worn weatherstripping to stop drafts and improve efficiency. Kerf, bulb, fin seal, foam, and OEM-specific profiles.",
  },
  "Sash Hardware": {
    title: "Sash Hardware — Locks, Lifts, Keepers & Tilt Latches",
    description: "Shop sash locks, sash lifts, tilt latches, keepers, and pivot bars for double-hung and single-hung windows. Veteran-owned, 40+ years experience.",
  },
  "Screen Hardware and Accessories": {
    title: "Window Screen Hardware & Frame Parts | Splines, Corners, Frames",
    description: "Replacement screen hardware including spline, screen frame, corner connectors, screen pulls, and retainer. Fits most standard and custom screen frames.",
  },
  "Other Hardware": {
    title: "Window & Door Hardware | Hinges, Pivot Bars & Specialty Parts",
    description: "Hard-to-find window and door hardware including pivot bars, keeper plates, specialty hinges, and discontinued OEM parts. 4,000+ in-stock parts, veteran-owned.",
  },
};

interface FAQ { q: string; a: string }

function buildCategoryFAQs(category: string): FAQ[] {
  const categorySpecific: Record<string, FAQ[]> = {
    "Window Balances": [
      { q: "What types of window balances do you carry?", a: "We carry block and tackle, spiral, constant force, channel, and specialty window balances for vinyl, aluminum, and wood windows." },
      { q: "How do I know what balance tension or weight to order?", a: "The correct balance depends on your sash weight. Use our free Parts ID service with a photo if you need help selecting the right tension." },
    ],
    "Door Hardware": [
      { q: "Do you carry patio door rollers?", a: "Yes. We carry stainless steel, tandem, nylon, and precision rollers for most sliding glass door brands." },
      { q: "How do I identify the correct patio door roller?", a: "Send us a photo of your existing roller using our free Parts ID service and we will identify the correct replacement for you." },
    ],
    "Window Hardware": [
      { q: "Do you carry casement window operators for Truth and EntryGard?", a: "Yes. We carry operators from Truth, EntryGard, Andersen, Pella, and many other manufacturers in both left and right hand configurations." },
      { q: "What is the difference between a split arm and dual arm operator?", a: "Split arm operators have two hinged arms while dual arm operators have parallel arms. The right type depends on your window manufacturer and model." },
    ],
    "Window Glazing and Weatherstrip": [
      { q: "What weatherstripping profiles do you carry?", a: "We carry kerf, bulb, fin seal, foam, and OEM-specific profiles for most window and door brands." },
      { q: "How do I replace worn weatherstripping?", a: "Most weatherstripping removes by pulling from the kerf channel or removing foam tape, then pressing in the replacement. Send us a photo to confirm the correct profile." },
    ],
  };

  const generic: FAQ[] = [
    { q: "How do I identify my window part?", a: "Upload a photo using our free Parts ID service and our experts will identify it for you — free, no obligation." },
    { q: "What if the part does not fit?", a: "We help you exchange it for the correct part at no additional cost. Contact us at Info@allwindowdoorparts.com or 785-533-0244." },
    { q: "Do you ship replacement parts?", a: "Yes. We ship via UPS, FedEx, and USPS. Shipping is calculated at checkout. Some items may require distributor sourcing." },
  ];

  return [...(categorySpecific[category] ?? []), ...generic];
}

function buildFAQSchema(faqs: FAQ[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

function buildPageMeta(search: string, category: string) {
  if (category && CATEGORY_META[category]) {
    return CATEGORY_META[category];
  }
  if (category) {
    return {
      title: `${category} Parts | Window & Door Hardware`,
      description: `Shop ${category} replacement parts. Hard-to-find & OEM-specific hardware for all major brands. Veteran-owned, 40+ years experience. Expert support available.`,
    };
  }
  if (search) {
    return {
      title: `"${search}" – Window & Door Parts Search Results`,
      description: `Search results for "${search}" at All Window Door Parts. Find exact replacement window and door parts. 4,000+ in-stock hardware including hard-to-find items. Veteran-owned, 40+ years expertise.`,
    };
  }
  return {
    title: "Shop Window & Door Parts | 4,000+ In-Stock Hardware",
    description: "Shop 4,000+ window and door replacement parts: casement operators, balances, locks, rollers, weatherstripping. Hard-to-find & obsolete parts. Veteran-owned, 40+ years. Fast shipping.",
  };
}

interface ProductsResponse {
  products: Array<{
    id: number; sku: string; name: string; price: string;
    category: string; inStock: boolean; imageUrl: string | null;
    originalPrice?: string | null; description?: string | null;
    supplier?: string | null; subcategory?: string | null;
    compatibleBrands?: string[] | null; specifications?: Record<string, string> | null;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function useFilteredProducts(params: {
  search?: string; category?: string; minPrice?: number; maxPrice?: number;
  inStockOnly?: boolean; page: number; limit: number; sort: string;
}) {
  return useQuery<ProductsResponse>({
    queryKey: ["shop-products", params],
    queryFn: async () => {
      const q = new URLSearchParams();
      q.set("page", String(params.page));
      q.set("limit", String(params.limit));
      q.set("sort", params.sort);
      q.set("dedup", "true");
      if (params.search)     q.set("search",      params.search);
      if (params.category)   q.set("category",    params.category);
      if (params.minPrice)   q.set("minPrice",    String(params.minPrice));
      if (params.maxPrice)   q.set("maxPrice",    String(params.maxPrice));
      if (params.inStockOnly) q.set("inStockOnly", "true");
      const res = await fetch(`/api/products?${q}`);
      if (!res.ok) throw new Error("Failed to load products");
      return res.json();
    },
    placeholderData: (prev) => prev,
    retry: 3,
  });
}

export default function Shop() {
  const [, navigate] = useLocation();
  const rawSearch = useSearch();

  const urlParams   = new URLSearchParams(rawSearch);
  const urlSearch   = urlParams.get("search")   ?? "";
  const urlCategory = urlParams.get("category") ?? "";

  const [searchInput, setSearchInput]   = useState(urlSearch);
  const [page, setPage]                 = useState(1);
  const [sort, setSort]                 = useState("newest");

  // ── New filter state ──────────────────────────────────────────────────────
  const [minPriceInput, setMinPriceInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | undefined>();
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | undefined>();
  const [inStockOnly, setInStockOnly]     = useState(false);
  const [filterOpen, setFilterOpen]       = useState(false);
  const priceApplied = appliedMinPrice !== undefined || appliedMaxPrice !== undefined;

  // Search autocomplete
  const [suggestions, setSuggestions]       = useState<string[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchInput(urlSearch);
    setPage(1);
  }, [urlSearch]);

  useEffect(() => {
    setPage(1);
  }, [urlCategory, inStockOnly, appliedMinPrice, appliedMaxPrice]);

  const { data: productsData, isLoading, isError, error } = useFilteredProducts({
    search:      urlSearch   || undefined,
    category:    urlCategory || undefined,
    minPrice:    appliedMinPrice,
    maxPrice:    appliedMaxPrice,
    inStockOnly: inStockOnly || undefined,
    page,
    limit: 24,
    sort,
  });

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (suggDebounce.current) clearTimeout(suggDebounce.current);
    if (val.length >= 2) {
      suggDebounce.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/products/search-suggestions?q=${encodeURIComponent(val)}`);
          const raw = await res.json();
const data = Array.isArray(raw) ? raw : [];
setSuggestions(data);
setSuggestionsOpen(data.length > 0);
        } catch { /* ignore */ }
      }, 280);
    } else {
      setSuggestions([]);
      setSuggestionsOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuggestionsOpen(false);
    const q = searchInput.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  };

  const clearSearch = () => {
    setSearchInput("");
    setSuggestionsOpen(false);
    setAppliedMinPrice(undefined);
    setAppliedMaxPrice(undefined);
    setMinPriceInput("");
    setMaxPriceInput("");
    setInStockOnly(false);
    navigate("/shop");
  };

  const applyPriceFilter = () => {
    const mn = minPriceInput ? Number(minPriceInput) : undefined;
    const mx = maxPriceInput ? Number(maxPriceInput) : undefined;
    setAppliedMinPrice(isNaN(mn as number) ? undefined : mn);
    setAppliedMaxPrice(isNaN(mx as number) ? undefined : mx);
    setPage(1);
    setFilterOpen(false);
  };

  const clearPriceFilter = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setAppliedMinPrice(undefined);
    setAppliedMaxPrice(undefined);
    setPage(1);
  };

  const { title: seoTitle, description: seoDesc } = buildPageMeta(urlSearch, urlCategory);

  const activeLabel = urlCategory
    ? urlCategory
    : urlSearch
    ? `"${urlSearch}"`
    : null;

  const breadcrumbItems = [
    { label: "Shop Parts", href: "/shop" as const },
    ...(urlCategory ? [{ label: urlCategory }] :
       urlSearch  ? [{ label: `"${urlSearch}"` }] : []),
  ];

  const hasActiveFilters = inStockOnly || priceApplied;

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <div className="container mx-auto px-4 py-8 md:py-12">
      <PageSeo
        title={seoTitle}
        path="/shop"
        description={seoDesc}
        structuredData={urlCategory ? buildFAQSchema(buildCategoryFAQs(urlCategory)) : undefined}
      />

      {/* Order minimum notice */}
      <div className="mb-6 flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-4 py-3 text-sm font-semibold">
        <span className="text-amber-600 text-base leading-none" aria-hidden="true">!</span>
        $50 order minimum — orders below $50 may require additional handling; we'll contact you first
      </div>

      <div className="flex gap-8 items-start">

        {/* ── LEFT SIDEBAR ── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-4">

            {/* Categories */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
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
                ))
              </nav>
            </div>

            {/* Filters */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <button
                type="button"
                className="w-full px-4 py-3 border-b bg-slate-50 flex items-center justify-between"
                onClick={() => setFilterOpen(!filterOpen)}
                aria-expanded={filterOpen}
              >
                <h2 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  Filters
                  {hasActiveFilters && <span className="ml-1 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{(inStockOnly ? 1 : 0) + (priceApplied ? 1 : 0)}</span>}
                </h2>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${filterOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>

              {filterOpen && (
                <div className="p-4 space-y-5">
                  {/* In Stock toggle */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div
                      role="checkbox"
                      aria-checked={inStockOnly}
                      tabIndex={0}
                      onClick={() => { setInStockOnly(!inStockOnly); setPage(1); }}
                      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { setInStockOnly(!inStockOnly); setPage(1); } }}
                      className={`w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 relative ${inStockOnly ? "bg-primary" : "bg-slate-200"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inStockOnly ? "translate-x-5" : ""}`} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">In Stock Only</span>
                  </label>

                  {/* Price range */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Price Range</p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Min"
                          value={minPriceInput}
                          onChange={(e) => setMinPriceInput(e.target.value)}
                          className="pl-6 text-sm h-9"
                          aria-label="Minimum price"
                        />
                      </div>
                      <span className="text-slate-400 text-sm">–</span>
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Max"
                          value={maxPriceInput}
                          onChange={(e) => setMaxPriceInput(e.target.value)}
                          className="pl-6 text-sm h-9"
                          aria-label="Maximum price"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={applyPriceFilter}>Apply</Button>
                      {priceApplied && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs px-2 text-destructive hover:text-destructive" onClick={clearPriceFilter}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {priceApplied && (
                      <p className="text-xs text-primary font-medium mt-1.5">
                        {appliedMinPrice !== undefined ? `$${appliedMinPrice}` : ""}
                        {appliedMinPrice !== undefined && appliedMaxPrice !== undefined ? " – " : ""}
                        {appliedMaxPrice !== undefined ? `$${appliedMaxPrice}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                {hasActiveFilters && <span className="ml-2 text-primary font-semibold text-sm">(filtered)</span>}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Search with autocomplete */}
              <div className="relative" ref={suggestionsRef}>
                <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                  <Input
                    type="search"
                    placeholder="Search parts…"
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => { if (suggestions.length > 0) setSuggestionsOpen(true); }}
                    onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                    className="pl-9 pr-10 bg-white w-64"
                    aria-label="Search parts"
                    aria-autocomplete="list"
                    aria-expanded={suggestionsOpen}
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

                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-slate-100 py-1 z-50 text-sm">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-2"
                        onMouseDown={() => {
                          setSearchInput(s);
                          setSuggestionsOpen(false);
                          navigate(`/shop?search=${encodeURIComponent(s)}`);
                        }}
                      >
                        <Search className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                        {s}
                      </button>
                    ))
                  </div>
                )}
              </div>

              {(urlSearch || urlCategory || hasActiveFilters) && (
                <Button variant="ghost" size="sm" onClick={clearSearch} className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2">
                  <X className="w-4 h-4 mr-1" aria-hidden="true" /> Clear All
                </Button>
              )}

              {/* Mobile filter toggle */}
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden flex items-center gap-1.5"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Filters
                {hasActiveFilters && <span className="bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{(inStockOnly ? 1 : 0) + (priceApplied ? 1 : 0)}</span>}
              </Button>

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

          {/* Mobile filter panel */}
          {filterOpen && (
            <div className="lg:hidden bg-white border rounded-xl p-4 mb-6 space-y-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">Filters</h3>
                <button type="button" onClick={() => setFilterOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  role="checkbox"
                  aria-checked={inStockOnly}
                  tabIndex={0}
                  onClick={() => { setInStockOnly(!inStockOnly); setPage(1); }}
                  onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { setInStockOnly(!inStockOnly); setPage(1); } }}
                  className={`w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 relative ${inStockOnly ? "bg-primary" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${inStockOnly ? "translate-x-5" : ""}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">In Stock Only</span>
              </label>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Price Range</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" min="0" placeholder="Min" value={minPriceInput} onChange={(e) => setMinPriceInput(e.target.value)} className="pl-6 text-sm h-9" aria-label="Minimum price" />
                  </div>
                  <span className="text-slate-400 text-sm">–</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" min="0" placeholder="Max" value={maxPriceInput} onChange={(e) => setMaxPriceInput(e.target.value)} className="pl-6 text-sm h-9" aria-label="Maximum price" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={applyPriceFilter}>Apply Price</Button>
                  {priceApplied && <Button size="sm" variant="ghost" className="h-8 text-xs px-2 text-destructive" onClick={clearPriceFilter}><X className="w-3.5 h-3.5" /></Button>}
                </div>
              </div>
            </div>
          )}

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
          ) : (Array.isArray(productsData?.products) && productsData.products.length > 0 ? (
            productsData.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
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
              <p className="text-muted-foreground mb-6">We couldn't find any parts matching your search{hasActiveFilters ? " with the current filters" : ""}.</p>
              <Button onClick={clearSearch} variant="outline">Clear Filters</Button>
            </div>
          )}

        </div>
      </div>
    </div>
    </>
  );
}
