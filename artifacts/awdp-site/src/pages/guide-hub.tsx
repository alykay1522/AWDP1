import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { ChevronRight, Upload, HelpCircle, ChevronDown } from "lucide-react";
import { useState } from "react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "How to Identify Your Window or Door Part",
  description:
    "Step-by-step guides to identify window and door parts including balances, rollers, weatherstripping, operators, locks, and glazing bead.",
  url: `${BASE_URL}/guides`,
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Do I need to remove the part before identifying it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — almost all parts must be removed to measure correctly. Measurements taken while the part is installed are often inaccurate and can result in ordering the wrong replacement.",
      },
    },
    {
      "@type": "Question",
      name: "What if my part has no markings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every guide shows how to identify parts by shape, size, and hardware style — even if there are no manufacturer markings or part numbers present.",
      },
    },
    {
      "@type": "Question",
      name: "Can I upload photos instead of measuring myself?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — our Free Parts ID service handles thousands of identifications every year. Upload clear photos of your part and our experts will identify it for free.",
      },
    },
    {
      "@type": "Question",
      name: "What if my part is discontinued?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We specialize in obsolete and hard-to-find hardware. If a replacement exists anywhere in the supply chain, we will find it for you.",
      },
    },
    {
      "@type": "Question",
      name: "What if I'm between two possible matches?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Upload photos through our Free Parts ID service — we'll confirm the correct one before you order so you don't waste money on the wrong part.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "How to Identify Your Part", item: `${BASE_URL}/guides` },
  ],
};

const GUIDES = [
  {
    emoji: "⚖️",
    title: "Window Balances",
    color: "bg-blue-50 border-blue-200",
    badgeColor: "bg-blue-100 text-blue-800",
    btnColor: "bg-blue-700 hover:bg-blue-800",
    usedWhen: "Your window won't stay up, drops suddenly, or is hard to lift.",
    learn: [
      "How to identify channel, spiral, and coil balances",
      "How to measure length, shoe width, and stamped numbers",
      "How to match top and bottom fittings",
    ],
    guidePath: "/guides/window-balance",
    shopPath: "/category/window-balances",
    shopLabel: "Shop balances",
  },
  {
    emoji: "🚪",
    title: "Patio Door Rollers",
    color: "bg-amber-50 border-amber-200",
    badgeColor: "bg-amber-100 text-amber-800",
    btnColor: "bg-amber-700 hover:bg-amber-800",
    usedWhen: "Your sliding door grinds, sticks, or jumps off the track.",
    learn: [
      "How to identify steel, nylon, and tandem rollers",
      "How to measure wheel diameter and housing size",
      "How to match mounting hole spacing",
    ],
    guidePath: "/guides/patio-door-roller",
    shopPath: "/category/patio-door-rollers",
    shopLabel: "Shop rollers",
  },
  {
    emoji: "🧵",
    title: "Weatherstripping",
    color: "bg-emerald-50 border-emerald-200",
    badgeColor: "bg-emerald-100 text-emerald-800",
    btnColor: "bg-emerald-700 hover:bg-emerald-800",
    usedWhen: "You feel drafts, see daylight, or hear rattling around the sash or door.",
    learn: [
      "How to identify kerf, bulb, fin seal, and OEM profiles",
      "How to measure kerf width, bulb diameter, and pile height",
      "How to match profile shape",
    ],
    guidePath: "/guides/weatherstripping",
    shopPath: "/category/weatherstripping",
    shopLabel: "Shop weatherstripping",
  },
  {
    emoji: "🔧",
    title: "Window Operators (Cranks)",
    color: "bg-violet-50 border-violet-200",
    badgeColor: "bg-violet-100 text-violet-800",
    btnColor: "bg-violet-700 hover:bg-violet-800",
    usedWhen: "Your casement or awning window won't open, won't close, or the crank spins freely.",
    learn: [
      "How to identify single-arm, dual-arm, dyad, and scissor operators",
      "How to measure arm length and link length",
      "How to match mounting hole patterns",
    ],
    guidePath: "/guides/window-operator",
    shopPath: "/category/window-operators",
    shopLabel: "Shop operators",
  },
  {
    emoji: "🔒",
    title: "Door Locks & Mortise Hardware",
    color: "bg-rose-50 border-rose-200",
    badgeColor: "bg-rose-100 text-rose-800",
    btnColor: "bg-rose-700 hover:bg-rose-800",
    usedWhen: "Your door won't latch, won't lock, or the handle feels loose.",
    learn: [
      "How to identify hook latches, mortise locks, and multi-point systems",
      "How to measure faceplate height, backset, and screw spacing",
      "How to match latch style",
    ],
    guidePath: "/guides/door-lock",
    shopPath: "/category/door-locks",
    shopLabel: "Shop door locks",
  },
  {
    emoji: "🪟",
    title: "Glazing Bead",
    color: "bg-sky-50 border-sky-200",
    badgeColor: "bg-sky-100 text-sky-800",
    btnColor: "bg-sky-700 hover:bg-sky-800",
    usedWhen: "Your window glass rattles, leaks air, or the bead is cracked or missing.",
    learn: [
      "How to identify snap-in, kerf-in, and OEM bead profiles",
      "How to measure profile height, width, and kerf size",
      "How to match cross-section shape",
    ],
    guidePath: "/guides/glazing-bead",
    shopPath: "/category/glazing-bead",
    shopLabel: "Shop glazing bead",
  },
];

const FAQS = [
  {
    q: "Do I need to remove the part before identifying it?",
    a: "Yes — almost all parts must be removed to measure correctly. Measurements taken while the part is installed are often inaccurate and can lead to ordering the wrong replacement.",
  },
  {
    q: "What if my part has no markings?",
    a: "Every guide shows how to identify parts by shape, size, and hardware style — even with no manufacturer markings or part numbers.",
  },
  {
    q: "Can I upload photos instead?",
    a: "Yes — our Free Parts ID service handles thousands of identifications every year. Upload clear photos and our experts will identify your part for free.",
  },
  {
    q: "What if my part is discontinued?",
    a: "We specialize in obsolete and hard-to-find hardware. If a replacement exists anywhere in the supply chain, we'll find it.",
  },
  {
    q: "What if I'm between two possible matches?",
    a: "Upload photos — we'll confirm the correct one before you order so you don't waste money on the wrong part.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4"
      >
        <span className="font-medium text-slate-800">{q}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-slate-600 pb-4 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function GuideHub() {
  return (
    <>
      <PageSeo
        title="How to Identify Your Window or Door Part | Part Identification Center"
        description="Step-by-step identification guides for window balances, patio door rollers, weatherstripping, operators, door locks, and glazing bead. Find the exact replacement in minutes."
        path="/guides"
        structuredData={[webPageSchema, faqSchema, breadcrumbSchema]}
      />

      <div className="bg-white">

        {/* Breadcrumb */}
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-slate-700 font-medium">Guide Hub</span>
          </nav>
        </div>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
            <PackageSearchIcon />
            Guide Hub
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight mb-3">
            How to Identify Your Window or Door Part
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mb-5">
            Find the exact replacement in minutes — even if you don't know what it's called.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 inline-flex items-start gap-3 max-w-xl">
            <span className="text-amber-500 mt-0.5 shrink-0">🟨</span>
            <p className="text-sm text-amber-800 font-medium">
              Not sure what part you have? Start here. Most homeowners don't know the name of the part they're replacing — and that's normal.
            </p>
          </div>
        </div>

        {/* Intro section */}
        <div className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <p className="text-slate-700 text-base leading-relaxed mb-4">
              This page gives you step-by-step identification guides for the six most common window and door parts. Each guide includes:
            </p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
              {[
                "Clear photos and type-identification cards",
                "Measurement instructions",
                "Common mistakes to avoid",
                '"If it looks like this → go here" quick lookup',
                "A direct link to the correct category",
                "FAQ + HowTo + Breadcrumb schema",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Guide cards */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🔍</span>
            <h2 className="text-xl font-bold text-slate-900">Start by choosing your part type</h2>
          </div>
          <p className="text-slate-500 text-sm mb-8">
            Pick the part that looks closest to what you removed from your window or door.
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {GUIDES.map((g) => (
              <div
                key={g.title}
                className={`rounded-xl border-2 ${g.color} p-5 flex flex-col gap-3`}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.emoji}</span>
                  <h3 className="text-lg font-bold text-slate-900">{g.title}</h3>
                </div>

                {/* Used when */}
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${g.badgeColor} mr-2`}>Used when</span>
                  <span className="text-sm text-slate-700">{g.usedWhen}</span>
                </div>

                {/* You'll learn */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">You'll learn</p>
                  <ul className="space-y-1">
                    {g.learn.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-sm text-slate-700">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTAs */}
                <div className="flex items-center gap-3 mt-auto pt-1">
                  <Link
                    href={g.guidePath}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white ${g.btnColor} transition-colors`}
                  >
                    Read the guide <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href={g.shopPath}
                    className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                  >
                    {g.shopLabel} <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <Upload className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-1">Still not sure which part you have?</h2>
                <p className="text-slate-300 text-sm leading-relaxed max-w-lg">
                  Upload photos — our experts will identify your part for free. We handle thousands of identifications every year, including obsolete and discontinued hardware.
                </p>
              </div>
            </div>
            <Link
              href="/parts-identification"
              className="shrink-0 inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              Start Free Parts ID <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-6">
            <HelpCircle className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="bg-white rounded-xl border divide-y divide-slate-200 shadow-sm">
            <div className="px-5">
              {FAQS.map((f) => (
                <FaqItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

function PackageSearchIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}
