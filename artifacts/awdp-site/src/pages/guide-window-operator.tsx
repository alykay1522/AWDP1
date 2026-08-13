import { Link } from "wouter";
import { PageSeo } from "@/components/page-seo";
import { Button } from "@/components/ui/button";
import { ChevronRight, PackageSearch, AlertTriangle, CheckCircle2, Ruler, ChevronDown, Wrench } from "lucide-react";

const BASE_URL = "https://www.allwindowdoorparts.com";

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Identify Your Window Operator",
  description: "Step-by-step guide to identify a casement or awning window operator by arm style, link length, mounting hole pattern, and brand clues.",
  totalTime: "PT20M",
  tool: [
    { "@type": "HowToTool", name: "Phillips screwdriver" },
    { "@type": "HowToTool", name: "Tape measure or calipers" },
  ],
  step: [
    { "@type": "HowToStep", position: 1, name: "Remove the operator cover", text: "Most operator covers snap off or are held by one screw. Remove the cover to expose the gear housing and arm assembly before attempting identification." },
    { "@type": "HowToStep", position: 2, name: "Identify the operator type", text: "Determine whether you have a casement operator (opens sideways, one or two arms) or an awning operator (opens upward, usually a single straight arm)." },
    { "@type": "HowToStep", position: 3, name: "Identify the arm style", text: "Identify which of the five main arm styles you have: Single Arm, Dual Arm, Dyad Arm, Split Arm, or Scissor Arm." },
    { "@type": "HowToStep", position: 4, name: "Measure the arms", text: "Measure arm length pivot-to-tip, link length, offset angle, and mounting hole spacing. All four measurements are needed for correct identification." },
    { "@type": "HowToStep", position: 5, name: "Look for brand clues", text: "Truth/EntryGard operators often have stamped numbers (e.g., 45054, 45251) and distinctive gear housings. Andersen and Pella have unique mounting patterns that tie the operator to the brand." },
  ],
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I measure a window operator?",
      acceptedAnswer: { "@type": "Answer", text: "Measure the arm length (pivot to tip), link length, and mounting hole spacing. These determine the correct replacement." },
    },
    {
      "@type": "Question",
      name: "What if my operator has no markings?",
      acceptedAnswer: { "@type": "Answer", text: "Most operators can be identified by arm style and mounting pattern. Upload photos to our Free Parts ID Service for expert help." },
    },
    {
      "@type": "Question",
      name: "What is the difference between a single arm and a dual arm operator?",
      acceptedAnswer: { "@type": "Answer", text: "A single arm operator has one primary arm connected directly to the sash. A dual arm operator has a main arm and a secondary link arm — the two arms work together to push and guide the sash through its full open arc. Dual arm operators provide more controlled sash movement and are used on wider or heavier casement windows." },
    },
    {
      "@type": "Question",
      name: "What is a Dyad arm operator?",
      acceptedAnswer: { "@type": "Answer", text: "A Dyad arm operator uses a short offset link arm in addition to the main arm. The Dyad design allows the sash to open parallel to the frame rather than swinging in a traditional arc — common on Truth Hardware (EntryGard) systems for awning and casement windows." },
    },
    {
      "@type": "Question",
      name: "Are casement operators left-hand and right-hand specific?",
      acceptedAnswer: { "@type": "Answer", text: "Yes — most casement operators are handed. A left-hand operator is mounted on the left side of the frame (sash opens to the left), and a right-hand operator mounts on the right. Installing the wrong hand will prevent the sash from opening properly." },
    },
  ],
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home",   item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Guides", item: `${BASE_URL}/guides` },
    { "@type": "ListItem", position: 3, name: "How to Identify Your Window Operator", item: `${BASE_URL}/guides/window-operator` },
  ],
};

const OPERATOR_TYPES = [
  {
    name: "Casement Operator",
    desc: "Opens the sash sideways (left or right). Has one or two arms connected to the sash. Most common type for casement windows. These are handed — left-hand and right-hand are not interchangeable.",
    common: "Casement windows — Truth/EntryGard, Andersen, Pella, Marvin",
    color: "bg-blue-50 border-blue-200", head: "text-blue-800",
    href: "/shop?category=Window+Hardware&search=casement+operator",
  },
  {
    name: "Awning Operator",
    desc: "Opens the sash upward. Usually a single straight arm with a simpler linkage. Not handed in most cases. Used on awning-style windows that hinge at the top.",
    common: "Awning windows — Truth/EntryGard, Andersen, Pella, and generic vinyl",
    color: "bg-amber-50 border-amber-200", head: "text-amber-800",
    href: "/shop?category=Window+Hardware&search=awning+operator",
  },
];

const ARM_STYLES = [
  { name: "Single Arm", desc: "One arm from gear housing to sash. Simpler design used on narrower or lighter casement windows.", href: "/shop?category=Window+Hardware&search=single+arm+operator" },
  { name: "Dual Arm", desc: "Main arm plus a secondary link arm. Guides sash through a controlled open arc. Used on wider, heavier casements.", href: "/shop?category=Window+Hardware&search=dual+arm+operator" },
  { name: "Dyad Arm", desc: "Short offset link arm that opens the sash parallel to the frame rather than in a traditional arc. Common on Truth/EntryGard systems.", href: "/shop?category=Window+Hardware&search=dyad+operator" },
  { name: "Split Arm", desc: "A two-piece arm assembly with a pivot joint in the middle. Allows the sash to open wider without the arm fouling the frame.", href: "/shop?category=Window+Hardware&search=split+arm" },
  { name: "Scissor Arm", desc: "Two arms that cross each other as the window opens — like scissors. Provides wide opening range on narrower frames.", href: "/shop?category=Window+Hardware&search=scissor+operator" },
];

const LOOKUP_TABLE = [
  { looks: "Two arms with a gear housing, sash opens sideways", type: "Dual Arm Casement", href: "/shop?category=Window+Hardware&search=dual+arm" },
  { looks: "One straight arm, sash opens sideways", type: "Single Arm Casement", href: "/shop?category=Window+Hardware&search=single+arm" },
  { looks: "Two arms that cross and scissor open", type: "Scissor Operator", href: "/shop?category=Window+Hardware&search=scissor" },
  { looks: "Short link arm with offset, parallel opening", type: "Dyad Operator", href: "/shop?category=Window+Hardware&search=dyad" },
  { looks: "Single arm, sash opens upward", type: "Awning Operator", href: "/shop?category=Window+Hardware&search=awning" },
];

const MISTAKES = [
  "Measuring only the long main arm and ignoring the link arm — both must be matched",
  "Ordering by handle style instead of operator style — handle and operator are separate parts",
  "Ignoring handedness — left-hand and right-hand operators are not interchangeable",
  "Assuming all dual-arm operators for the same brand are identical — arm lengths vary by window size",
  "Replacing the operator without checking the arm connection point at the sash — some require a sash bracket update",
];

const BRAND_CLUES = [
  { brand: "Truth / EntryGard", clue: "Stamped numbers on the housing: 45054, 45251, 45072, and similar codes. Distinctive round gear housing with specific arm attachment styles." },
  { brand: "Andersen", clue: "Unique mounting footprint with specific hole spacing. Often has a distinctive flat cover plate. Arm shape is proprietary." },
  { brand: "Pella", clue: "Compact gear housing with different mounting screw pattern than Truth. Arm attachment to sash uses a unique clip or pin system." },
  { brand: "Generic / Vinyl", clue: "May have no markings. Identify by housing shape, arm style, and mounting hole spacing. Upload photos for expert matching." },
];

const FAQS = [
  { q: "How do I measure a window operator?", a: "Measure the arm length from pivot to tip, the link arm length, the offset angle if present, and the center-to-center mounting hole spacing. All four measurements are needed." },
  { q: "What if my operator has no markings?", a: "Most operators can be identified by arm style, mounting pattern, and housing shape. Upload photos of the operator from multiple angles to our Free Parts ID Service for expert matching." },
  { q: "What is the difference between a single arm and dual arm operator?", a: "A single arm has one primary arm. A dual arm has a main arm and a secondary link arm that work together to guide the sash. Dual arm operators provide more controlled movement on wider windows." },
  { q: "What is a Dyad arm operator?", a: "A Dyad arm uses a short offset link that opens the sash parallel to the frame rather than in a traditional arc. Common on Truth/EntryGard casement and awning systems." },
  { q: "Are casement operators left-hand and right-hand specific?", a: "Yes — most casement operators are handed. Installing the wrong hand will prevent the sash from opening correctly. Always confirm the hand before ordering." },
];

export default function GuideWindowOperator() {
  return (
    <div className="min-h-screen bg-white">
      <PageSeo
        title="How to Identify Your Window Operator — Casement & Awning Crank Identification Guide"
        description="Identify your casement or awning window operator by arm style, link length, mounting hole pattern, and brand clues. Includes measurement instructions and common mistakes."
        path="/guides/window-operator"
        structuredData={[howToSchema, faqSchema, breadcrumbSchema] as unknown as object[]}
      />

      <div className="border-b bg-slate-50 py-3">
        <div className="container mx-auto px-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-400">Guides</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
            <span className="text-slate-700 font-medium">How to Identify Your Window Operator</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary border border-primary/15 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> Window Operator Guide
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-slate-900 leading-tight mb-4">
            How to Identify Your Window Operator
          </h1>
          <p className="text-lg text-slate-500 mb-6 font-medium">Casement &amp; Awning Crank Identification — arm style, link length, mounting pattern.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-amber-900 mb-1">Common symptoms of a worn or failed window operator:</p>
              <ul className="text-sm text-amber-800 space-y-0.5 list-disc list-inside">
                <li>Casement or awning window won't open or close fully</li>
                <li>Crank handle spins freely without moving the sash</li>
                <li>Window won't stay in the open position</li>
                <li>Grinding, popping, or clicking when cranking</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-10 mb-16">
          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">1</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Remove the Operator Cover</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 leading-relaxed mb-4">
                Most operator covers snap off or are held by a single screw. Remove the cover completely to expose the gear housing and the full arm assembly before measuring.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
                <p className="font-bold text-slate-700 mb-1">Also remove the crank handle</p>
                <p>The handle is a separate part — usually retained by a set screw or clip. Removing it exposes the drive shaft size and any stamped markings on the housing top.</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">2</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify the Operator Type</h2>
            </div>
            <div className="pl-14">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {OPERATOR_TYPES.map(({ name, desc, common, color, head, href }) => (
                  <div key={name} className={`rounded-xl border p-5 ${color}`}>
                    <h3 className={`font-bold text-base mb-2 ${head}`}>{name}</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-3">{desc}</p>
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
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">3</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Identify the Arm Style</h2>
            </div>
            <div className="pl-14">
              <p className="text-slate-600 mb-5">There are five main arm styles. Arm style determines how many arms need to be measured and which replacement assembly to order.</p>
              <div className="space-y-3">
                {ARM_STYLES.map(({ name, desc, href }) => (
                  <div key={name} className="flex gap-4 border border-slate-200 rounded-lg px-4 py-3 items-start">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-800">{name}</p>
                      <p className="text-sm text-slate-600">{desc}</p>
                    </div>
                    <Link href={href} className="text-primary text-xs font-bold hover:underline whitespace-nowrap shrink-0 mt-0.5">Shop &rarr;</Link>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shrink-0">4</div>
              <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900">Measure the Arms</h2>
            </div>
            <div className="pl-14">
              <div className="flex items-center gap-2 mb-4 text-slate-500">
                <Ruler className="w-4 h-4 shrink-0" aria-hidden="true" />
                <p className="text-sm">Measure both the main arm and the link arm — they are often different lengths.</p>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">Measurement</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-700">How to measure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["Arm length",           "Center of pivot pin at housing to center of sash attachment pin"],
                      ["Link length",          "Center-to-center of the link arm (if present)"],
                      ["Offset angle",         "Angle of the arm at rest relative to the housing face"],
                      ["Mounting hole spacing", "Center-to-center distance between the housing mounting screws"],
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BRAND_CLUES.map(({ brand, clue }) => (
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
          <h2 className="text-xl md:text-2xl font-serif font-bold text-slate-900 mb-5">If Your Operator Looks Like This &rarr; Go Here</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">What you see</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-700">Operator type</th>
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
              <p className="text-blue-100 leading-relaxed">Upload photos of your operator — housing, arms, and any stamped numbers — and our experts will match the exact replacement. No charge, no obligation.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button size="lg" className="bg-red-600 hover:bg-red-700 border-0 text-white h-12 px-8 font-bold" asChild>
              <Link href="/parts-identification"><PackageSearch className="mr-2 w-5 h-5" aria-hidden="true" /> Upload a Photo — Free Parts ID</Link>
            </Button>
            <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10 h-12 px-8" asChild>
              <Link href="/shop?category=Window+Hardware">Browse All Window Hardware <ChevronRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
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
            <Link href="/shop?category=Window+Hardware" className="text-primary font-semibold hover:underline">Shop Window Hardware</Link>
            <Link href="/parts-identification" className="text-primary font-semibold hover:underline">Free Parts ID</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
