import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { ChevronRight, PackageSearch, AlertTriangle, CheckCircle2, Ruler, ChevronDown, Wrench } from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Patio Door Roller",
  description: "Step-by-step guide to identify the correct replacement patio door roller by wheel type, housing shape, dimensions, and mounting style.",
  totalTime: "PT20M",
  tool: [
    { "@type": "HowToTool", name: "Phillips screwdriver" },
    { "@type": "HowToTool", name: "Flat screwdriver" },
    { "@type": "HowToTool", name: "Tape measure or calipers" },
  ],
  step: [
    { "@type": "HowToStep", position: 1, name: "Remove the roller assembly", text: "Remove the roller from the bottom of the door by locating two screws on the bottom edge, a single adjustment screw, or a removable bottom rail depending on your door style." },
    { "@type": "HowToStep", position: 2, name: "Identify the wheel type", text: "Determine whether you have a steel wheel (heavy doors, older aluminum), nylon wheel (vinyl doors, quieter), or tandem wheel assembly (two wheels per side, used on large or hurricane-rated doors)." },
    { "@type": "HowToStep", position: 3, name: "Measure the roller housing", text: "Measure housing height, housing width, housing length, wheel diameter (1\", 1-1/4\", or 1-1/2\"), and mounting hole spacing. All five measurements are needed for accurate identification." },
    { "@type": "HowToStep", position: 4, name: "Identify the housing shape", text: "Note the housing shape: rectangular, slanted front, open-top, closed-top, deep-pocket, or shallow-pocket. Housing shape is often more specific to a brand than size alone." },
    { "@type": "HowToStep", position: 5, name: "Look for brand clues", text: "Check for stamped numbers, brand initials (A for Andersen, P for Pella, TRUTH for Truth Hardware), or unique housing shapes tied to specific manufacturers." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure a patio door roller?",
      acceptedAnswer: { "@type": "Answer", text: "Measure the housing height, width, length, wheel diameter, and mounting hole spacing. These five dimensions determine the correct replacement." },
    },
    {
      "@type": "Question",
      name: "What if my roller is rusted or missing?",
      acceptedAnswer: { "@type": "Answer", text: "You can still identify it by housing shape, wheel type, and door brand. Upload photos to our Free Parts ID Service for expert help." },
    },
    {
      "@type": "Question",
      name: "What is the difference between a tandem roller and a standard roller?",
      acceptedAnswer: { "@type": "Answer", text: "A tandem roller has two wheels mounted in a single housing side by side. They are used on heavy, large, or hurricane-rated patio doors and provide greater load capacity and stability than single-wheel rollers." },
    },
    {
      "@type": "Question",
      name: "Can I identify a patio door roller without removing it?",
      acceptedAnswer: { "@type": "Answer", text: "You can sometimes identify the wheel type visually from underneath the door, but you cannot measure the housing accurately without removing the roller. Measurement is required to match the correct replacement." },
    },
    {
      "@type": "Question",
      name: "Are patio door rollers universal?",
      acceptedAnswer: { "@type": "Answer", text: "No. Patio door rollers vary significantly by housing shape, wheel diameter, wheel material, and mounting hole spacing. Using the wrong roller can damage the track or cause the door to derail. Always match all five key dimensions." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",   item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Patio Door Roller", item: `${BASE_URL}/guides/patio-door-roller` },
  ],
};

const WHEEL_TYPES = [
  {
    name: "Steel Wheel",
    desc: "Most durable wheel type. Handles heavy doors without deforming. Common in older aluminum sliding doors and commercial applications.",
    looks: "Solid metal wheel, often with a machined groove for the track",
    common: "Older aluminum patio doors, commercial storefronts",
    color: "bg-slate-50 border-slate-200", head: "text-slate-800",
    href: "/shop?category=Door+Hardware&search=roller+steel",
  },
  {
    name: "Nylon Wheel",
    desc: "Quieter operation than steel. Works well on standard vinyl sliding doors under typical residential loads. May wear faster under heavy doors.",
    looks: "Plastic or nylon wheel, usually white, gray, or black",
    common: "Modern vinyl patio doors, light-duty residential",
    color: "bg-blue-50 border-blue-200", head: "text-blue-800",
    href: "/shop?category=Door+Hardware&search=roller+nylon",
  },
  {
    name: "Tandem Wheels",
    desc: "Two wheels per housing. Spreads the load across double the contact points. Required for heavy, oversized, or hurricane-impact-rated patio doors.",
    looks: "Long rectangular housing with two side-by-side wheels",
    common: "Large patio doors, hurricane-rated, commercial sliding doors",
    color: "bg-amber-50 border-amber-200", head: "text-amber-800",
    href: "/shop?category=Door+Hardware&search=tandem+roller",
  },
];

const HOUSING_SHAPES = [
  { shape: "Rectangular", desc: "Most common. Flat top and bottom, vertical sides. Fits standard track grooves on most vinyl and aluminum doors." },
  { shape: "Slanted front", desc: "Front face angles forward. Used on specific Pella and Andersen models where the bottom rail is angled." },
  { shape: "Open-top", desc: "No top plate — the wheel is exposed at the top. Common on Milgard and generic vinyl door rollers." },
  { shape: "Closed-top", desc: "Fully enclosed housing with a solid top plate. More rigid, used on heavier-duty aluminum door systems." },
  { shape: "Deep-pocket", desc: "Extra depth to accommodate larger diameter wheels. Used on commercial-grade or hurricane-rated door systems." },
];

const LOOKUP_TABLE = [
  { looks: "Single wheel, rectangular housing", type: "Standard roller", href: "/shop?category=Door+Hardware&search=roller" },
  { looks: "Two wheels in a long single housing", type: "Tandem roller", href: "/shop?category=Door+Hardware&search=tandem" },
  { looks: "Angled or slanted front housing", type: "Pella / Andersen style", href: "/parts-identification" },
  { looks: "Open-top housing, exposed wheel", type: "Milgard / generic vinyl", href: "/shop?category=Door+Hardware&search=roller" },
];

const MISTAKES = [
  "Measuring only the wheel diameter and ignoring the housing dimensions",
  "Ignoring the housing shape — two rollers with the same wheel size may not be interchangeable",
  "Assuming all 1-1/4\" wheel rollers fit the same door",
  "Ordering by door brand alone without measuring — roller styles can change between production years",
  "Replacing only one side when both rollers are the same age and wear rate",
];

const FAQS = [
  { q: "How do I measure a patio door roller?", a: "Measure the housing height, width, length, wheel diameter, and mounting hole spacing. All five dimensions are needed to match the correct replacement accurately." },
  { q: "What if my roller is rusted or missing?", a: "You can still identify it by housing shape, wheel type, and door brand. If the roller is fully gone, measure the track groove width and door bottom rail pocket — these constrain which roller will fit. Upload photos to our Free Parts ID Service for expert help." },
  { q: "What is the difference between a tandem roller and a standard roller?", a: "A tandem roller has two wheels in a single housing. They are used on heavy, large, or hurricane-rated patio doors and spread the load across double the contact area." },
  { q: "Can I identify a patio door roller without removing it?", a: "You can sometimes identify the wheel type visually from underneath the door, but you cannot measure the housing without removing it. Measurement is critical — do not skip this step." },
  { q: "Are patio door rollers universal?", a: "No. Rollers vary significantly by housing shape, wheel diameter, wheel material, and mounting pattern. Always match all five dimensions before ordering." },
];

export default function GuidePatioDoorRoller() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Patio Door Roller — Sliding Door Roller Identification Guide"
        description="Learn how to identify your patio door roller by wheel type, housing shape, dimensions, and mounting style. Includes measurement instructions and common mistakes."
        path="/guides/patio-door-roller"
        keywords="patio door roller identification, sliding door roller replacement, tandem roller, nylon wheel roller, steel wheel roller, measure patio door roller, door roller housing"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Patio Door Roller</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Patio Door Roller Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Patio Door Roller
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">
            Wheel type, housing shape, dimensions, and mounting style — identified correctly.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of worn or failed patio door rollers:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Sliding door is hard to open or close</li>
                <li>Door grinds, squeaks, or makes noise when sliding</li>
                <li>Door jumps off the track or derails</li>
                <li>Door drags on the floor or bottom of the frame</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-10 mb-16">

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Remove the Roller Assembly</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">
                You must remove the roller from the bottom of the door before you can measure it accurately. The method varies by door style.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <p className="text-sm font-bold text-slate-700 mb-2">Where to look for the fasteners:</p>
                <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                  <li>Two screws on the bottom edge of the door panel</li>
                  <li>A single adjustment screw on the bottom or side edge</li>
                  <li>A removable bottom rail on some vinyl sliding doors</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify Your Wheel Type</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-5">Three main wheel types are used in patio door rollers. Identify yours before measuring — they serve different door weights and track conditions.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {WHEEL_TYPES.map(({ name, desc, looks, common, color, head, href }) => (
                  <div key={name} className={`rounded-xl border p-5 ${color}`}>
                    <h3 className={`font-bold text-base mb-2 ${head}`}>{name}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">{desc}</p>
                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200 pt-3">
                      <p><span className="font-semibold">Looks like:</span> {looks}</p>
                      <p><span className="font-semibold">Common in:</span> {common}</p>
                    </div>
                    <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      Shop {name}s <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Measure the Roller Housing</h2>
            </div>
            <div className="pl-14">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <Ruler className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">All five measurements are required — two rollers with the same wheel diameter may have completely different housings.</p>
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
                      ["Housing height", "Overall height of the housing from bottom to top"],
                      ["Housing width",  "Width from left face to right face of the housing"],
                      ["Housing length", "Length of the housing from front to back"],
                      ["Wheel diameter", "Diameter of the wheel itself: 1\", 1-1/4\", or 1-1/2\""],
                      ["Mounting hole spacing", "Center-to-center distance between the two mounting screw holes"],
                    ].map(([meas, desc], i) => (
                      <tr key={meas} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                        <td className="px-4 py-3 font-medium text-slate-800">{meas}</td>
                        <td className="px-4 py-3 text-slate-600">{desc}</td>
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
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify the Housing Shape</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-5">Housing shape is often brand-specific and critical for fitment. Two rollers with identical wheel sizes can be completely incompatible if the housing shapes differ.</p>
              <div className="space-y-3">
                {HOUSING_SHAPES.map(({ shape, desc }) => (
                  <div key={shape} className="flex gap-3 border border-slate-200 rounded-lg px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{shape}</p>
                      <p className="text-sm text-slate-600">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">5</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Look for Brand Clues</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-4">Some rollers carry identifying marks that tie them directly to a brand. Check the housing body and wheel axle area carefully.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { brand: "Andersen",      clue: "Often stamped with \"A\" or a distinctive oval housing with angled sides" },
                  { brand: "Pella",         clue: "Unique slanted-front housing, often stamped \"P\" or with a Pella part number" },
                  { brand: "Truth / Milgard", clue: "Open-top or closed-top rectangular housing with stamped numbers on the body" },
                ].map(({ brand, clue }) => (
                  <div key={brand} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <p className="font-bold text-sm text-slate-800 mb-1">{brand}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{clue}</p>
                  </div>
                ))}
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
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">If Your Roller Looks Like This &rarr; Go Here</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Roller type</th>
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
              <p className="text-blue-100 leading-relaxed">
                Upload photos of your roller — including the housing, wheel, and any stamps — and our experts will identify the exact replacement and send you a direct link to purchase. No charge, no obligation.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 font-bold" asChild>
              <Link href="/parts-identification"><PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID</Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 h-12 px-8" asChild>
              <Link href="/shop?category=Door+Hardware&search=roller">Browse All Door Rollers <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
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
            <Link href="/shop?category=Door+Hardware" className="text-primary font-semibold hover:underline">Shop Door Hardware</Link>
            <Link href="/parts-identification" className="text-primary font-semibold hover:underline">Free Parts ID</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
