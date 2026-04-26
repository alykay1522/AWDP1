import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink, Search, X, Ruler, BookOpen, HelpCircle, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageSeo } from "@/components/page-seo";

// ── PDF Catalog Data ──────────────────────────────────────────────────────────

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

const PDF_RESOURCES: PdfResource[] = [
  {
    id: "casement-sash-no-glass",
    title: "How To Measure — Casement Sash Frame (No Glass)",
    brand: "BiltBest",
    category: "Casement Windows",
    type: "Measurement Guide",
    url: "https://www.biltbestwindowparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20NO%20Glass.pdf",
    description: "Step-by-step instructions for measuring a BiltBest casement sash frame without glass. Includes width, height, and corner tolerances.",
  },
  {
    id: "casement-sash-with-glass",
    title: "How To Measure — Casement Sash Frame (With Glass)",
    brand: "BiltBest",
    category: "Casement Windows",
    type: "Measurement Guide",
    url: "https://www.biltbestwindowparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Casement%20Sash%20Frame%20With%20Glass.pdf",
    description: "Measurement guide for BiltBest casement sash frames with glass still installed. Shows glass-inclusive dimension reference points.",
  },
  {
    id: "casement-sill-stop",
    title: "How To Measure — Casement Sill Stop Right-Hand Operator Cover",
    brand: "BiltBest",
    category: "Casement Windows",
    type: "Measurement Guide",
    url: "https://www.biltbestwindowparts.com/pdf/Casement%20Sill%20Stop%20PDF.pdf",
    description: "Measurement and identification guide for BiltBest casement sill stop and right-hand operator cover components.",
  },
  {
    id: "casement-catalog",
    title: "BiltBest Casement Window Parts Catalog",
    brand: "BiltBest",
    category: "Casement Windows",
    type: "Product Catalog",
    url: "https://www.biltbestwindowparts.com/pdf/BiltBestCasement.pdf",
    description: "Complete BiltBest casement window parts collection — operators, hinges, sash hardware, locks, and replacement sash components.",
  },
  {
    id: "dh-jambliner",
    title: "How To Measure — Double Hung Jambliner",
    brand: "BiltBest",
    category: "Double Hung Windows",
    type: "Measurement Guide",
    url: "https://www.biltbestwindowparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Double%20Hung%20Jambliner.pdf",
    description: "Detailed instructions for measuring a BiltBest double hung jambliner, including channel width, pocket depth, and sash clearance.",
  },
  {
    id: "dh-sash-frames",
    title: "How To Measure — Double Hung Sash Frames",
    brand: "BiltBest",
    category: "Double Hung Windows",
    type: "Measurement Guide",
    url: "https://www.biltbestwindowparts.com/pdf/How%20To%20Measure%20-%20BiltBest%20Double%20Hung%20Sash%20Frames.pdf",
    description: "Step-by-step sash frame measurement guide for BiltBest double hung windows — width, height, and corner style identification.",
  },
  {
    id: "dh-catalog",
    title: "BiltBest Double Hung Window Parts Catalog",
    brand: "BiltBest",
    category: "Double Hung Windows",
    type: "Product Catalog",
    url: "https://www.biltbestwindowparts.com/pdf/BiltBestDH.pdf",
    description: "Full BiltBest double hung window parts collection — balances, tilt latches, jamb liners, sash locks, and meeting rail hardware.",
  },
  {
    id: "patio-door-catalog",
    title: "BiltBest Patio Door Parts Catalog",
    brand: "BiltBest",
    category: "Patio Doors",
    type: "Product Catalog",
    url: "https://www.biltbestwindowparts.com/pdf/BiltBestPD.pdf",
    description: "Comprehensive patio door parts catalog — rollers, handles, locks, tracks, screen hardware, and replacement door components.",
  },
  {
    id: "oldach-patio-door-catalog",
    title: "Oldach Parts — Patio Door Hardware Catalog",
    brand: "Oldach",
    category: "Patio Doors",
    type: "Product Catalog",
    url: "/api/storage/public-objects/resources/oldach-patio-door-catalog.pdf",
    description: "Full Oldach patio door hardware catalog — rollers, handles, locks, tracks, and accessories. Note: SKUs in this catalog use the 'AWDP-' prefix on AllWindowDoorParts.com.",
  },
  {
    id: "angellock-vent-lock",
    title: "AngelLock Window Vent Lock",
    brand: "BiltBest",
    category: "Hardware & Accessories",
    type: "Reference",
    url: "https://www.biltbestwindowparts.com/pdf/Angel%20Ventlock.pdf",
    description: "Reference sheet for AngelLock vent lock hardware — dimensions, installation positions, and compatible window types.",
  },
  {
    id: "sash-support-guide",
    title: "Window Sash Support Guide — Spring, Channel, Block & Tackle, Tube Balances",
    brand: "BiltBest",
    category: "Support Guides & Balances",
    type: "How-To Guide",
    url: "https://www.biltbestwindowparts.com/pdf/how_to_window_sash_support.pdf",
    description: "Comprehensive guide to window sash support systems: spring balances, channel balances, block & tackle, and tube balances — how to identify and measure each type.",
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  "Casement Windows",
  "Double Hung Windows",
  "Patio Doors",
  "Hardware & Accessories",
  "Support Guides & Balances",
] as const;

const TYPE_ICONS: Record<PdfResource["type"], React.ReactNode> = {
  "Measurement Guide": <Ruler className="w-5 h-5" />,
  "Product Catalog":  <BookOpen className="w-5 h-5" />,
  "How-To Guide":     <HelpCircle className="w-5 h-5" />,
  "Reference":        <FileText className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  "Casement Windows":        { bg: "bg-blue-50",    text: "text-blue-800",   border: "border-blue-200",  dot: "bg-blue-500" },
  "Double Hung Windows":     { bg: "bg-violet-50",  text: "text-violet-800", border: "border-violet-200", dot: "bg-violet-500" },
  "Patio Doors":             { bg: "bg-amber-50",   text: "text-amber-800",  border: "border-amber-200", dot: "bg-amber-500" },
  "Hardware & Accessories":  { bg: "bg-emerald-50", text: "text-emerald-800",border: "border-emerald-200",dot: "bg-emerald-500" },
  "Support Guides & Balances": { bg: "bg-rose-50",  text: "text-rose-800",  border: "border-rose-200",  dot: "bg-rose-500" },
};

const TYPE_BADGE_COLORS: Record<PdfResource["type"], string> = {
  "Measurement Guide": "bg-sky-100 text-sky-700",
  "Product Catalog":   "bg-indigo-100 text-indigo-700",
  "How-To Guide":      "bg-teal-100 text-teal-700",
  "Reference":         "bg-slate-100 text-slate-600",
};

// ── Schemas ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://www.allwindowdoorparts.com";

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "PDF Resources — Measurement Guides & Part Catalogs",
  description:
    "Free PDF measurement guides, product catalogs, and how-to references for BiltBest window and door replacement parts.",
  url: `${BASE_URL}/resources`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "PDF Resources", item: `${BASE_URL}/resources` },
  ],
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function Resources() {
  const [search, setSearch]   = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeType, setActiveType]         = useState<string>("All");

  const { data, isLoading } = useQuery<{ resources: PdfResource[] }>({
    queryKey: ["public-resources"],
    queryFn: async () => {
      const res = await fetch("/api/resources");
      if (!res.ok) throw new Error("Failed to load resources");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const resources = data?.resources ?? [];

  const allTypes = useMemo(
    () => ["All", ...Array.from(new Set(resources.map((r) => r.type)))],
    [resources]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return resources.filter((r) => {
      const matchesSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q) ||
        r.brand.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      const matchesCategory = activeCategory === "All" || r.category === activeCategory;
      const matchesType     = activeType === "All"     || r.type === activeType;
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [search, activeCategory, activeType, resources]);

  const clearFilters = () => {
    setSearch("");
    setActiveCategory("All");
    setActiveType("All");
  };

  const hasActiveFilters = search || activeCategory !== "All" || activeType !== "All";

  return (
    <>
      <PageSeo
        title="PDF Resources — Measurement Guides & Part Catalogs | All Window Door Parts"
        description="Free PDF measurement guides, product catalogs, and how-to references for BiltBest casement, double hung, and patio door replacement parts."
        canonical="/resources"
        schemaMarkup={[pageSchema, breadcrumbSchema]}
      />

      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <nav className="text-primary-foreground/60 text-sm mb-3 flex items-center gap-1">
            <Link href="/" className="hover:text-primary-foreground transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary-foreground">PDF Resources</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            PDF Resources
          </h1>
          <p className="text-primary-foreground/80 text-base md:text-lg max-w-2xl">
            Free measurement guides, product catalogs, and how-to references for window and door replacement parts.
            Download or view in your browser.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-primary-foreground/70">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              {PDF_RESOURCES.length} documents
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {ALL_CATEGORIES.length} categories
            </span>
          </div>
        </div>
      </section>

      {/* Filter bar */}
      <section className="bg-white border-b shadow-sm sticky top-[var(--nav-height,60px)] z-30">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search guides, catalogs…"
              className="pl-9 bg-slate-50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search PDF resources"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {allTypes.map((t) => (
              <button
                key={t}
                onClick={() => setActiveType(t)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  activeType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-primary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-red-600 shrink-0">
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>
      </section>

      {/* Category tabs */}
      <section className="bg-slate-50 border-b">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
            {["All", ...ALL_CATEGORIES].map((cat) => {
              const colors = cat !== "All" ? CATEGORY_COLORS[cat] : null;
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white shadow-sm border border-slate-200 text-primary font-semibold"
                      : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                  }`}
                >
                  {colors && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} aria-hidden="true" />
                  )}
                  {cat}
                  <span className={`text-xs ml-0.5 ${isActive ? "text-primary/60" : "text-slate-400"}`}>
                    ({cat === "All" ? PDF_RESOURCES.length : PDF_RESOURCES.filter((r) => r.category === cat).length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="container mx-auto max-w-6xl px-4 py-8">

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading resources…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">No documents match your filters.</p>
            <Button variant="ghost" className="mt-3 text-primary" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              Showing <strong>{filtered.length}</strong> of {resources.length} documents
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((pdf) => {
                const colors = CATEGORY_COLORS[pdf.category] ?? CATEGORY_COLORS["Hardware & Accessories"];
                return (
                  <article
                    key={pdf.id}
                    className={`bg-white rounded-xl border ${colors.border} shadow-sm hover:shadow-md transition-shadow flex flex-col`}
                  >
                    {/* Color-coded category bar */}
                    <div className={`h-1 rounded-t-xl ${colors.dot}`} />

                    <div className="p-5 flex flex-col flex-1">
                      {/* Icon + badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                          <span className={colors.text}>
                            {TYPE_ICONS[pdf.type]}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_BADGE_COLORS[pdf.type]}`}>
                            {pdf.type}
                          </span>
                        </div>
                      </div>

                      {/* Title */}
                      <h2 className="font-semibold text-slate-900 leading-snug text-sm mb-1.5 flex-1">
                        {pdf.title}
                      </h2>

                      {/* Description */}
                      <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-3">
                        {pdf.description}
                      </p>

                      {/* Category chip + brand */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                          {pdf.category}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{pdf.brand}</span>
                      </div>

                      {/* CTA */}
                      <a
                        href={pdf.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                        aria-label={`Open PDF: ${pdf.title}`}
                      >
                        <FileText className="w-4 h-4" />
                        Open PDF
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {/* Help CTA */}
        <div className="mt-12 bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-primary mb-1">Can't find what you need?</h2>
            <p className="text-slate-600 text-sm">
              Upload a photo of your part and our team will identify it for free — most requests answered within one business day.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              href="/parts-identification"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Free Parts ID Service
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-primary/30 text-primary font-semibold rounded-lg hover:bg-primary/5 transition-colors text-sm"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
