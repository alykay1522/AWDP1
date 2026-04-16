import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { ChevronRight, PackageSearch, AlertTriangle, CheckCircle2, Ruler, ChevronDown, Wrench } from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Door Lock",
  description: "Step-by-step guide to identify a sliding, patio, or entry door lock by faceplate shape, screw spacing, mortise depth, and latch style.",
  totalTime: "PT20M",
  tool: [
    { "@type": "HowToTool", name: "Phillips screwdriver" },
    { "@type": "HowToTool", name: "Tape measure or calipers" },
  ],
  step: [
    { "@type": "HowToStep", position: 1, name: "Identify the door type", text: "Determine whether you have a sliding patio door, swinging patio door, or entry door — each uses different lock hardware and measurement methods." },
    { "@type": "HowToStep", position: 2, name: "Remove the lock or faceplate", text: "Remove the lock from the door to measure it accurately. Most locks are held by two or four screws on the faceplate or the interior rose plate." },
    { "@type": "HowToStep", position: 3, name: "Identify the lock style", text: "For sliding doors: hook latch, mortise lock, surface-mounted lock, or multi-point lock. For swinging doors: lever latch, deadbolt, or multi-point system." },
    { "@type": "HowToStep", position: 4, name: "Measure the critical dimensions", text: "Measure faceplate height, faceplate width, screw hole spacing, backset (distance from door edge to spindle center), mortise depth, and latch style." },
    { "@type": "HowToStep", position: 5, name: "Look for brand clues", text: "Check for brand stamps on the faceplate or body: Andersen, Pella, Milgard, Truth, Hoppe. These brands use proprietary lock profiles that require brand-matched replacements." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure a door lock?",
      acceptedAnswer: { "@type": "Answer", text: "Measure faceplate height, width, screw spacing, backset, and mortise depth. These determine the correct replacement." },
    },
    {
      "@type": "Question",
      name: "What if my lock has no markings?",
      acceptedAnswer: { "@type": "Answer", text: "Most locks can be identified by faceplate shape and backset. Upload photos to our Free Parts ID Service for expert help." },
    },
    {
      "@type": "Question",
      name: "What is a mortise lock?",
      acceptedAnswer: { "@type": "Answer", text: "A mortise lock is a lock case that installs inside a pocket (mortise) cut into the door panel. The lock case slides into this pocket and is held by the faceplate. Mortise locks are common on patio sliding doors and are the most brand-specific lock style — always measure the full case dimensions before ordering." },
    },
    {
      "@type": "Question",
      name: "What is a multi-point lock?",
      acceptedAnswer: { "@type": "Answer", text: "A multi-point lock engages three or more locking points along the door edge with a single handle operation. Common on European-style entry doors and high-security patio doors. The lock strip height, point spacing, and backset must all match the original exactly." },
    },
    {
      "@type": "Question",
      name: "What is the backset on a door lock?",
      acceptedAnswer: { "@type": "Answer", text: "The backset is the distance from the edge of the door to the center of the spindle (or keyhole). Standard backsets are 2-3/8\" and 2-3/4\" for entry doors. On sliding door mortise locks, the backset determines where the handle spindle exits the face of the door." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",   item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Door Lock", item: `${BASE_URL}/guides/door-lock` },
  ],
};

const LOCK_STYLES = [
  {
    name: "Hook Latch",
    desc: "A hook-shaped bolt that engages a strike plate or keeper. Most common on sliding patio doors. When the door closes, the hook rotates to engage the strike.",
    common: "Sliding patio doors — Andersen, Pella, Milgard, generic vinyl",
    color: "bg-blue-50 border-blue-200", head: "text-blue-800",
    href: "/shop?category=Door+Hardware&search=hook+latch",
  },
  {
    name: "Mortise Lock",
    desc: "Full lock case that installs in a pocket cut into the door. Contains the latch, bolt, and actuating mechanism in a single housing. Highly brand-specific.",
    common: "Sliding and swinging patio doors — all major brands",
    color: "bg-amber-50 border-amber-200", head: "text-amber-800",
    href: "/shop?category=Door+Hardware&search=mortise+lock",
  },
  {
    name: "Surface-Mounted Lock",
    desc: "Lock body attaches to the surface of the door panel without a mortise pocket. Simpler installation, common on lighter or older sliding doors.",
    common: "Older aluminum sliding doors, storm doors",
    color: "bg-slate-50 border-slate-200", head: "text-slate-800",
    href: "/shop?category=Door+Hardware&search=surface+lock",
  },
  {
    name: "Multi-Point Lock",
    desc: "A tall lock strip that engages three or more points along the door edge with a single handle movement. Provides superior air and water sealing. Must match exactly.",
    common: "European-style entry doors, Hoppe, Andersen, Pella high-security",
    color: "bg-emerald-50 border-emerald-200", head: "text-emerald-800",
    href: "/shop?category=Door+Hardware&search=multi+point+lock",
  },
];

const LOOKUP_TABLE = [
  { looks: "Hook-shaped bolt, sliding door", type: "Sliding door hook latch", href: "/shop?category=Door+Hardware&search=hook" },
  { looks: "Tall strip with multiple bolt points", type: "Multi-point lock", href: "/shop?category=Door+Hardware&search=multi+point" },
  { looks: "Short rectangular case, inserted into door", type: "Standard mortise lock", href: "/shop?category=Door+Hardware&search=mortise" },
  { looks: "Lock body mounted on door surface", type: "Surface-mounted lock", href: "/shop?category=Door+Hardware&search=surface" },
];

const MISTAKES = [
  "Measuring only the faceplate — the mortise case depth and overall height are equally critical",
  "Ignoring the backset — 2-3/8\" and 2-3/4\" are not interchangeable on entry doors",
  "Ordering by door brand alone — lock styles change between production years for the same brand",
  "Assuming all mortise locks are interchangeable — even small dimension differences prevent the lock from fitting",
  "Forgetting to measure the strike plate — the strike must match the latch style",
];

const FAQS = [
  { q: "How do I measure a door lock?", a: "Measure faceplate height and width, screw hole spacing (center-to-center), backset (door edge to spindle center), mortise depth (how deep the pocket is), and latch style (hook, tongue, or deadbolt). All six are needed." },
  { q: "What if my lock has no markings?", a: "Most locks can be identified by faceplate shape and backset measurement. Upload clear photos of the faceplate, the removed lock case, and any visible stamps to our Free Parts ID Service." },
  { q: "What is a mortise lock?", a: "A mortise lock installs inside a pocket cut into the door panel. It contains the latch, bolt, and actuating mechanism in one housing. It is the most brand-specific lock style — always measure the full case." },
  { q: "What is a multi-point lock?", a: "A multi-point lock engages three or more locking points along the door edge with a single handle. The strip height, point spacing, and backset must all match exactly — these are not universally interchangeable." },
  { q: "What is the backset on a door lock?", a: "The backset is the distance from the edge of the door to the center of the spindle or keyhole. Standard sizes are 2-3/8\" and 2-3/4\" for most entry doors. This dimension must match your door boring." },
];

export default function GuideDoorLock() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Door Lock — Sliding, Patio, and Entry Door Lock Identification Guide"
        description="Identify your sliding door lock or entry door handleset by faceplate shape, screw spacing, mortise depth, and latch style. Includes measurement instructions and brand clues."
        path="/guides/door-lock"
        keywords="door lock identification, sliding door lock replacement, mortise lock, multi-point lock, patio door lock, hook latch, door lock backset, door lock faceplate measurement"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Door Lock</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Door Lock Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Door Lock
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">Sliding, Patio, and Entry Door Locks — faceplate, backset, mortise, and latch style.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of a worn or failed door lock:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Door won't latch or stay closed</li>
                <li>Key turns but lock doesn't engage</li>
                <li>Handle is loose, broken, or spins without actuating the latch</li>
                <li>Hook latch won't rotate to engage the strike</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-10 mb-16">
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify Your Door Type</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-4">Lock hardware varies significantly between door types. Identify yours first — it determines which lock styles apply and how to measure.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { type: "Sliding Patio Door", desc: "Door panel slides horizontally. Uses hook latches, mortise locks, or surface-mounted locks." },
                  { type: "Swinging Patio Door", desc: "Door panel hinges and swings open. Uses lever latches, deadbolts, or multi-point systems." },
                  { type: "Entry Door", desc: "Primary exterior entry. Uses lever or knob locksets, deadbolts, and backset-specific hardware." },
                ].map(({ type, desc }) => (
                  <div key={type} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <p className="font-bold text-sm text-slate-800 mb-1">{type}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Remove the Lock or Faceplate</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">Remove the lock completely before measuring. You cannot accurately measure a mortise lock while it is installed in the door.</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
                <p className="font-bold text-slate-700 mb-1">Typical fastener locations:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Two to four screws on the door faceplate (edge of door)</li>
                  <li>Screws on the interior rose or escutcheon plate</li>
                  <li>Set screw on handle hub (for handle removal)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify the Lock Style</h2>
            </div>
            <div className="pl-14">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {LOCK_STYLES.map(({ name, desc, common, color, head, href }) => (
                  <div key={name} className={`rounded-xl border p-5 ${color}`}>
                    <h3 className={`font-bold text-base mb-2 ${head}`}>{name}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-2">{desc}</p>
                    <p className="text-xs text-slate-600 mb-3"><span className="font-semibold">Common in:</span> {common}</p>
                    <Link href={href} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                      Shop {name}s <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Measure the Critical Dimensions</h2>
            </div>
            <div className="pl-14">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <Ruler className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">Six measurements determine the correct replacement. Missing any one of them risks ordering the wrong lock.</p>
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
                      ["Faceplate height",    "Top to bottom of the faceplate (the flat plate on the door edge)"],
                      ["Faceplate width",     "Side to side of the faceplate"],
                      ["Screw hole spacing",  "Center-to-center distance between the faceplate mounting screws"],
                      ["Backset",             "Distance from the door edge to the center of the spindle hole"],
                      ["Mortise depth",       "How deep the mortise pocket is cut into the door (if applicable)"],
                      ["Latch style",         "Hook, tongue/bolt, hook-over-roller, or deadbolt — describe or photograph"],
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
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">5</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Look for Brand Clues</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-4">Door lock hardware is highly brand-specific. Check the faceplate, lock body, and interior rose plate for any stamps or labels.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {["Andersen", "Pella", "Milgard", "Truth", "Hoppe (multi-point)", "Marvin"].map((brand) => (
                  <div key={brand} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 text-center">
                    {brand}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">These brands use proprietary lock profiles. A replacement from a different brand will not fit even if dimensions are similar.</p>
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
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">If Your Lock Looks Like This &rarr; Go Here</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Lock type</th>
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
              <p className="text-blue-100 leading-relaxed">Upload photos of your lock — faceplate, removed lock case, and any stamps — and our experts will identify the exact replacement. No charge, no obligation.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 font-bold" asChild>
              <Link href="/parts-identification"><PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID</Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 h-12 px-8" asChild>
              <Link href="/shop?category=Door+Hardware">Browse All Door Hardware <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
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
