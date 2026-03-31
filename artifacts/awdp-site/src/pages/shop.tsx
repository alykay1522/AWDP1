import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetProducts, getGetProductsQueryKey, useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, X, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Shop() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState<string | undefined>(searchParams.get("category") || undefined);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("newest");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // Sync URL search to state when navigation happens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSearch = params.get("search");
    if (urlSearch !== null && urlSearch !== search) {
      setSearch(urlSearch);
      setSearchInput(urlSearch);
    }
  }, [location]);

  const { data: productsData, isLoading } = useGetProducts({
    search: search || undefined,
    category: category || undefined,
    page,
    limit: 12,
    sort,
  }, {
    query: {
      queryKey: getGetProductsQueryKey({
        search: search || undefined,
        category: category || undefined,
        page,
        limit: 12,
        sort,
      }),
      keepPreviousData: true,
    }
  });

  const { data: categories } = useGetCategories({
    query: {
      queryKey: getGetCategoriesQueryKey(),
    }
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setCategory(undefined);
    setPage(1);
  };

  const FilterContent = () => (
    <div className="space-y-8">
      <div>
        <h3 className="font-serif font-bold text-lg mb-4 text-foreground">Categories</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="cat-all" 
              checked={!category}
              onCheckedChange={() => { setCategory(undefined); setPage(1); }}
            />
            <label htmlFor="cat-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
              All Parts
            </label>
          </div>
          {categories?.map((c) => (
            <div key={c.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`cat-${c.id}`} 
                checked={category === c.name}
                onCheckedChange={() => { setCategory(c.name); setPage(1); }}
              />
              <label htmlFor={`cat-${c.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 flex justify-between">
                <span>{c.name}</span>
                <span className="text-muted-foreground text-xs">{c.productCount}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-serif font-bold text-lg mb-4 text-foreground">Availability</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox id="instock" defaultChecked />
            <label htmlFor="instock" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
              In Stock Only
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Shop Parts</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            {productsData?.total ? `${productsData.total} products found` : 'Loading products...'}
            {category && ` in ${category}`}
            {search && ` matching "${search}"`}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Sheet open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="md:hidden">
                <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader className="mb-6">
                <SheetTitle className="font-serif text-xl text-left">Filters</SheetTitle>
              </SheetHeader>
              <FilterContent />
            </SheetContent>
          </Sheet>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[180px] bg-white">
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

      <div className="flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 shrink-0">
          <div className="sticky top-24 space-y-8">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Input
                type="search"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-white"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </form>
            
            {(search || category) && (
              <Button variant="ghost" onClick={clearFilters} className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 justify-start h-8 px-2 -mt-4">
                <X className="w-4 h-4 mr-2" /> Clear Filters
              </Button>
            )}

            <FilterContent />
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col gap-4 bg-white p-4 rounded-lg border">
                  <Skeleton className="h-[200px] w-full rounded-md" />
                  <Skeleton className="h-4 w-1/4 mt-2" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-6 w-1/3 mt-auto" />
                </div>
              ))}
            </div>
          ) : productsData?.products.length ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      // Simple logic to show a window around current page
                      let pageNum = page;
                      if (page <= 3) pageNum = i + 1;
                      else if (page >= productsData.totalPages - 2) pageNum = productsData.totalPages - 4 + i;
                      else pageNum = page - 2 + i;
                      
                      if (pageNum > 0 && pageNum <= productsData.totalPages) {
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "ghost"}
                            className={`w-10 h-10 p-0 ${page === pageNum ? 'pointer-events-none' : ''}`}
                            onClick={() => setPage(pageNum)}
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
            </>
          ) : (
            <div className="text-center py-24 bg-white rounded-xl border border-dashed">
              <Filter className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground mb-6">We couldn't find any parts matching your current filters.</p>
              <Button onClick={clearFilters} variant="outline">Clear All Filters</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
