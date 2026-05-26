import { Link } from "wouter";
import { Shield, ChevronRight, PackageSearch, Star, CheckCircle2, Award, Quote, Wrench, Lock, Wind, Droplets, ArrowUp, Move, LayoutGrid, Key, Truck, Layers, SlidersHorizontal, Mail, Box, RotateCcw, PanelLeft, ArrowDownToLine, ChevronDown, Phone } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { useGetFeaturedProducts, getGetFeaturedProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import heroBg from "@assets/hero_hardware_bg.png";
import heroBgWebp from "@assets/hero_hardware_bg.webp";
import ctaBg from "@assets/cta_hardware_bg.png";
import ctaBgWebp from "@assets/cta_hardware_bg.webp";
import { SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_MAILTO } from "@/lib/siteContact";

const BASE_URL = "https://www.allwindowdoorparts.com";

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "All Window Door Parts",
  url: BASE_URL,
  description: "Veteran-owned supplier of 4,000+ in-stock window and door replacement parts with over 40 years of industry experience.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/shop?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${BASE_URL}/#organization`,
  name: "All Window Door Parts",
  url: BASE_URL,
  logo: `${BASE_URL}/opengraph.jpg`,
  image: `${BASE_URL}/opengraph.jpg`,
  telephone: "+17855330244",
  email: SITE_CUSTOMER_EMAIL,
  description: "Veteran-owned supplier of replacement window and door hardware with over 40 years of industry experience. Specialists in obsolete and hard-to-find parts including casement operators, sash balances, patio door rollers, locks, weatherstripping, and more.",
  priceRange: "$$",
  foundingDate: "1984",
  areaServed: { "@type": "Country", name: "United States" },
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "17:00",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+17855330244",
    contactType: "customer service",
    email: SITE_CUSTOMER_EMAIL,
    availableLanguage: "English",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Window & Door Hardware Parts",
    numberOfItems: 4009,
  },
  knowsAbout: [
    "Casement window operators",
    "Window sash balances",
    "Channel balances",
    "Patio door rollers",
    "Window locks and latches",
    "Weatherstripping",
    "Door hinges",
    "Window hardware replacement",
    "Tilt window balances",
    "Spiral tube balances",
    "Multipoint locking systems",
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the Free Parts Identification service work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: `Send us photos of the part you need to identify at ${SITE_CUSTOMER_EMAIL} or through our online form. Our experts with decades of industry experience will identify the part and send you a direct link to purchase the exact replacement — completely free with no obligation.`,
      },
    },
    {
      "@type": "Question",
      name: "Do you carry obsolete or discontinued window and door parts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — we specialize in hard-to-find, obsolete, and brand-specific parts. With over 40 years of experience and 4,000+ in-stock parts, if they made it, we can almost always find it. Our Free Parts ID service helps us locate even the most obscure parts.",
      },
    },
    {
      "@type": "Question",
      name: "What brands of window and door hardware do you carry?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We carry parts for most major window and door manufacturers including Truth Hardware (EntryGard, Encore, Maxim, Dyad, Ranger), Andersen, Pella, Marvin, Wright Products, Prime Line, Rusco, and many more — including obscure regional and custom brands.",
      },
    },
    {
      "@type": "Question",
      name: "How do I find the right window balance size?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Window balance sizing depends on the balance type and channel length. For channel balances, measure the channel length inside the window frame (typically the distance from the top sill to the bottom of the channel) and match it to the nearest standard size. For spiral tube balances, measure the tube length. If you're unsure, use our Free Parts ID service — send us a photo and we'll identify the exact replacement.",
      },
    },
    {
      "@type": "Question",
      name: "How do I replace a casement window operator?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "To replace a casement window operator, first identify the brand (usually stamped on the operator housing) and note whether it's a left-hand or right-hand unit. Remove the window screen, detach the sash arm from the sash, unscrew the old operator from the frame, and install the new one in reverse order. If you need help identifying the correct replacement, call us at 785-533-0244 or use our Free Parts ID service.",
      },
    },
    {
      "@type": "Question",
      name: "What is the minimum order amount?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our minimum order is $50. Orders below $50 may require additional handling charges and we will contact you before processing.",
      },
    },
    {
      "@type": "Question",
      name: "How long does shipping take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Shipping is calculated at checkout based on your delivery address and package details. We ship via UPS, FedEx, and USPS. Standard shipping takes 3-5 business days from the ship date. Not all items ship immediately — some parts must be sourced from our distributors first, and we will contact you if additional lead time is needed.",
      },
    },
    {
      "@type": "Question",
      name: "Do you ship window and door parts nationwide?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — All Window Door Parts ships to all 50 states across the United States. Shipping costs are calculated at checkout based on your delivery address, package weight, and dimensions.",
      },
    },
  ],
};

const FAQ_ITEMS = [
  {
    q: "How does the Free Parts Identification service work?",
    a: `Send us photos of the part you need to ${SITE_CUSTOMER_EMAIL} or through our online form. Our experts with decades of industry experience will identify the part and send you a direct link to purchase the exact replacement — completely free with no obligation.`,
  },
  {
    q: "Do you carry obsolete or discontinued window and door parts?",
    a: "Yes — we specialize in hard-to-find, obsolete, and brand-specific parts. With over 40 years of experience and 4,000+ in-stock parts, if they made it, we can almost always find it.",
  },
  {
    q: "What brands of window and door hardware do you carry?",
    a: "We carry parts for most major manufacturers including Truth Hardware (EntryGard, Encore, Maxim, Dyad, Ranger), Andersen, Pella, Marvin, Wright Products, Prime Line, Rusco, and many more — including obscure regional and custom brands.",
  },
  {
    q: "How do I find the right window balance size?",
    a: "For channel balances, measure the channel length inside the window frame from the top sill to the bottom of the channel and match it to the nearest standard size. For spiral tube balances, measure the tube length. If you're unsure, use our Free Parts ID service — send us a photo and we'll identify the exact replacement.",
  },
  {
    q: "What is the minimum order amount?",
    a: "Our minimum order is $50. Orders below $50 may require additional handling charges and we will contact you before processing.",
  },
  {
    q: "How long does shipping take?",
    a: "Standard shipping takes 3–5 business days from the ship date via UPS, FedEx, and USPS. Some parts must be sourced from our distributors first, and we will contact you if additional lead time is needed.",
  },
  {
    q: "Do you ship window and door parts nationwide?",
    a: "Yes — we ship to all 50 states. Shipping costs are calculated at checkout based on your delivery address, package weight, and dimensions.",
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-16 md:py-24 bg-white border-t border-slate-200" aria-labelledby="faq-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-500 text-lg">Quick answers about parts, ordering, and our Free Parts ID service.</p>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="bg-white">
                <button
                  type="button"
                  aria-expanded={open === i}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-slate-900 font-semibold hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className="text-base leading-snug">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-primary shrink-0 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {open === i && (
                  <div id={`faq-answer-${i}`} className="px-6 pb-5 text-slate-600 leading-relaxed text-sm">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm mb-4">Still have questions? We're happy to help.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" className="font-bold">
                <a href={SITE_CUSTOMER_MAILTO}><Mail className="w-4 h-4 mr-2" aria-hidden="true" />Email Us</a>
              </Button>
              <Button asChild className="font-bold bg-red-600 hover:bg-red-700 text-white border-0">
                <Link href="/parts-identification"><PackageSearch className="w-4 h-4 mr-2" aria-hidden="true" />Free Parts ID</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const HERO_DEFAULTS: Record<string, string> = {
  heroBadge: "Veteran Owned & Operated",
  heroHeadline: "Replacement Window & Door Parts",
  heroSubheadline: "Your window won't stay open. Your door sticks. The crank is broken. We have the part you need. Over 4,000 parts in stock. 40 years of hands-on experience. Send us a photo and we'll match it for free.",
  heroCtaShop: "Shop 4,000+ Parts",
  heroCtaPartsId: "Free Parts ID",
};

export default function Home() {
  const { data: settingsData } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["site-content"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const c = (key: string) => settingsData?.settings?.[key] || HERO_DEFAULTS[key] || "";

   const { data: rawFeaturedProducts, isLoading } = useGetFeaturedProducts({
    query: {
      queryKey: getGetFeaturedProductsQueryKey(),
    }
  });

  // Normalize — API may return Product[] directly OR { products: Product[] }
  const featuredProducts = Array.isArray(rawFeaturedProducts)
    ? rawFeaturedProducts
    : Array.isArray((rawFeaturedProducts as any)?.products)
      ? (rawFeaturedProducts as any).products
      : [];

  return (
    <div className="flex flex-col">
      <PageSeo
        title="Window &amp; Door Replacement Parts — 40+ Years Experience"
        path="/"
        description="All Window Door Parts — veteran-owned supplier with 40+ years experience. Shop 4,000+ in-stock replacement window &amp; door hardware parts: casement operators, sash balances, patio door rollers, locks, weatherstripping. Free Parts ID. Call 785-533-0244."
        keywords="window replacement parts, door hardware parts, casement window operator, window sash balance, patio door roller, window lock, weatherstripping, sash keeper, tilt latch, window hardware, door hardware, veteran owned"
        structuredData={[websiteSchema, organizationSchema, faqSchema] as unknown as object}
      />

      {/* Hero Section */}
      <section className="relative bg-[#0f172a] text-white overflow-hidden py-20 lg:py-32">
        <picture className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <source type="image/webp" srcSet={heroBgWebp} />
          <img
            src={heroBg}
            alt=""
            aria-hidden="true"
            width="1920"
            height="1080"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover opacity-30"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/85 to-[#0f172a]/40" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-sm font-bold text-blue-200 mb-6 uppercase tracking-wider">
              <Shield className="w-4 h-4" aria-hidden="true" /> {c("heroBadge")}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold leading-tight mb-4 text-white shadow-sm">
              {c("heroHeadline")}
            </h1>

            <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
              {c("heroSubheadline")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="h-14 px-8 text-lg font-bold bg-accent hover:bg-accent/90 text-white border-0 shadow-md hover:shadow-lg transition-shadow"
                asChild
                onClick={() => analytics.track("CTA Clicked", { label: c("heroCtaShop"), location: "hero" })}
              >
                <Link href="/shop">
                  {c("heroCtaShop")} <ChevronRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                size="lg"
                className="h-14 px-8 text-lg font-bold bg-red-600 hover:bg-red-700 border-0 text-white shadow-md hover:shadow-lg transition-shadow"
                asChild
                onClick={() => analytics.track("CTA Clicked", { label: c("heroCtaPartsId"), location: "hero" })}
              >
                <Link href="/parts-identification">
                  <PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> {c("heroCtaPartsId")}
                </Link>
              </Button>
            </div>

            {/* Hero email nudge */}
            <p className="mt-6 text-slate-400 text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" aria-hidden="true" />
              Questions? Email <a href={SITE_CUSTOMER_MAILTO} className="text-blue-300 font-bold hover:text-white transition-colors">{SITE_CUSTOMER_EMAIL}</a>
            </p>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-primary text-white py-6">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { value: "4,000+", label: "Parts in Stock" },
              { value: "40+",     label: "Years Experience" },
              { value: "100%",    label: "Veteran Owned" },
              { value: "Free",    label: "Parts ID Service" },
            ].map(({ value, label }) => (
              <div key={label} className="py-2">
                <div className="text-2xl md:text-3xl font-serif font-bold text-white">{value}</div>
                <div className="text-blue-200 text-xs uppercase tracking-wider mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-white border-b py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 divide-x divide-slate-100">
            <div className="flex flex-col items-center text-center px-4">
              <Award className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">40+ Years</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Industry Experience</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <Shield className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">Veteran Owned</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Proudly American</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <PackageSearch className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">Free Parts ID</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Expert Matching</p>
            </div>
            <div className="flex flex-col items-center text-center px-4">
              <Truck className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">Nationwide Shipping</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide">Determined at Checkout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment & Security Badge Strip */}
      <section className="bg-slate-50 border-b border-slate-200 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-green-600" aria-hidden="true" />
              <span className="text-slate-700">SSL Secure Checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-[#003087] text-white text-[10px] font-extrabold tracking-wide px-2 py-1 rounded">
                Pay<span className="text-[#009cde]">Pal</span>
              </span>
              <span className="text-slate-700">PayPal Accepted</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-bold text-slate-800">VISA</span>
              <span className="font-bold text-blue-700">MC</span>
              <span className="font-bold text-blue-500">DISC</span>
              <span className="font-bold text-slate-600">AMEX</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" aria-hidden="true" />
              <span className="text-slate-700">Veteran Owned &amp; Operated</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" aria-hidden="true" />
              <a href="tel:785-533-0244" className="text-primary font-bold hover:underline">785-533-0244</a>
            </div>
          </div>
        </div>
      </section>

      {/* SEO Intro Block */}
      <section className="bg-white py-10 border-b border-slate-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">America's Trusted Source for Window &amp; Door Hardware</h2>
            <p className="text-slate-600 leading-relaxed text-lg">
              All Window Door Parts specializes in replacement hardware for casement windows, sliding patio doors,
              double-hung windows, awning windows, and more. Whether you need a{" "}
              <Link href="/shop?search=balance" className="text-primary font-semibold hover:underline">window balance</Link>,{" "}
              <Link href="/shop?search=casement" className="text-primary font-semibold hover:underline">casement operator</Link>,{" "}
              <Link href="/shop?search=roller" className="text-primary font-semibold hover:underline">patio door roller</Link>, or hard-to-find{" "}
              <Link href="/shop?category=Window+Glazing+and+Weatherstrip" className="text-primary font-semibold hover:underline">weatherstripping</Link>,
              our inventory covers virtually every make and model — including obsolete and discontinued hardware
              that nobody else stocks. Homeowners, contractors, and property managers across the country trust us to
              identify and deliver the exact part they need.
            </p>
          </div>
        </div>
      </section>

      {/* Narrative Content Block — 300-500 words for SEO depth */}
      <section className="bg-white py-12 border-b border-slate-100">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto prose prose-slate prose-lg">
            <h2 className="text-2xl font-serif font-bold text-slate-900 mb-4">
              Find the Right Part. Fix It Yourself. Save Money.
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Most window and door problems start small. A window that drifts down when you let go. A sliding door
              that scrapes every time you open it. A crank handle that spins but nothing moves. These are not signs
              you need a new window or door. They are signs you need one specific part — and we can help you find it.
            </p>
            <p className="text-slate-600 leading-relaxed">
              At All Window Door Parts, we stock over 4,000 replacement parts for windows and doors made by nearly
              every manufacturer in the United States. Our catalog includes channel balances, spiral balances, and
              constant-force balances for double-hung windows. We carry casement operators, awning operators, and
              scissor-arm mechanisms for crank-out windows. For sliding patio doors, we stock rollers in nylon,
              steel, and tandem configurations. We also carry a full range of locks, latches, keepers, tilt hardware,
              weatherstripping profiles, and screen accessories.
            </p>
            <p className="text-slate-600 leading-relaxed">
              What sets us apart is our ability to source parts that other companies no longer carry. Window
              manufacturers change part designs, discontinue product lines, and stop supporting older models.
              When that happens, homeowners and contractors get stuck. We fill that gap. With over 40 years of
              hands-on experience in the window and door industry, our team knows how to cross-reference old
              part numbers, match hardware by photo, and find compatible replacements for obsolete components.
            </p>
            <p className="text-slate-600 leading-relaxed">
              If you do not know the name of the part you need, that is perfectly normal. Most people do not.
              Our <Link href="/parts-identification" className="text-primary font-semibold hover:underline">Free Parts
              Identification service</Link> lets you send us a photo, and our experts will tell you exactly what it
              is and where to order it. There is no charge and no obligation. We do this because matching the right
              part saves you time, money, and frustration — and it keeps our customers coming back.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We ship to all 50 states. Orders over $50 ship with standard ground delivery. If you have questions
              before you order, call us at{" "}
              <a href="tel:7855330244" className="text-primary font-semibold hover:underline">785-533-0244</a>.
              We are here Monday through Friday, 8 a.m. to 5 p.m. Central Time. Real people. Real answers.
              No automated phone trees.
            </p>
          </div>
        </div>
      </section>

      {/* Shop by Problem — moved up for conversion */}
      <section className="py-16 md:py-24 bg-slate-900 text-white border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Shop by Problem</h2>
            <p className="text-white max-w-2xl mx-auto text-lg">Don't know the part name? That's okay — tell us the problem and we'll point you to the fix.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: ArrowUp,    label: "Window Won't Stay Up",      desc: "Broken balance or spring",             href: "/shop?search=balance" },
              { icon: Wrench,     label: "Crank Operator Broken",      desc: "Casement or awning won't open/close", href: "/shop?search=casement" },
              { icon: Move,       label: "Patio Door Hard to Slide",   desc: "Worn rollers or track damage",         href: "/shop?search=roller" },
              { icon: Wind,       label: "Weatherstripping Worn Out",  desc: "Drafts, leaks, or worn seals",         href: "/shop?category=Window+Glazing+and+Weatherstrip" },
              { icon: Lock,       label: "Lock Won't Latch",           desc: "Broken or misaligned lock hardware",   href: "/shop?search=lock" },
              { icon: LayoutGrid, label: "Screen Door Damaged",        desc: "Torn screen, bent frame, or hardware", href: "/shop?category=Screen+Hardware+and+Accessories" },
              { icon: Key,        label: "Handle Broken or Loose",     desc: "Door or window handle replacement",    href: "/shop?search=handle" },
              { icon: Droplets,   label: "Window Leaks Air or Water",  desc: "Glazing, seals, or frame repair",      href: "/parts-identification" },
            ].map(({ icon: Icon, label, desc, href }) => (
              <Link key={label} href={href} className="group bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500 rounded-xl p-6 transition-all flex flex-col gap-3">
                <div className="w-11 h-11 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <Icon className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm leading-snug mb-1">{label}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{desc}</p>
                </div>
                <span className="text-blue-400 text-xs font-semibold group-hover:text-white transition-colors mt-auto">
                  Find the fix &rarr;
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-white mb-5">Not sure what's wrong? Our experts will diagnose it for free.</p>
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 shadow-md hover:shadow-lg transition-shadow"
              asChild
              onClick={() => analytics.track("CTA Clicked", { label: "Upload a Photo — Free Parts ID", location: "shop_by_problem" })}
            >
              <Link href="/parts-identification">
                <PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-2">Featured Hardware</h2>
              <p className="text-slate-500 font-medium">High-quality replacement parts trusted by industry professionals.</p>
            </div>
            <Button variant="outline" className="hidden sm:flex" asChild>
              <Link href="/shop">View All Parts <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <Skeleton className="h-[250px] w-full rounded-lg" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-1/3" />
                </div>
              ))
            ) : Array.isArray(featuredProducts) && featuredProducts.length > 0 ? (
  featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            ) : (
              <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                No featured products available at the moment.
              </div>
            )}
          </div>

          <div className="mt-10 text-center sm:hidden">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/shop">View All Parts <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How to Identify Your Part — Guide Hub Module */}
      <section className="py-16 md:py-24 bg-white border-t border-slate-200">
        <div className="container mx-auto px-4">

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider mb-4">
              <PackageSearch className="w-4 h-4" aria-hidden="true" /> Part Identification Center
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">
              🧩 Not Sure What Part You Have?
            </h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              Identify your window or door part in minutes — even if you don't know what it's called.
            </p>
          </div>

          {/* Body + feature list */}
          <div className="max-w-3xl mx-auto mb-12 text-center">
            <p className="text-slate-600 text-base leading-relaxed mb-6">
              Most homeowners don't know the name of the part they're trying to replace — and that's normal. Our Part Identification Center walks you through the six most common hardware types with clear photos, step-by-step identification, measurement instructions, and quick lookup tables so you order the right part the first time.
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700 text-left max-w-xl mx-auto">
              {[
                "Clear photos and diagrams",
                "Step-by-step identification",
                "Measurement instructions",
                "Common mistakes to avoid",
                '"If it looks like this → go here" quick lookup',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3×2 Guide card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              {
                emoji: "⚖️",
                title: "Window Balance",
                desc: "Identify channel, spiral, and coil balances with correct measurements.",
                href: "/guides/window-balance",
                color: "hover:border-blue-400",
                iconBg: "bg-blue-50 group-hover:bg-blue-600",
                iconText: "text-blue-600 group-hover:text-white",
              },
              {
                emoji: "🚪",
                title: "Patio Door Roller",
                desc: "Identify steel, nylon, and tandem rollers with correct measurements.",
                href: "/guides/patio-door-roller",
                color: "hover:border-amber-400",
                iconBg: "bg-amber-50 group-hover:bg-amber-600",
                iconText: "text-amber-600 group-hover:text-white",
              },
              {
                emoji: "🧵",
                title: "Weatherstripping",
                desc: "Match kerf, bulb, fin seal, and OEM profiles by shape and size.",
                href: "/guides/weatherstripping",
                color: "hover:border-emerald-400",
                iconBg: "bg-emerald-50 group-hover:bg-emerald-600",
                iconText: "text-emerald-600 group-hover:text-white",
              },
              {
                emoji: "🔧",
                title: "Window Operator (Crank)",
                desc: "Identify single-arm, dual-arm, dyad, and scissor operators.",
                href: "/guides/window-operator",
                color: "hover:border-violet-400",
                iconBg: "bg-violet-50 group-hover:bg-violet-600",
                iconText: "text-violet-600 group-hover:text-white",
              },
              {
                emoji: "🔒",
                title: "Door Lock / Mortise Hardware",
                desc: "Measure faceplate, backset, and latch style to find the right lock.",
                href: "/guides/door-lock",
                color: "hover:border-rose-400",
                iconBg: "bg-rose-50 group-hover:bg-rose-600",
                iconText: "text-rose-600 group-hover:text-white",
              },
              {
                emoji: "🪟",
                title: "Glazing Bead",
                desc: "Match snap-in, kerf-in, and OEM bead profiles by cross-section.",
                href: "/guides/glazing-bead",
                color: "hover:border-sky-400",
                iconBg: "bg-sky-50 group-hover:bg-sky-600",
                iconText: "text-sky-600 group-hover:text-white",
              },
            ].map(({ emoji, title, desc, href, color, iconBg, iconText }) => (
              <Link
                key={title}
                href={href}
                className={`group bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${color}`}
                onClick={() => analytics.track("Guide Card Clicked", { title, location: "homepage_guide_module" })}
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-xl transition-colors ${iconBg}`}>
                  <span role="img" aria-label={title}>{emoji}</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 group-hover:text-primary transition-colors">{title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                </div>
                <span className="text-primary text-xs font-semibold group-hover:underline mt-auto">
                  Read the guide &rarr;
                </span>
              </Link>
            ))}
          </div>

          {/* Secondary CTA — View the full hub */}
          <div className="text-center mb-0">
            <Button variant="outline" className="font-bold" asChild>
              <Link
                href="/guides"
                onClick={() => analytics.track("CTA Clicked", { label: "View All Identification Guides", location: "homepage_guide_module" })}
              >
                View All Identification Guides <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>

        </div>

        {/* Full-width dark CTA strip */}
        <div className="bg-slate-900 mt-16">
          <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white font-semibold text-base text-center sm:text-left">
              📤 Still not sure? Upload photos — our experts will identify your part for free.
            </p>
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white border-0 h-12 px-8 shrink-0 shadow-md hover:shadow-lg transition-shadow"
              asChild
              onClick={() => analytics.track("CTA Clicked", { label: "Start Free Parts ID", location: "homepage_guide_module_cta" })}
            >
              <Link href="/parts-identification">
                <PackageSearch className="mr-2 w-4 h-4" aria-hidden="true" /> Start Free Parts ID
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Parts ID CTA */}
      <section className="py-16 md:py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="bg-primary rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row">
            <div className="p-8 md:p-12 lg:p-16 flex-1 flex flex-col justify-center text-white">
              <div className="inline-flex items-center gap-2 bg-accent/20 text-accent-foreground px-3 py-1 rounded-full text-sm font-bold w-fit mb-6">
                <Star className="w-4 h-4 fill-current" aria-hidden="true" /> Free Service
              </div>
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4 text-white">Not Sure What Part You Need?</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-xl leading-relaxed">
                Send us pictures of your needed parts. Our team with decades of industry experience will identify it and send you a link to buy the exact replacement — completely free.
              </p>
              <ul className="space-y-3 mb-8 text-blue-100 font-medium">
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" aria-hidden="true" /> No obligation — just answers.</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" aria-hidden="true" /> Fast, expert responses.</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-accent" aria-hidden="true" /> Specialists in obsolete and discontinued parts.</li>
              </ul>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="w-fit bg-red-600 hover:bg-red-700 text-white h-12 px-8 text-base shadow-lg border-0 hover:shadow-xl transition-shadow"
                  asChild
                  onClick={() => analytics.track("CTA Clicked", { label: "Upload a Photo Now", location: "parts_id_cta" })}
                >
                  <Link href="/parts-identification">Upload a Photo Now</Link>
                </Button>
                <Button size="lg" variant="ghost" className="w-fit text-white border border-white/30 hover:bg-white/10 h-12 px-8 text-base" asChild>
                  <a href={SITE_CUSTOMER_MAILTO} onClick={() => analytics.track("CTA Clicked", { label: "Email Us", location: "parts_id_cta" })}>
                    <Mail className="w-4 h-4 mr-2" aria-hidden="true" /> Email Us
                  </a>
                </Button>
              </div>
            </div>
            <div className="md:w-2/5 bg-slate-800 relative hidden md:block">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-60 mix-blend-overlay"
                style={{ backgroundImage: `url(${ctaBg})` }}
                role="img"
                aria-label="Window hardware parts"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent w-32" />
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Category — keyword-rich tiles */}
      <section className="py-16 md:py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">Browse by Part Type</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">Shop the most common replacement hardware categories — from everyday repairs to hard-to-find discontinued parts.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { name: "Casement Operators",        href: "/shop?search=casement",                           Icon: Wrench,            desc: "Roto-Gear, dual-arm & awning operators" },
              { name: "Window Balances",            href: "/shop?search=balance",                            Icon: SlidersHorizontal, desc: "Spiral, block-and-tackle, constant force" },
              { name: "Window Locks & Latches",     href: "/shop?search=lock",                               Icon: Lock,              desc: "Cam locks, sash locks, tilt latches" },
              { name: "Weatherstripping & Seals",   href: "/shop?category=Window+Glazing+and+Weatherstrip",  Icon: Wind,              desc: "Pile, bulb, foam & kerf seal strips" },
              { name: "Glazing Bead",               href: "/shop?search=glazing",                            Icon: Box,               desc: "Vinyl, aluminum & PVC bead profiles" },
              { name: "Patio Door Rollers",         href: "/shop?search=roller",                             Icon: Move,              desc: "Steel, nylon & tandem roller sets" },
              { name: "Window & Door Hinges",       href: "/shop?search=hinge",                              Icon: RotateCcw,         desc: "Casement, awning & friction hinges" },
              { name: "Screens & Screen Hardware",  href: "/shop?category=Screen+Hardware+and+Accessories",  Icon: LayoutGrid,        desc: "Frames, spline, corners & screen kits" },
              { name: "Jambliners",                 href: "/shop?search=jambliner",                          Icon: PanelLeft,         desc: "Wood window retrofit jamb-liner kits" },
              { name: "Door Sweeps",                href: "/shop?search=sweep",                              Icon: ArrowDownToLine,   desc: "Under-door seals & Air-Tite strips" },
              { name: "Door Hardware",              href: "/shop?search=handle",                             Icon: Key,               desc: "Handle sets, locksets & entry hardware" },
              { name: "Sash Hardware",              href: "/shop?category=Sash+Hardware",                    Icon: Layers,            desc: "Tilt latches, keepers & sash locks" },
            ].map(({ name, href, Icon, desc }) => (
              <Link key={name} href={href} className="bg-white p-5 rounded-xl border shadow-sm hover:shadow-md hover:border-primary transition-all text-center group">
                <div className="w-12 h-12 mx-auto bg-slate-50 rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors mb-3">
                  <Icon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{name}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-snug">{desc}</p>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button variant="ghost" className="font-bold" asChild>
              <Link href="/categories">View All Categories <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 md:py-20 bg-white border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">Why Choose All Window Door Parts?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">We're not just a parts supplier — we're hardware experts with decades of hands-on experience.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { icon: Award,        title: "40+ Years Experience",    desc: "Unmatched industry knowledge to help you find the right part every time." },
              { icon: Shield,       title: "Veteran Owned",           desc: "Proudly American, veteran-owned and operated with integrity." },
              { icon: PackageSearch,title: "Free Parts ID",           desc: "Send a photo — our experts identify and source any part at no charge." },
              { icon: Truck,        title: "Nationwide Shipping",     desc: "We ship to homeowners, contractors, and property managers across the country. Shipping calculated at checkout." },
              { icon: Wrench,       title: "Obsolete Parts Experts",  desc: "Discontinued or hard-to-find? We specialize in parts nobody else stocks." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-6 rounded-xl border bg-slate-50">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <FaqSection />

      {/* Testimonials */}
      <section className="py-16 md:py-24 bg-slate-50 border-t border-slate-200">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-6 h-6 fill-amber-400 text-amber-400" aria-hidden="true" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 mb-4">Trusted by Homeowners &amp; Contractors</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">Real customers. Real results.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {[
              {
                text: "I spent 3 weeks trying to find a replacement lock for my 1995 Biltbest windows. Local stores had no clue. I sent a photo to All Window Door Parts and they identified it in 2 hours. Part arrived and fit perfectly.",
                name: "Robert M.",
                loc: "Homeowner, Texas",
                type: "Parts ID Success"
              },
              {
                text: "As a contractor, time is money. Their Free Parts ID service is a lifesaver when I encounter an obscure casement operator. They always know what it is. Won't buy hardware anywhere else.",
                name: "David K.",
                loc: "General Contractor, Ohio",
                type: "Contractor"
              },
              {
                text: "Called with a question about installation for a patio door roller. The gentleman on the phone walked me through the process step-by-step. Real expertise from folks who actually know their products.",
                name: "Sarah T.",
                loc: "DIY Enthusiast, Florida",
                type: "Customer Support"
              },
            ].map(({ text, name, loc, type }) => (
              <div key={name} className="bg-white p-8 rounded-2xl border shadow-sm relative flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((s) => <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden="true" />)}
                  </div>
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{type}</span>
                </div>
                <Quote className="w-8 h-8 text-primary/15 mb-2" aria-hidden="true" />
                <p className="text-slate-700 italic mb-6 leading-relaxed flex-1">"{text}"</p>
                <div>
                  <h4 className="font-bold text-slate-900">— {name}</h4>
                  <p className="text-sm text-slate-500">{loc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA row under testimonials */}
          <div className="text-center">
            <p className="text-slate-500 mb-4 text-sm">Have a question before you order? We're here to help.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="outline" className="font-bold">
                <a href={SITE_CUSTOMER_MAILTO}><Mail className="w-4 h-4 mr-2" aria-hidden="true" /> {SITE_CUSTOMER_EMAIL}</a>
              </Button>
              <Button asChild className="font-bold">
                <Link href="/parts-identification"><PackageSearch className="w-4 h-4 mr-2" aria-hidden="true" /> Free Parts ID</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
