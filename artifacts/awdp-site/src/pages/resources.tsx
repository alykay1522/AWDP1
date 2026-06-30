import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  Loader2,
  Ruler,
  Search,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageSeo } from "@/components/page-seo";

interface PdfResource {
  id: number | string;
  title: string;
  brand: string;
  category: string;
  type: string;
  url: string;
  description: string;
  isActive?: boolean;
  sortOrder?: number;
}

const ALL_CATEGORIES = [
  "Casement Windows",
  "Double Hung Windows",
  "Patio Doors",
  "Hardware & Accessories",
  "Support Guides & Balances",
] as const;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  "Measurement Guide": <Ruler className="h-5 w-5" />,
  "Product Catalog": <BookOpen className="h-5 w-5" />,
  "How-To Guide": <HelpCircle className="h-5 w-5" />,
  Reference: <FileText className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  "Casement Windows": {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  "Double Hung Windows": {
    bg: "bg-violet-50",
    text: "text-violet-800",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  "Patio Doors": {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  "Hardware & Accessories": {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "Support Guides & Balances": {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  "Measurement Guide": "bg-sky-100 text-sky-700",
  "Product Catalog": "bg-indigo-100 text-indigo-700",
  "How-To Guide": "bg-teal-100 text-teal-700",
  Reference: "bg-slate-100 text-slate-600",
};

const BASE_URL = "https://www.allwindowdoorparts.com";

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "PDF Resources — Measurement Guides & Part Catalogs",
  description:
    "Archived window and door parts catalogs, measurement guides, diagrams, and technical references.",
  url: `${BASE_URL}/resources`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    {
      "@type": "ListItem",
      position: 2,
      name: "PDF Resources",
      item: `${BASE_URL}/resources`,
    },
  ],
};

export default function Resources() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeType, setActiveType] = useState("All");

  const { data, isLoading, isError, refetch } = useQuery<{
    resources: PdfResource[];
  }>({
    queryKey: ["public-resources"],
    queryFn: async () => {
      const response = await fetch("/api/resources");
      if (!response.ok) throw new Error("Failed to load resources");
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // All resource links now come from the API. The previous hardcoded BiltBest
  // URLs were removed because the original host no longer serves those files.
  const resources = data?.resources ?? [];

  const allTypes = useMemo(
    () => ["All", ...Array.from(new Set(resources.map((resource) => resource.type)))],
    [resources],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesSearch =
        !query ||
        resource.title.toLowerCase().includes(query) ||
        resource.category.toLowerCase().includes(query) ||
        resource.type.toLowerCase().includes(query) ||
        resource.brand.toLowerCase().includes(query) ||
        resource.description.toLowerCase().includes(query);
      const matchesCategory =
        activeCategory === "All" || resource.category === activeCategory;
      const matchesType = activeType === "All" || resource.type === activeType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [activeCategory, activeType, resources, search]);

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("All");
    setActiveType("All");
  };

  const hasActiveFilters =
    Boolean(search) || activeCategory !== "All" || activeType !== "All";

  return (
    <>
      <PageSeo
        title="PDF Resources — Window & Door Parts Catalogs | All Window Door Parts"
        description="Browse archived window and door parts catalogs, measurement guides, diagrams, and technical references."
        path="/resources"
        structuredData={[pageSchema, breadcrumbSchema]}
      />

      <section className="bg-primary px-4 py-10 text-primary-foreground">
        <div className="container mx-auto max-w-4xl">
          <nav className="mb-3 flex items-center gap-1 text-sm text-primary-foreground/60">
            <Link href="/" className="transition-colors hover:text-primary-foreground">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-primary-foreground">PDF Resources</span>
          </nav>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl">
            PDF Resources
          </h1>
          <p className="max-w-2xl text-base text-primary-foreground/80 md:text-lg">
            Recovered window and door parts catalogs, technical diagrams, and
            reference documents. PDFs open from verified archived captures.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-primary-foreground/70">
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {resources.length} documents
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" />
              {ALL_CATEGORIES.length} categories
            </span>
          </div>
        </div>
      </section>

      <section className="sticky top-[var(--nav-height,60px)] z-30 border-b bg-white shadow-sm">
        <div className="container mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <div className="relative max-w-sm flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search brands, guides, catalogs…"
              className="bg-slate-50 pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search PDF resources"
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {allTypes.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setActiveType(type)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeType === type
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:text-primary"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="shrink-0 text-slate-400 hover:text-red-600"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </section>

      <section className="border-b bg-slate-50">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
            {["All", ...ALL_CATEGORIES].map((category) => {
              const colors = category === "All" ? null : CATEGORY_COLORS[category];
              const selected = activeCategory === category;
              const count =
                category === "All"
                  ? resources.length
                  : resources.filter((resource) => resource.category === category).length;

              return (
                <button
                  type="button"
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border border-slate-200 bg-white font-semibold text-primary shadow-sm"
                      : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                  }`}
                >
                  {colors && <span className={`h-2 w-2 rounded-full ${colors.dot}`} />}
                  {category}
                  <span className={`ml-0.5 text-xs ${selected ? "text-primary/60" : "text-slate-400"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <main className="container mx-auto max-w-6xl px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading resources…</span>
          </div>
        ) : isError ? (
          <div className="py-20 text-center">
            <AlertMessage />
            <Button className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-500">No documents match your filters.</p>
            <Button variant="ghost" className="mt-3 text-primary" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <p className="mb-5 text-sm text-muted-foreground">
              Showing <strong>{filtered.length}</strong> of {resources.length} documents
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((pdf) => {
                const colors =
                  CATEGORY_COLORS[pdf.category] ?? CATEGORY_COLORS["Hardware & Accessories"];
                const icon = TYPE_ICONS[pdf.type] ?? TYPE_ICONS.Reference;
                const badge = TYPE_BADGE_COLORS[pdf.type] ?? TYPE_BADGE_COLORS.Reference;

                return (
                  <article
                    key={pdf.id}
                    className={`flex flex-col rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${colors.border}`}
                  >
                    <div className={`h-1 rounded-t-xl ${colors.dot}`} />
                    <div className="flex flex-1 flex-col p-5">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className={`rounded-lg p-2 ${colors.bg}`}>
                          <span className={colors.text}>{icon}</span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge}`}>
                          {pdf.type}
                        </span>
                      </div>
                      <h2 className="mb-1.5 flex-1 text-sm font-semibold leading-snug text-slate-900">
                        {pdf.title}
                      </h2>
                      <p className="mb-4 line-clamp-3 text-xs leading-relaxed text-slate-500">
                        {pdf.description}
                      </p>
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
                          {pdf.category}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">{pdf.brand}</span>
                      </div>
                      <a
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                        aria-label={`Open PDF: ${pdf.title}`}
                      >
                        <FileText className="h-4 w-4" />
                        Open PDF
                        <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-12 flex flex-col items-center gap-6 rounded-2xl border border-primary/20 bg-primary/5 p-6 md:flex-row md:p-8">
          <div className="flex-1">
            <h2 className="mb-1 text-lg font-bold text-primary">Can’t find what you need?</h2>
            <p className="text-sm text-slate-600">
              Upload a photo of your part and our team will help identify it.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/parts-identification"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Free Parts ID Service
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg border border-primary/30 bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

function AlertMessage() {
  return (
    <>
      <FileText className="mx-auto mb-3 h-12 w-12 text-red-300" />
      <p className="font-medium text-slate-700">The PDF library could not be loaded.</p>
      <p className="mt-1 text-sm text-slate-500">Please try again.</p>
    </>
  );
}
