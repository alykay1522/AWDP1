import { Link } from "wouter";
import { useGetCategories, getGetCategoriesQueryKey } from "@workspace/api-client-react";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { CatalogSeoBlock } from "@/components/category-seo-block";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PackageSearch,
  ChevronRight,
  Layers,
  DoorOpen,
  Lock,
  Wind,
  Wrench,
  SlidersHorizontal,
  Grid3x3,
  Move,
  LayoutGrid,
  Settings,
  Square,
  AlignJustify,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Icon + description for each real category (matched by name)
const CATEGORY_META: Record<string, { Icon: React.ElementType; description: string; label?: string }> = {
  "Window Hardware": {
    Icon: Wrench,
    description: "Operators, cranks, handles, espagnolette rods, and frame hardware for casement, awning, and sliding windows.",
    label: "Window Hardware",
  },
  "Door Hardware": {
    Icon: DoorOpen,
    description: "Rollers, hinges, closers, guides, tracks, handles, and all hardware for sliding and swinging patio doors.",
    label: "Door Hardware",
  },
  "Window Balances": {
    Icon: SlidersHorizontal,
    description: "Channel balances, spiral balances, block-and-tackle systems, and all balance accessories for double-hung windows.",
    label: "Window Balances",
  },
  "Sash Hardware": {
    Icon: Lock,
    description: "Tilt latches, cam locks, sweep locks, sash keepers, and other hardware that attaches directly to the window sash.",
    label: "Sash Hardware",
  },
  "Window Glazing and Weatherstrip": {
    Icon: Wind,
    description: "Glazing seals, weatherstripping, corner seals, urethane seals, and insulating components that keep drafts and moisture out.",
    label: "Glazing & Weatherstrip",
  },
  "Other Hardware": {
    Icon: Settings,
    description: "Specialty hardware including skylights, deer blind windows, and hard-to-categorize replacement parts.",
    label: "Other Hardware",
  },
  "Screen Hardware and Accessories": {
    Icon: Grid3x3,
    description: "Screen frames, corner keys, spline, clips, rollers, and replacement hardware for window and door screens.",
    label: "Screen Hardware",
  },
};

// Curated part-type shortcut tiles (subcategory search shortcuts)
const PART_TYPE_TILES = [
  {
    name: "Window Operators & Cranks",
    desc: "Casement, awning, and sliding window operators — all brands and sizes.",
    href: "/shop?search=casement",
    Icon: Wrench,
  },
  {
    name: "Window Locks & Keepers",
    desc: "Sash locks, cam locks, sweep locks, and keeper hardware.",
    href: "/shop?search=lock",
    Icon: Lock,
  },
  {
    name: "Tilt Latches",
    desc: "Spring-loaded and push-button tilt latches for double-hung windows.",
    href: "/shop?search=latch",
    Icon: RotateCcw,
  },
  {
    name: "Window Balances",
    desc: "Channel, spiral, and block-and-tackle balances — all lengths and weights.",
    href: "/shop?search=balance",
    Icon: SlidersHorizontal,
  },
  {
    name: "Patio Door Rollers",
    desc: "Sliding patio door rollers, guides, and track hardware.",
    href: "/shop?search=roller",
    Icon: Move,
  },
  {
    name: "Hinges & Pivots",
    desc: "Window and door hinges, pivot bars, pivot shoes, and friction hinges.",
    href: "/shop?search=hinge",
    Icon: Layers,
  },
  {
    name: "Weatherstripping & Seals",
    desc: "Glazing seals, urethane strips, corner seals, and weatherstripping.",
    href: "/shop?category=Window+Glazing+and+Weatherstrip",
    Icon: Wind,
  },
  {
    name: "Tracks & Channels",
    desc: "Sash channels, door tracks, balance tracks, and guide channels.",
    href: "/shop?search=track",
    Icon: AlignJustify,
  },
  {
    name: "Window Handles",
    desc: "Fold-down handles, lift rails, casement handles, and operator knobs.",
    href: "/shop?search=handle",
    Icon: Square,
  },
  {
    name: "Screen Hardware",
    desc: "Screen frame corners, spline, clips, rollers, and accessories.",
    href: "/shop?category=Screen+Hardware+and+Accessories",
    Icon: LayoutGrid,
  },
];

export default function Categories() {
  const { data: categoriesRaw, isLoading } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() },
  });

  // Filter out categories with 0 visible products
const categories = (Array.isArray(categoriesRaw) ? categoriesRaw : []).filter((c) => (c.productCount ?? 0) > 0);
  return (
    <div className="bg-slate-50 min-h-screen">
      <PageSeo
        title="Window & Door Parts Categories — Browse by Type"
        path="/categories"
        description="Browse 4,000+ in-stock window and door replacement parts by category: casement operators, sash balances, patio door rollers, sash locks, weatherstripping, glazing seals, and screen hardware. Veteran-owned, 40+ years experience."
        keywords="window parts categories, door hardware categories, window balances, casement operators, sash hardware, door rollers, weatherstripping, screen hardware"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Window & Door Parts Categories",
            description: "Browse replacement parts for windows and doors organized by hardware category.",
            url: "https://www.allwindowdoorparts.com/categories",
            provider: {
              "@type": "Organization",
              name: "All Window Door Parts",
              url: "https://www.allwindowdoorparts.com",
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "How do I identify my window or door part?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Upload a photo using our free Parts ID service and our experts with 40+ years of experience will identify it for you — free, no obligation.",
                },
              },
              {
                "@type": "Question",
                name: "What brands of window and door parts do you carry?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We carry parts compatible with Andersen, Pella, Truth, Marvin, Weather Shield, Milgard, Jeld-Wen, and many other major window and door manufacturers.",
                },
              },
              {
                "@type": "Question",
                name: "Do you carry discontinued or hard-to-find parts?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "Yes. We specialize in hard-to-find, obsolete, and discontinued window and door hardware. With 40+ years of industry experience, we can often source parts that other suppliers cannot.",
                },
              },
              {
                "@type": "Question",
                name: "What if the part does not fit?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "We help you exchange it for the correct part at no additional cost. Contact us at Info@allwindowdoorparts.com or 785-533-0244.",
                },
              },
            ],
          },
        ] as object[]}
      />
      <Breadcrumb items={[{ label: "Parts Categories" }]} />

      {/* Hero */}
      <div className="bg-primary text-white py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <p className="text-blue-200 uppercase tracking-widest text-sm font-semibold mb-4">4,000+ In-Stock Parts</p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 leading-tight">
            Browse Hardware by Category
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Window and door parts organized the way repair professionals think — by category and by part type.
            Browse broadly or jump straight to the specific hardware you need.
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-14 md:py-20 space-y-20">

        {/* ── Main Categories ─────────────────────────────────────── */}
        <section>
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">Browse by Category</h2>
            <p className="text-slate-600">Broad categories covering every type of window and door hardware we carry.</p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(7).fill(0).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-6 border shadow-sm flex flex-col items-center">
                  <Skeleton className="w-16 h-16 rounded-full mb-4" />
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-3" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : categories.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {categories.map((category) => {
                const meta = CATEGORY_META[category.name];
                const Icon = meta?.Icon ?? Wrench;
                const label = meta?.label ?? category.name;
                const desc = meta?.description ?? "";
                return (
                  <Link
                    key={category.id}
                    href={`/shop?category=${encodeURIComponent(category.name)}`}
                    className="group bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg hover:border-primary transition-all flex flex-col relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="w-14 h-14 bg-primary/10 group-hover:bg-primary rounded-xl flex items-center justify-center mb-5 transition-colors">
                        <Icon className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors mb-2 leading-tight">
                        {label}
                      </h3>
                      {desc && (
                        <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-4">{desc}</p>
                      )}
                      <div className="flex items-center justify-between mt-auto">
                        <span className="inline-flex items-center bg-slate-100 group-hover:bg-primary/10 text-slate-600 group-hover:text-primary text-xs font-bold px-3 py-1.5 rounded-full transition-colors">
                          {(category.productCount ?? 0).toLocaleString()} parts
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed">
              <p className="text-slate-500">No categories found.</p>
            </div>
          )}
        </section>

        {/* ── Browse by Part Type ──────────────────────────────────── */}
        <section>
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">Browse by Part Type</h2>
            <p className="text-slate-600">Jump directly to specific hardware types — faster than browsing broad categories.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {PART_TYPE_TILES.map(({ name, desc, href, Icon }) => (
              <Link
                key={name}
                href={href}
                className="group bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md hover:border-primary transition-all flex flex-col gap-3"
              >
                <div className="w-10 h-10 bg-slate-100 group-hover:bg-primary rounded-lg flex items-center justify-center transition-colors">
                  <Icon className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 group-hover:text-primary text-sm leading-snug mb-1 transition-colors">{name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Browse parts <ChevronRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Catalog SEO block ───────────────────────────────────── */}
        <CatalogSeoBlock />

        {/* ── Free Parts ID banner ─────────────────────────────────── */}
        <section className="bg-primary rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-12 md:px-12 md:py-16 text-center max-w-4xl mx-auto">
            <PackageSearch className="w-16 h-16 text-accent mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-6">
              Still can't find what you're looking for?
            </h2>
            <p className="text-blue-100 text-lg mb-8 leading-relaxed">
              Many window and door parts look identical but have critical differences in size, spring tension,
              or attachment style. Our experts — with 40+ years in the field — will identify your exact part
              or the best modern replacement, at no charge.
            </p>
            <Button
              size="lg"
              className="h-14 px-8 text-lg font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg border-0"
              asChild
            >
              <Link href="/parts-identification">
                Use Free Parts Identification <ChevronRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
}
