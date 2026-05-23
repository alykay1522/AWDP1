import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { ChevronRight, PackageSearch, AlertTriangle, CheckCircle2, Ruler, ChevronDown, Wrench } from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Weatherstripping",
  description: "Step-by-step guide to identify window and door weatherstripping by profile shape, kerf size, bulb diameter, fin type, and OEM fitment.",
  totalTime: "PT15M",
  tool: [
    { "@type": "HowToTool", name: "Utility knife or scissors" },
    { "@type": "HowToTool", name: "Tape measure or calipers" },
    { "@type": "HowToTool", name: "Ruler" },
  ],
  step: [
    { "@type": "HowToStep", position: 1, name: "Remove a clean sample", text: "Cut a 1–2 inch piece from an undamaged section of the existing weatherstripping. Avoid crushed or flattened areas — they distort the profile shape and give inaccurate measurements." },
    { "@type": "HowToStep", position: 2, name: "Identify the profile type", text: "Determine which of the five main types you have: kerf-in (T-shaped barb), bulb seal (round or teardrop), foam seal (soft, compressible), fin seal (fuzzy pile with center fin), or OEM-specific profile." },
    { "@type": "HowToStep", position: 3, name: "Measure the critical dimensions", text: "For kerf weatherstripping: kerf width (1/8\" or 3/16\"), bulb diameter, and overall height. For bulb seals: bulb diameter, base width, and stem height. For fin seals: pile height, base width, and fin height." },
    { "@type": "HowToStep", position: 4, name: "Match the profile shape", text: "Lay the sample flat and compare the silhouette to OEM diagrams, product photos, and cross-section drawings. Shape is more important than color — never match by color alone." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure weatherstripping?",
      acceptedAnswer: { "@type": "Answer", text: "Measure the profile from an undamaged section. For kerf seals, measure kerf width and bulb diameter. For fin seals, measure pile height and base width." },
    },
    {
      "@type": "Question",
      name: "What if my weatherstripping is flattened?",
      acceptedAnswer: { "@type": "Answer", text: "Flattened seals distort the shape. Cut a clean sample from an intact area or upload photos to our Free Parts ID Service." },
    },
    {
      "@type": "Question",
      name: "What is kerf weatherstripping?",
      acceptedAnswer: { "@type": "Answer", text: "Kerf weatherstripping has a T-shaped barb that press-fits into a narrow slot (the kerf) machined into the window or door frame. It is the most common type on modern vinyl and wood windows. Kerf width is typically 1/8\" or 3/16\" — these are not interchangeable." },
    },
    {
      "@type": "Question",
      name: "What is the difference between bulb seal and kerf seal?",
      acceptedAnswer: { "@type": "Answer", text: "A bulb seal compresses against a surface when the window or door closes — it has no barb and is typically glued or stapled in a channel. A kerf seal has a T-shaped barb that locks into a machined slot in the frame. They are used in different applications and are not interchangeable." },
    },
    {
      "@type": "Question",
      name: "Can I identify weatherstripping by color?",
      acceptedAnswer: { "@type": "Answer", text: "No — color varies between manufacturers and is not a reliable identifier. Always identify by profile shape, kerf width, and dimensions. Two seals that look the same color may have completely different profiles." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",   item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Weatherstripping", item: `${BASE_URL}/guides/weatherstripping` },
  ],
};

const PROFILE_TYPES = [
  {
    name: "Kerf-In Weatherstripping",
    desc: "Has a T-shaped barb that press-fits into a kerf (slot) machined into the frame. The most common type on modern vinyl and wood windows and doors.",
    looks: "Solid or hollow bulb with a narrow T-shaped leg",
    common: "Vinyl windows, wood windows, modern entry doors",
    measure: "Kerf width (1/8\" or 3/16\"), bulb diameter, overall height",
    color: "bg-blue-50 border-blue-200", head: "text-blue-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=kerf",
  },
  {
    name: "Bulb Seal",
    desc: "Round or teardrop-shaped bulb that compresses when the window or door closes. Typically glued or mechanically fastened — no kerf required.",
    looks: "Round or D-shaped bulb with a flat base",
    common: "Casement windows, entry doors, swinging patio doors",
    measure: "Bulb diameter, base width, stem height",
    color: "bg-amber-50 border-amber-200", head: "text-amber-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=bulb",
  },
  {
    name: "Foam Seal",
    desc: "Soft, compressible foam — often with an adhesive backing. Used for low-pressure sealing on older windows or as supplemental insulation on storm panels.",
    looks: "Flat or rounded foam strip, often with peel-and-stick backing",
    common: "Older double-hung windows, storm windows, secondary glazing",
    measure: "Height and width of foam cross-section",
    color: "bg-slate-50 border-slate-200", head: "text-slate-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=foam",
  },
  {
    name: "Fin Seal (Pile Weatherstripping)",
    desc: "Fuzzy pile strips with a rigid center fin. Provides a wiper-style seal with low friction — ideal for sliding windows and patio doors where the seal moves with the sash.",
    looks: "Fuzzy or bristle-like pile with a flat or finned backing",
    common: "Sliding windows, sliding patio doors, double-hung sash channels",
    measure: "Pile height (1/4\", 5/16\", 3/8\"), base width, fin height",
    color: "bg-emerald-50 border-emerald-200", head: "text-emerald-800",
    href: "/shop?category=Window+Glazing+and+Weatherstrip&search=pile",
  },
  {
    name: "OEM-Specific Profiles",
    desc: "Custom-molded profiles unique to Andersen, Pella, Milgard, and other major manufacturers. Must match the exact profile — generic substitutes often do not seal properly.",
    looks: "Unique cross-section — may look like none of the above",
    common: "Andersen, Pella, Milgard, Marvin, and other brand-specific windows",
    measure: "Send us photos — OEM profiles require expert matching",
    color: "bg-purple-50 border-purple-200", head: "text-purple-800",
    href: "/parts-identification",
  },
];

const LOOKUP_TABLE = [
  { looks: "Fuzzy pile with a center fin", type: "Fin Seal", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=pile" },
  { looks: "Round bulb with a T-shaped barb leg", type: "Kerf Bulb Seal", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=kerf" },
  { looks: "Flat compressible foam, often adhesive-backed", type: "Foam Weatherstripping", href: "/shop?category=Window+Glazing+and+Weatherstrip&search=foam" },
  { looks: "Unique molded shape unlike standard profiles", type: "OEM-Specific Profile", href: "/parts-identification" },
];

const MISTAKES = [
  "Measuring a flattened or worn section — always cut a clean sample from an undamaged area",
  "Ordering by door or window brand alone — profile shape must match exactly",
  "Ignoring kerf width — 1/8\" and 3/16\" kerf seals are not interchangeable",
  "Matching by color — color varies across manufacturers and is not a reliable identifier",
  "Assuming \"close enough\" will seal — even small profile mismatches cause drafts and air leaks",
];

const FAQS = [
  { q: "How do I measure weatherstripping?", a: "Measure the profile from an undamaged section. For kerf seals, measure kerf width and bulb diameter. For fin seals, measure pile height and base width. For bulb seals, measure bulb diameter, base width, and stem height." },
  { q: "What if my weatherstripping is flattened?", a: "Flattened seals distort the true profile shape. Cut a clean 1–2 inch sample from an area that is still intact, or upload photos to our Free Parts ID Service for expert help." },
  { q: "What is kerf weatherstripping?", a: "Kerf weatherstripping has a T-shaped barb that press-fits into a narrow machined slot (the kerf) in the frame. Kerf width is typically 1/8\" or 3/16\" — these are not interchangeable." },
  { q: "What is the difference between bulb seal and kerf seal?", a: "A bulb seal compresses against a surface — it has no barb and is glued or fastened in a channel. A kerf seal locks into a machined slot. They are used in different applications and are not interchangeable." },
  { q: "Can I identify weatherstripping by color?", a: "No — color varies between manufacturers and is not a reliable identifier. Always identify by profile shape, kerf width, and dimensions." },
];

export default function GuideWeatherstripping() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Weatherstripping — Kerf, Bulb, Foam, Fin Seal, OEM Profiles"
        description="Learn how to identify window and door weatherstripping by profile shape, kerf size, bulb diameter, fin type, and OEM fitment. Includes measurement instructions and common mistakes."
        path="/guides/weatherstripping"
        keywords="weatherstripping identification, kerf weatherstripping, bulb seal, fin seal weatherstripping, pile weatherstripping, measure weatherstripping, window door seal replacement"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Weatherstripping</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Weatherstripping Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Weatherstripping
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">Kerf, Bulb, Foam, Fin Seal, and OEM Profiles — identified correctly.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of worn or failed weatherstripping:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Drafts around a closed window or door</li>
                <li>Rattling sash or door in wind</li>
                <li>Visible daylight around the frame when closed</li>
                <li>Increased heating or cooling costs</li>
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
                Cut a 1–2 inch piece from an area of the weatherstripping that is still intact — not flattened, crushed, or missing. A distorted sample will give you inaccurate profile measurements.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-sm font-bold text-blue-900 mb-1">Why this matters:</p>
                <p className="text-sm text-blue-800">Weatherstripping compresses over years of use. A worn section may be 30–50% shorter than its true profile height. Always measure from an undamaged section or compare to a known good piece.</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify Your Profile Type</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-5">Most weatherstripping falls into one of five categories. Your identification method and measurements depend on which type you have.</p>
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
                <p className="text-sm">Measurement requirements vary by profile type. Use the correct set for your seal.</p>
              </div>
              <div className="space-y-4">
                {[
                  { type: "Kerf Weatherstripping", color: "bg-blue-600", fields: ["Kerf width — the slot the T-barb presses into (typically 1/8\" or 3/16\")", "Bulb diameter — the round or hollow portion that contacts the sash", "Overall profile height — from top of bulb to bottom of barb"] },
                  { type: "Bulb Seal", color: "bg-amber-600", fields: ["Bulb diameter — the round or D-shaped compressible portion", "Base width — the flat mounting base that sits in the channel", "Stem height — distance from top of base to center of bulb"] },
                  { type: "Fin Seal (Pile)", color: "bg-emerald-600", fields: ["Pile height — 1/4\", 5/16\", or 3/8\" are the standard sizes", "Base width — width of the rigid backing strip", "Fin height (if present) — center fin that limits air bypass"] },
                ].map(({ type, color, fields }) => (
                  <div key={type} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className={`${color} text-white px-4 py-2.5 font-bold text-sm`}>{type}</div>
                    <ul className="px-4 py-3 space-y-1.5 text-sm text-slate-700">
                      {fields.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
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
                Lay your sample flat on a white surface and compare the silhouette to product cross-section drawings. Shape is the primary matching criterion — two seals of the same width and height may have completely different profiles.
              </p>
              <div className="bg-slate-900 text-white rounded-xl px-5 py-4">
                <p className="font-bold mb-2">Shape match is the #1 factor.</p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Color, hardness, and material are secondary. A replacement seal that matches dimensions but not profile shape will not compress correctly and will fail to seal.
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
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">If Your Seal Looks Like This &rarr; Go Here</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Profile type</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LOOKUP_TABLE.map(({ looks, type, href }) => (
                  <tr key={type} className="hover:bg-slate-50/50 transition-colors">
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
              <p className="text-blue-100 leading-relaxed">Upload a photo of your seal — cross-section preferred — and our experts will match the exact replacement profile. No charge, no obligation.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 font-bold" asChild>
              <Link href="/parts-identification"><PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID</Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 h-12 px-8" asChild>
              <Link href="/shop?category=Window+Glazing+and+Weatherstrip">Browse All Weatherstripping <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
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
            <Link href="/shop?category=Window+Glazing+and+Weatherstrip" className="text-primary font-semibold hover:underline">Shop Weatherstripping</Link>
            <Link href="/parts-identification" className="text-primary font-semibold hover:underline">Free Parts ID</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
