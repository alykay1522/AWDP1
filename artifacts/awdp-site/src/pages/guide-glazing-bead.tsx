import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { ChevronRight, PackageSearch, AlertTriangle, CheckCircle2, Ruler, ChevronDown, Wrench } from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Glazing Bead",
  description: "Step-by-step guide to identify vinyl, aluminum, and OEM window glazing bead by profile shape, leg height, kerf width, and glass thickness.",
  totalTime: "PT15M",
  tool: [
    { "@type": "HowToTool", name: "Putty knife" },
    { "@type": "HowToTool", name: "Tape measure or calipers" },
  ],
  step: [
    { "@type": "HowToStep", position: 1, name: "Remove a clean sample", text: "Use a putty knife to gently pry out a 2–3 inch section of glazing bead from an undamaged area. Avoid cracked or brittle sections — they distort the profile." },
    { "@type": "HowToStep", position: 2, name: "Identify the profile type", text: "Determine whether you have snap-in vinyl bead, kerf-in bead, aluminum bead, or an OEM-specific molded profile." },
    { "@type": "HowToStep", position: 3, name: "Measure the critical dimensions", text: "Measure profile height, profile width, kerf width (if applicable), leg height, and glass thickness (single, double, or tempered). All five are needed." },
    { "@type": "HowToStep", position: 4, name: "Match the profile shape", text: "Lay the bead sample flat and compare the silhouette to OEM diagrams, product photos, and cross-section drawings. Shape match is the primary factor — not color or material." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure glazing bead?",
      acceptedAnswer: { "@type": "Answer", text: "Measure profile height, width, kerf width, and leg height from a clean, undamaged sample. These determine the correct replacement." },
    },
    {
      "@type": "Question",
      name: "What if my glazing bead is brittle or cracked?",
      acceptedAnswer: { "@type": "Answer", text: "Cut a clean section from an intact area or upload photos to our Free Parts ID Service for expert help." },
    },
    {
      "@type": "Question",
      name: "What is the difference between snap-in and kerf-in glazing bead?",
      acceptedAnswer: { "@type": "Answer", text: "A snap-in bead uses flexible legs that spring into a channel in the frame — no slot is required. A kerf-in bead has a rigid barb or leg that locks into a machined slot (kerf) in the frame. They are installed differently and are not interchangeable." },
    },
    {
      "@type": "Question",
      name: "Does glazing bead depend on glass thickness?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — glazing bead must accommodate the exact glass thickness. Single-pane, double-pane (IGU), and tempered glass all have different thicknesses. The bead's internal channel width must match. Using bead designed for a different glass thickness will result in a loose, rattling, or leaking seal." },
    },
    {
      "@type": "Question",
      name: "Can I replace glazing bead without replacing the glass?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — if the glass itself is intact and the problem is only the bead (cracked, shrunk, or missing), you can replace the bead alone. Remove the old bead carefully, clean the frame channel, and press or key in the new matching profile." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",   item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Glazing Bead", item: `${BASE_URL}/guides/glazing-bead` },
  ],
};

const PROFILE_TYPES = [
  {
    name: "Snap-In Vinyl Bead",
    desc: "Flexible vinyl legs that spring into a channel in the frame without any machined slot required. Very common in modern vinyl windows. Removed by pulling and flexing.",
    looks: "Rounded or hollow top with two flexible snap legs at the base",
    common: "Modern vinyl windows — most standard residential double-hung",
    measure: "Profile height, width, leg span when open",
    color: "bg-blue-50 border-blue-200", head: "text-blue-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=glazing+bead+vinyl",
  },
  {
    name: "Kerf-In Bead",
    desc: "Has a rigid barb or T-shaped leg that locks into a machined slot (kerf) in the frame. Provides a more permanent lock — requires a tool to remove.",
    looks: "Flat or rounded top with a narrow T-shaped or hooked leg",
    common: "Wood windows, some aluminum windows, older vinyl systems",
    measure: "Kerf width, profile height, leg height",
    color: "bg-amber-50 border-amber-200", head: "text-amber-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=glazing+bead+kerf",
  },
  {
    name: "Aluminum Bead",
    desc: "Rigid metal extrusion that is cut to length and mechanically fastened or pressed into place. Used on commercial aluminum windows and older residential aluminum frames.",
    looks: "Rigid metal strip, often with a flat face and angled or stepped legs",
    common: "Commercial aluminum storefronts, older residential aluminum windows",
    measure: "Profile height, width, leg dimensions",
    color: "bg-slate-50 border-slate-200", head: "text-slate-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=glazing+bead+aluminum",
  },
  {
    name: "OEM-Specific Profiles",
    desc: "Custom-molded profiles from Andersen, Pella, Milgard, and other manufacturers. The profile is unique to the brand and window series — generic profiles will not fit.",
    looks: "Unique cross-section unlike any of the standard types above",
    common: "Andersen, Pella, Milgard, Marvin — brand-specific windows",
    measure: "Send us photos — OEM profiles require expert matching",
    color: "bg-purple-50 border-purple-200", head: "text-purple-800",
    href: "/parts-identification",
  },
];

const LOOKUP_TABLE = [
  { looks: "Flat top with T-barb or hook leg", type: "Kerf-in bead", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=kerf" },
  { looks: "Rounded top with flexible snap legs", type: "Snap-in vinyl bead", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=vinyl+bead" },
  { looks: "Rigid metal strip", type: "Aluminum bead", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=aluminum+bead" },
  { looks: "Unique molded shape that matches none above", type: "OEM-specific bead", href: "/parts-identification" },
];

const MISTAKES = [
  "Measuring a warped, cracked, or brittle sample — always use an intact section",
  "Ordering by window brand alone — bead profiles change between product lines and years",
  "Ignoring kerf width — snap-in and kerf-in beads are not interchangeable",
  "Not accounting for glass thickness — bead channel width must match exactly",
  "Assuming \"close enough\" will snap in — even slightly undersized beads will not seal properly",
];

const FAQS = [
  { q: "How do I measure glazing bead?", a: "Measure profile height, width, kerf width (if it has a barb leg), and leg height from a clean undamaged sample. Also note the glass thickness the bead is holding — single, double, or tempered." },
  { q: "What if my glazing bead is brittle or cracked?", a: "Old vinyl bead becomes brittle with UV exposure. Cut a clean 2–3 inch section from an intact area, or upload clear photos of the profile cross-section to our Free Parts ID Service." },
  { q: "What is the difference between snap-in and kerf-in glazing bead?", a: "A snap-in bead uses flexible legs that spring into a channel — no machined slot required. A kerf-in bead has a rigid barb that locks into a machined slot. They are not interchangeable." },
  { q: "Does glazing bead depend on glass thickness?", a: "Yes — the bead's internal channel must match the glass thickness exactly. Single-pane, double-pane, and tempered glass all have different thicknesses. Wrong bead = rattling, leaking, or loose glass." },
  { q: "Can I replace glazing bead without replacing the glass?", a: "Yes — if the glass is intact and only the bead is cracked or missing, you can replace the bead alone. Remove the old bead carefully, clean the frame, and press or key in the new matching profile." },
];

export default function GuideGlazingBead() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Glazing Bead — Vinyl, Aluminum, and OEM Window Bead Identification Guide"
        description="Identify your glazing bead by profile shape, leg height, kerf width, and OEM fitment. Includes measurement instructions and common mistakes."
        path="/guides/glazing-bead"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Glazing Bead</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Glazing Bead Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Glazing Bead
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">Vinyl, Aluminum, and OEM Profiles — profile shape, kerf width, and glass thickness.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of failed or missing glazing bead:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Glass rattles in the frame when the window or door is closed</li>
                <li>Air or water leaks around the glass pane</li>
                <li>Bead is visibly cracked, brittle, or has sections missing</li>
                <li>Bead has pulled away from the frame at corners or along the run</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-10 mb-16">
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Remove a Clean Sample</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">
                Use a putty knife to gently pry out a 2–3 inch section from an area that is not cracked or warped. Work slowly to avoid tearing the bead — a clean, intact cross-section is what you need.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-sm font-bold text-blue-900 mb-1">Why a clean sample matters:</p>
                <p className="text-sm text-blue-800">Old vinyl bead can shrink, crack, or deform. A cracked or warped sample gives incorrect dimensions. Even a 1mm error in profile height can result in bead that won't snap in or won't hold the glass.</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify the Profile Type</h2>
            </div>
            <div className="pl-14">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {PROFILE_TYPES.map(({ name, desc, looks, common, measure, color, head, href }) => (
                  <div key={name} className={`rounded-xl border p-5 ${color}`}>
                    <h3 className={`font-bold text-base mb-2 ${head}`}>{name}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">{desc}</p>
                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200 pt-3">
                      <p><span className="font-semibold">Looks like:</span> {looks}</p>
                      <p><span className="font-semibold">Common in:</span> {common}</p>
                      <p><span className="font-semibold">Measure:</span> {measure}</p>
                    </div>
                    <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      Shop {name} <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Measure the Critical Dimensions</h2>
            </div>
            <div className="pl-14">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <Ruler className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">Five measurements are needed. Measure from a clean, undamaged sample — not from a warped or cracked section.</p>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">Measurement</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">What to measure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["Profile height",   "Overall height of the bead cross-section from top to base"],
                      ["Profile width",    "Overall width of the bead cross-section"],
                      ["Kerf width",       "Width of the slot or barb leg (if applicable — typically 1/8\" or 3/16\")"],
                      ["Leg height",       "Height of the snap legs or kerf barb that engages the frame channel"],
                      ["Glass thickness",  "Thickness of the glass pane: single (~3mm), double IGU (~20–28mm), tempered"],
                    ].map(([m, d], i) => (
                      <tr key={m} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                        <td className="px-4 py-3 font-medium text-slate-800">{m}</td>
                        <td className="px-4 py-3 text-slate-600">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Match the Profile Shape</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">
                Lay the bead flat on a white surface and compare the silhouette — the cross-section shape — to product photos and OEM diagrams. Profile shape is the primary matching criterion.
              </p>
              <div className="bg-slate-900 text-white rounded-xl px-5 py-4">
                <p className="font-bold mb-2">Shape match is the #1 factor.</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Two beads of the same width and height but different leg shapes will not perform the same. One may snap cleanly; the other may not engage the channel at all. Always compare the full cross-section silhouette.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mb-16 bg-red-50 border border-red-100 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" /> Common Mistakes to Avoid
          </h2>
          <ul className="space-y-3">
            {MISTAKES.map((m) => (
              <li key={m} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-red-600 font-bold text-xs">✕</span>
                {m}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">If Your Bead Looks Like This &rarr; Go Here</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Bead type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LOOKUP_TABLE.map(({ looks, type, href }) => (
                  <tr key={type} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-700">{looks}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{type}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={href} className="text-primary text-xs font-bold hover:underline inline-flex items-center gap-1">
                        Shop <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-16 bg-primary rounded-2xl p-8 md:p-10 text-white">
          <div className="flex items-start gap-4 mb-5">
            <PackageSearch className="w-8 h-8 text-accent shrink-0 mt-1" aria-hidden="true" />
            <div>
              <h2 className="text-2xl font-serif font-bold mb-2">Still Unsure? We'll Identify It For Free.</h2>
              <p className="text-blue-100 leading-relaxed">Upload a photo of your bead — cross-section preferred — and our experts will identify the exact replacement profile. No charge, no obligation.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 font-bold" asChild>
              <Link href="/parts-identification"><PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID</Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 h-12 px-8" asChild>
              <Link href="/shop?category=Window+Glazing+and+Weatherstrip">Browse Glazing &amp; Weatherstrip <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
            </Button>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group border border-slate-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-semibold text-slate-800 hover:bg-slate-50 transition-colors list-none">
                  <span>{q}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-3" aria-hidden="true" />
                </summary>
                <div className="px-5 pb-5 pt-2 text-slate-600 leading-relaxed text-sm border-t border-slate-100">{a}</div>
              </details>
            ))}
          </div>
        </section>

        <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            Reviewed by the All Window Door Parts team — 40+ years of industry experience.
          </div>
          <div className="flex gap-4">
            <Link href="/shop?category=Window+Glazing+and+Weatherstrip" className="text-primary font-semibold hover:underline">Shop Glazing &amp; Weatherstrip</Link>
            <Link href="/parts-identification" className="text-primary font-semibold hover:underline">Free Parts ID</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
