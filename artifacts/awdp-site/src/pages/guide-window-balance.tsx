import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, PackageSearch, AlertTriangle, CheckCircle2,
  Ruler, Search, Wrench, ChevronDown
} from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Window Balance",
  description:
    "Step-by-step guide to identify the correct replacement window balance — channel, spiral, coil, or specialty — including measurement and fitting instructions.",
  totalTime: "PT15M",
  tool: [
    { "@type": "HowToTool", name: "Flat screwdriver" },
    { "@type": "HowToTool", name: "Phillips screwdriver" },
    { "@type": "HowToTool", name: "Tape measure" },
  ],
  step: [
    {
      "@type": "HowToStep",
      name: "Remove the balance from the window",
      text: "Remove the sash, then pull the balance from the track. You cannot accurately identify or measure a balance while it is still installed.",
      position: 1,
    },
    {
      "@type": "HowToStep",
      name: "Identify your balance type",
      text: "Determine whether you have a channel balance (U-shaped metal channel with nylon fittings), spiral balance (metal tube with spiral rod), constant force coil balance (flat stainless coil in plastic housing), or a hybrid/specialty balance.",
      position: 2,
    },
    {
      "@type": "HowToStep",
      name: "Measure your balance correctly",
      text: "For channel balances, measure the metal channel only — not the nylon fittings. For spiral balances, measure the tube length only and note the tip color. For coil balances, look for stamped numbers on the coil.",
      position: 3,
    },
    {
      "@type": "HowToStep",
      name: "Identify your fittings",
      text: "For channel balances, note the top and bottom nylon fitting style: winged vs. non-winged, hook vs. clip, and shoe width (typically 1\", 1-1/4\", or 1-3/8\").",
      position: 4,
    },
    {
      "@type": "HowToStep",
      name: "Look for stamped numbers",
      text: "Channel balances often have stamped codes such as 2830, 2740, 2950, or 3850. These indicate the weight range the balance is rated for, not the physical length.",
      position: 5,
    },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure a window balance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Measure the metal channel or tube only, excluding the plastic fittings. For coil balances, use the stamped number on the coil.",
      },
    },
    {
      "@type": "Question",
      name: "What if my balance has no markings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can still identify it by length, shoe type, and balance style. Upload photos to our Free Parts ID Service for expert help.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between a channel balance and a spiral balance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A channel balance is a U-shaped metal track with a block-and-tackle mechanism and nylon shoes at top and bottom — common in vinyl windows. A spiral balance is a metal tube with a coiled spring rod that winds as the sash is raised — common in older wood double-hung windows.",
      },
    },
    {
      "@type": "Question",
      name: "Can I identify a window balance without removing it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can sometimes identify the type visually, but you cannot measure it accurately without removing it from the window frame. Measurement is critical to ordering the correct replacement.",
      },
    },
    {
      "@type": "Question",
      name: "What do the stamped numbers on a window balance mean?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stamped codes like 2830, 2740, 2950, or 3850 indicate the weight rating range — not the physical length. The first two digits typically indicate the minimum sash weight capacity and the last two digits the maximum.",
      },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",         item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides",       item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Window Balance", item: `${BASE_URL}/guides/window-balance` },
  ],
};

const BALANCE_TYPES = [
  {
    name: "Channel Balance",
    subtitle: "Block & Tackle",
    description: "U-shaped metal channel with nylon top and bottom fittings. The most common type in modern vinyl and aluminum windows. Contains an internal block-and-tackle mechanism.",
    looks: "U-shaped metal rail with plastic shoes at each end",
    common: "Vinyl double-hung, aluminum single-hung",
    measure: "Metal channel length only — not the fittings",
    color: "bg-blue-50 border-blue-200",
    headColor: "text-blue-800",
    href: "/shop?category=Window+Balances&search=channel",
  },
  {
    name: "Spiral Balance",
    subtitle: "Tube Balance",
    description: "Long metal tube with a spiral steel rod that extends from one end. The rod winds and unwinds as the sash moves, providing lift. Common in older wood double-hung windows.",
    looks: "Metal tube with a visible coiled rod at one end",
    common: "Wood double-hung, older vinyl windows",
    measure: "Tube length only, plus tip color (red/blue/green/black)",
    color: "bg-amber-50 border-amber-200",
    headColor: "text-amber-800",
    href: "/shop?category=Window+Balances&search=spiral",
  },
  {
    name: "Constant Force Coil",
    subtitle: "Coil Balance",
    description: "Flat stainless steel coil housed in a plastic cartridge. Provides consistent lifting force across the full travel of the sash. Common in modern vinyl tilt-wash windows.",
    looks: "Compact plastic housing with a flat stainless steel coil",
    common: "Modern vinyl tilt-wash double-hung",
    measure: "Stamped number on the coil (e.g., 5, 5.5, 6)",
    color: "bg-emerald-50 border-emerald-200",
    headColor: "text-emerald-800",
    href: "/shop?category=Window+Balances&search=coil",
  },
  {
    name: "Hybrid / Specialty",
    subtitle: "Brand-Specific",
    description: "Twin coil assemblies, block-and-tackle with integrated shoes, or proprietary brand-specific systems. Common in Andersen, Pella, and other major manufacturers.",
    looks: "Varies — may look like a modified channel or dual-coil assembly",
    common: "Andersen, Pella, Marvin, and other brand-specific windows",
    measure: "Send us photos — use our Free Parts ID service",
    color: "bg-slate-50 border-slate-200",
    headColor: "text-slate-800",
    href: "/parts-identification",
  },
];

const MISTAKES = [
  "Measuring the entire balance including plastic fittings (measure metal only)",
  "Ordering by window size instead of balance channel or tube length",
  "Ignoring the shoe width — 1\", 1-1/4\", and 1-3/8\" are not interchangeable",
  "Assuming all balances of the same length are interchangeable across types",
  "Ordering one balance when both sides need replacement",
];

const LOOKUP_TABLE = [
  { looks: "U-shaped metal channel with plastic shoes", type: "Channel Balance", href: "/shop?category=Window+Balances&search=channel" },
  { looks: "Metal tube with spiral rod extending from the end", type: "Spiral Balance", href: "/shop?category=Window+Balances&search=spiral" },
  { looks: "Flat stainless coil in a plastic housing", type: "Coil Balance", href: "/shop?category=Window+Balances&search=coil" },
  { looks: "Plastic block with integrated shoe attached", type: "Specialty Balance", href: "/parts-identification" },
];

const FAQS = [
  {
    q: "How do I measure a window balance?",
    a: "Measure the metal channel or tube only — exclude the plastic fittings at each end. For coil balances, look for the stamped number on the coil itself (e.g., 5, 5.5, 6).",
  },
  {
    q: "What if my balance has no markings?",
    a: "Identify it by physical length, shoe type, and balance style. Upload photos to our Free Parts ID Service and our experts will match the exact replacement for you at no charge.",
  },
  {
    q: "What is the difference between a channel balance and a spiral balance?",
    a: "A channel balance is a U-shaped metal rail with a block-and-tackle mechanism and nylon shoes — common in vinyl windows. A spiral balance is a metal tube with a coiled spring rod — common in older wood double-hung windows.",
  },
  {
    q: "Can I identify a window balance without removing it?",
    a: "You can often identify the type visually, but you cannot measure it accurately without removing it. Measurement is critical — ordering the wrong length is the most common mistake.",
  },
  {
    q: "What do the stamped numbers on a window balance mean?",
    a: "Codes like 2830, 2740, or 3850 indicate the sash weight range the balance is rated for — not the physical length. You still need to measure the channel separately.",
  },
];

export default function GuideWindowBalance() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Window Balance — Channel, Block & Tackle, Spiral, Constant Force"
        description="Learn how to identify your window balance in minutes. Step-by-step guide for channel balances, block & tackle, spiral balances, and constant force coils. Includes measurement instructions and common mistakes."
        path="/guides/window-balance"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      {/* Breadcrumb */}
      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <span>Home</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Window Balance</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Window Balance Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Window Balance
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">
            Channel, Block &amp; Tackle, Spiral, and Constant Force — identified in minutes.
          </p>

          {/* Symptom callout */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of a worn or broken window balance:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Window won't stay open — drops when you let go</li>
                <li>Window slams shut unexpectedly</li>
                <li>Window is unusually heavy or hard to lift</li>
                <li>Visible crack, breakage, or missing balance hardware</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Step-by-step */}
        <div className="space-y-10 mb-16">

          {/* Step 1 */}
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Remove the Balance From the Window</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">
                You cannot identify or measure a balance while it is still installed. Remove the sash first, then lift the balance out of its track or channel.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <p className="text-sm font-bold text-slate-700 mb-2">Tools you'll need:</p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Flat screwdriver</li>
                  <li>Phillips screwdriver</li>
                  <li>Tape measure</li>
                  <li>Gloves (recommended — spring tension can be significant)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify Your Balance Type</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-6">There are four main balance types. Identify yours before measuring — each type is measured differently.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {BALANCE_TYPES.map(({ name, subtitle, description, looks, common, measure, color, headColor, href }) => (
                  <div key={name} className={`rounded-xl border p-5 ${color}`}>
                    <h3 className={`font-bold text-base mb-0.5 ${headColor}`}>{name}</h3>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{subtitle}</p>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">{description}</p>
                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200 pt-3">
                      <p><span className="font-semibold">Looks like:</span> {looks}</p>
                      <p><span className="font-semibold">Common in:</span> {common}</p>
                      <p><span className="font-semibold">Measure:</span> {measure}</p>
                    </div>
                    <Link
                      href={href}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      Shop {name}s <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Step 3 */}
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Measure Your Balance Correctly</h2>
            </div>
            <div className="pl-14">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <Ruler className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">Measurement method depends on your balance type — they are not all measured the same way.</p>
              </div>
              <div className="space-y-4">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-600 text-white px-4 py-2.5 font-bold text-sm">Channel Balance (Block &amp; Tackle)</div>
                  <div className="px-4 py-3 text-sm text-slate-700 space-y-1.5">
                    <p>Measure the <strong>metal channel only</strong> — do not include the nylon fittings at the top or bottom.</p>
                    <p>Example: a 28" metal channel = order a "28 series" channel balance.</p>
                    <p className="text-slate-500 text-xs">The fittings add 2–4" to the total assembly length. Always measure metal-to-metal.</p>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-amber-600 text-white px-4 py-2.5 font-bold text-sm">Spiral Balance (Tube Balance)</div>
                  <div className="px-4 py-3 text-sm text-slate-700 space-y-1.5">
                    <p>Measure the <strong>tube length only</strong> — not the overall assembly with the tip.</p>
                    <p>Note the <strong>tip color</strong>: red, blue, green, or black. This indicates the tension/weight rating.</p>
                    <p className="text-slate-500 text-xs">Same tube length with different tip colors = different weight ratings. Both matter.</p>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-emerald-600 text-white px-4 py-2.5 font-bold text-sm">Constant Force Coil Balance</div>
                  <div className="px-4 py-3 text-sm text-slate-700 space-y-1.5">
                    <p>Look for a <strong>number stamped on the coil</strong> itself (e.g., 5, 5.5, 6, 7).</p>
                    <p>Count the number of coils in the assembly — some windows use single, double, or triple coils.</p>
                    <p className="text-slate-500 text-xs">If there are no markings, send us photos — coil balance ID requires expert matching.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Step 4 */}
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify Your Fittings</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-4 leading-relaxed">
                For channel balances, the nylon top and bottom fittings are just as important as the channel length. Ordering the wrong fitting style is one of the most common reasons a balance won't fit.
              </p>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">What to check</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">Options</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800">Top fitting style</td>
                      <td className="px-4 py-3 text-slate-600">Winged vs. non-winged, hook vs. clip</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-800">Bottom shoe width</td>
                      <td className="px-4 py-3 text-slate-600">1" &bull; 1-1/4" &bull; 1-3/8" — measure the groove inside the track</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-medium text-slate-800">Shoe locking style</td>
                      <td className="px-4 py-3 text-slate-600">Tilt-in (pivot) vs. lift-out (standard)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Step 5 */}
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">5</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Look for Stamped Numbers</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-4 leading-relaxed">
                Channel balances are often stamped with a 4-digit code on the metal channel or on a label. These numbers indicate the weight capacity range — not the physical length.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {["2830", "2740", "2950", "3850"].map((code) => (
                  <div key={code} className="bg-slate-900 text-white rounded-lg text-center py-3 px-2">
                    <p className="font-mono font-bold text-xl">{code}</p>
                    <p className="text-slate-400 text-xs mt-1">weight code</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                These codes indicate the sash weight range (e.g., 2830 = rated for 28–30 lb sash). You still need to measure the channel length separately.
              </p>
            </div>
          </section>
        </div>

        {/* Common Mistakes */}
        <section className="mb-16 bg-red-50 border border-red-100 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
            Common Mistakes to Avoid
          </h2>
          <ul className="space-y-3">
            {MISTAKES.map((mistake) => (
              <li key={mistake} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-red-600 font-bold text-xs">✕</span>
                {mistake}
              </li>
            ))}
          </ul>
        </section>

        {/* Quick Lookup Table */}
        <section className="mb-16">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">
            If Your Balance Looks Like This &rarr; Go Here
          </h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Balance type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LOOKUP_TABLE.map(({ looks, type, href }) => (
                  <tr key={type} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-700">{looks}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{type}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="text-primary text-xs font-bold hover:underline whitespace-nowrap inline-flex items-center gap-1">
                        Shop <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-16 bg-primary rounded-2xl p-8 md:p-10 text-white">
          <div className="flex items-start gap-4 mb-5">
            <PackageSearch className="w-8 h-8 text-accent shrink-0 mt-1" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-serif font-bold mb-2">Still Unsure? We'll Identify It For Free.</h2>
              <p className="text-blue-100 leading-relaxed">
                Upload photos of your balance — or both the balance and the window frame — and our experts with over 40 years of experience will identify the exact replacement and send you a direct link to purchase it. No charge, no obligation.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 shadow-md font-bold"
              asChild
            >
              <Link href="/parts-identification">
                <PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="border border-white/30 text-white hover:bg-white/10 h-12 px-8"
              asChild
            >
              <Link href="/shop?category=Window+Balances">
                Browse All Window Balances <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group border border-slate-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-slate-800 hover:bg-slate-50 transition-colors list-none">
                  <span>{q}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-3" aria-hidden="true" />
                </summary>
                <div className="px-5 pb-5 pt-2 text-slate-600 leading-relaxed text-sm border-t border-slate-100">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom nav */}
        <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            Reviewed by the All Window Door Parts team — 40+ years of industry experience.
          </div>
          <div className="flex gap-4">
            <Link href="/shop?category=Window+Balances" className="text-primary font-semibold hover:underline">
              Shop Window Balances
            </Link>
            <Link href="/parts-identification" className="text-primary font-semibold hover:underline">
              Free Parts ID
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
