import { Link, useLocation } from "wouter";
import { PackageSearch, Home, ShoppingCart, Phone, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function NotFound() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/shop?search=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center bg-slate-50 py-16 px-4">
      <div className="max-w-lg w-full text-center">
        <div className="text-8xl font-serif font-bold text-slate-200 mb-4 leading-none">404</div>
        <h1 className="text-2xl font-serif font-bold text-slate-900 mb-3">Page Not Found</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          We couldn't find that page — it may have moved or the link may be broken. Try searching for the part you need below.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search for a part"
              placeholder="Search by SKU, brand, or part name…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Button asChild variant="outline">
            <Link href="/"><Home className="w-4 h-4 mr-2" aria-hidden="true" /> Go Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/shop"><ShoppingCart className="w-4 h-4 mr-2" aria-hidden="true" /> Browse Parts</Link>
          </Button>
          <Button asChild className="bg-red-600 hover:bg-red-700 text-white border-0">
            <Link href="/parts-identification"><PackageSearch className="w-4 h-4 mr-2" aria-hidden="true" /> Free Parts ID</Link>
          </Button>
        </div>

        <div className="border-t pt-8 text-sm text-slate-500">
          <p>Still can't find it? Call us — we're happy to help.</p>
          <a href="tel:785-533-0244" className="inline-flex items-center gap-2 text-primary font-bold mt-2 hover:underline">
            <Phone className="w-4 h-4" aria-hidden="true" /> 785-533-0244
          </a>
        </div>
      </div>
    </div>
  );
}
