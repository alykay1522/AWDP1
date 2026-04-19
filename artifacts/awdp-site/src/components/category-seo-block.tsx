import { Link } from "wouter";
import { PackageSearch, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CategorySeoContent {
  heading: string;
  intro: string;
  bullets: string[];
  closingLine: string;
}

const categoryContent: Record<string, CategorySeoContent> = {
  "Window Balances and Accessories": {
    heading: "Window Balances – Replacement Parts & Expert Matching",
    intro: "Finding the right window balance for your window shouldn't be difficult. At All Window Door Parts, we specialize in hard-to-find, discontinued, and OEM-specific window balance hardware for every major brand. Whether you're fixing a double-hung window that won't stay up or replacing a failed channel balance, our experts ensure you get the exact part the first time.",
    bullets: [
      "Block & tackle, spiral, constant force, and channel balances",
      "Vinyl, wood, aluminum, and composite window applications",
      "Residential and commercial grade options",
      "Obsolete and discontinued balance systems",
      "All major balance lengths and weight ratings",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers restore smooth operation and extend the life of their windows.",
  },
  "Window Balances": {
    heading: "Window Balances – Replacement Parts & Expert Matching",
    intro: "Finding the right window balance for your window shouldn't be difficult. At All Window Door Parts, we specialize in hard-to-find, discontinued, and OEM-specific window balance hardware for every major brand. Whether you're fixing a double-hung window that won't stay up or replacing a failed spiral balance, our experts ensure you get the exact part the first time.",
    bullets: [
      "Block & tackle, spiral, constant force, and coil balances",
      "Vinyl, wood, aluminum, and composite window applications",
      "Residential and commercial grade options",
      "Obsolete and discontinued balance systems",
      "All major balance lengths and weight ratings",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers restore smooth operation and extend the life of their windows.",
  },
  "Sash Hardware": {
    heading: "Sash Hardware – Replacement Parts & Expert Matching",
    intro: "Finding the right sash hardware for your window shouldn't be difficult. At All Window Door Parts, we stock tilt latches, sash locks, cam locks, keepers, and related sash hardware for virtually every window system — including legacy and discontinued lines.",
    bullets: [
      "Tilt latches and tilt latch pivots",
      "Sash locks and sash keepers",
      "Cam locks and sweep locks",
      "Vinyl, wood, and aluminum window applications",
      "Obsolete and discontinued sash hardware",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers keep their windows secure and operating smoothly.",
  },
  "Window Hardware": {
    heading: "Window Hardware – Replacement Parts & Expert Matching",
    intro: "Finding the right window hardware for your specific window system shouldn't be difficult. At All Window Door Parts, we carry operators, hinges, handles, locks, and related hardware for every major window brand — including hard-to-find and discontinued parts.",
    bullets: [
      "Casement and awning window operators",
      "Window handles, cranks, and levers",
      "Hinges, arms, and pivot bars",
      "Locks, keepers, and latches",
      "Modern and legacy hardware systems",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers restore smooth operation and improve security on their windows.",
  },
  "Door Hardware": {
    heading: "Door Hardware – Replacement Parts & Expert Matching",
    intro: "Finding the right door hardware for your patio, storm, or entry door shouldn't be difficult. At All Window Door Parts, we carry rollers, hinges, locks, handles, and tracks for virtually every major door system — including obsolete and discontinued hardware.",
    bullets: [
      "Patio door rollers and track guides",
      "Door hinges and pivot hardware",
      "Multipoint locks and single-point locks",
      "Handles, levers, and pull hardware",
      "Residential and commercial applications",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers keep their doors secure, smooth, and operating correctly.",
  },
  "Window Glazing and Weatherstrip": {
    heading: "Window Glazing & Weatherstripping – Replacement Parts & Expert Matching",
    intro: "Finding the right glazing or weatherstripping for your window or door shouldn't be difficult. At All Window Door Parts, we stock glazing beads, setting blocks, foam seals, and weatherstrip for virtually every window and door system — including hard-to-match profiles.",
    bullets: [
      "Foam, rubber, and vinyl weatherstripping profiles",
      "Glazing beads and glazing tape",
      "Corner keys and seals",
      "Pile weatherstrip and compression strips",
      "Vinyl, wood, aluminum, and composite applications",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers stop drafts, prevent leaks, and restore the energy efficiency of their windows and doors.",
  },
  "Screen Hardware and Accessories": {
    heading: "Screen Hardware & Accessories – Replacement Parts & Expert Matching",
    intro: "Finding the right screen hardware for your window or door system shouldn't be difficult. At All Window Door Parts, we stock rollers, handles, guides, and frame components for screen doors and window screens — including replacement parts for discontinued systems.",
    bullets: [
      "Screen door rollers and guides",
      "Screen door handles and pulls",
      "Screen frame corners and spline",
      "Window screen clips and hardware",
      "Residential and commercial screen applications",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers maintain and restore their window and door screens.",
  },
  "Other Hardware": {
    heading: "Specialty Window & Door Hardware – Replacement Parts & Expert Matching",
    intro: "Finding the right specialty hardware for your window or door system shouldn't be difficult. At All Window Door Parts, we carry a wide range of miscellaneous replacement hardware for windows and doors — including hard-to-find and obsolete parts.",
    bullets: [
      "Vinyl, wood, aluminum, and composite window applications",
      "Residential and commercial hardware",
      "Modern and legacy hardware systems",
      "Obsolete and discontinued product lines",
    ],
    closingLine: "With 40+ years of experience and a veteran-owned commitment to service, we help homeowners, contractors, and property managers find the exact parts they need — even when no one else can.",
  },
};

// Keyword-to-category mapping for search-based pages
// Keys must match terms users actually search for (and that return results from the catalog)
const searchKeywordMap: Record<string, string> = {
  "casement": "Window Hardware",
  "awning": "Window Hardware",
  "operator": "Window Hardware",
  "crank": "Window Hardware",
  "handle": "Window Hardware",
  "pivot": "Window Hardware",
  "balance": "Window Balances",
  "channel balance": "Window Balances",
  "tilt tube": "Window Balances",
  "roller": "Door Hardware",
  "hinge": "Door Hardware",
  "patio": "Door Hardware",
  "lock": "Sash Hardware",
  "latch": "Sash Hardware",
  "keeper": "Sash Hardware",
  "seal": "Window Glazing and Weatherstrip",
  "glazing": "Window Glazing and Weatherstrip",
  "screen": "Screen Hardware and Accessories",
};

function matchCategory(search: string | null, category: string | null): string | null {
  if (category && categoryContent[category]) return category;
  if (!search) return null;
  const lower = search.toLowerCase();
  for (const [keyword, cat] of Object.entries(searchKeywordMap)) {
    if (lower.includes(keyword)) return cat;
  }
  return null;
}

function GuideCallout({ headline, body, href }: { headline: string; body: string; href: string }) {
  return (
    <div className="mb-5 bg-slate-900 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex-1">
        <p className="font-bold text-white mb-0.5">{headline}</p>
        <p className="text-slate-400 text-sm">{body}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 transition-colors font-bold text-sm px-4 py-2.5 rounded-lg whitespace-nowrap"
      >
        Read the Guide <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

interface CategorySeoBlockProps {
  search?: string | null;
  category?: string | null;
}

export function CategorySeoBlock({ search, category }: CategorySeoBlockProps) {
  const matched = matchCategory(search ?? null, category ?? null);
  const content = matched ? categoryContent[matched] : null;

  if (!content) return null;

  return (
    <section className="mt-16 bg-white border rounded-2xl p-8 md:p-12">
      <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">{content.heading}</h2>
      <p className="text-slate-600 leading-relaxed mb-6">{content.intro}</p>

      <p className="font-bold text-slate-800 mb-3">We carry these parts for:</p>
      <ul className="mb-6 space-y-2">
        {content.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            {bullet}
          </li>
        ))}
      </ul>

      <p className="text-slate-600 leading-relaxed mb-8">{content.closingLine}</p>

      {/* Guide callouts — category-specific */}
      {(matched === "Window Balances" || matched === "Window Balances and Accessories") && (
        <GuideCallout
          headline="Not sure how to identify your balance type or measure it correctly?"
          body="Read our step-by-step guide — channel, spiral, coil, and specialty balances all covered, including measurement instructions and common mistakes."
          href="/guides/window-balance"
        />
      )}
      {matched === "Window Hardware" && (
        <GuideCallout
          headline="Not sure how to identify your casement or awning operator?"
          body="Read our step-by-step guide — single arm, dual arm, dyad, scissor, and awning operators all covered, including arm measurement and brand clues."
          href="/guides/window-operator"
        />
      )}
      {matched === "Door Hardware" && (
        <>
          <GuideCallout
            headline="Not sure how to identify your patio door roller?"
            body="Read our guide — steel wheel, nylon wheel, and tandem rollers covered, with housing measurement instructions and common mistakes."
            href="/guides/patio-door-roller"
          />
          <GuideCallout
            headline="Not sure how to identify your door lock or mortise case?"
            body="Read our guide — hook latches, mortise locks, multi-point systems, and entry door hardware covered, with faceplate and backset measurement instructions."
            href="/guides/door-lock"
          />
        </>
      )}
      {matched === "Window Glazing and Weatherstrip" && (
        <>
          <GuideCallout
            headline="Not sure how to identify your weatherstripping profile?"
            body="Read our guide — kerf, bulb, foam, fin seal, and OEM profiles all covered, including measurement instructions and shape-matching tips."
            href="/guides/weatherstripping"
          />
          <GuideCallout
            headline="Not sure how to identify your glazing bead?"
            body="Read our guide — snap-in vinyl, kerf-in, aluminum, and OEM-specific bead profiles covered, with measurement instructions and common mistakes."
            href="/guides/glazing-bead"
          />
        </>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <PackageSearch className="w-8 h-8 text-blue-600 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold text-blue-900 mb-0.5">Not sure which part you need?</p>
          <p className="text-sm text-blue-700">
            Use our Free Parts ID Service — upload photos and our experts will match the exact replacement for you, at no charge.
          </p>
        </div>
        <Button asChild className="bg-blue-700 hover:bg-blue-800 text-white border-0 shrink-0">
          <Link href="/parts-identification">
            <PackageSearch className="w-4 h-4 mr-2" aria-hidden="true" /> Free Parts ID
          </Link>
        </Button>
      </div>
    </section>
  );
}

// General catalog SEO block for the all-categories page
export function CatalogSeoBlock() {
  return (
    <section className="mt-12 bg-white border rounded-2xl p-8 md:p-12">
      <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">
        America's Source for Window & Door Replacement Hardware
      </h2>
      <p className="text-slate-600 leading-relaxed mb-6">
        All Window Door Parts is America's trusted source for window and door hardware, specializing in obsolete,
        discontinued, and hard-to-find replacement parts. With over 40 years of hands-on experience, we help homeowners,
        contractors, and property managers identify and replace the exact parts needed to restore smooth, secure operation.
        From{" "}
        <Link href="/shop?search=casement" className="text-primary font-semibold hover:underline">operators</Link>,{" "}
        <Link href="/shop?search=balance" className="text-primary font-semibold hover:underline">balances</Link>,{" "}
        <Link href="/shop?search=roller" className="text-primary font-semibold hover:underline">rollers</Link>,{" "}
        <Link href="/shop?search=lock" className="text-primary font-semibold hover:underline">locks</Link>,{" "}
        <Link href="/shop?search=latch" className="text-primary font-semibold hover:underline">tilt latches</Link>,{" "}
        <Link href="/shop?search=hinge" className="text-primary font-semibold hover:underline">hinges</Link>, and{" "}
        <Link href="/shop?category=Window+Glazing+and+Weatherstrip" className="text-primary font-semibold hover:underline">weatherstripping</Link>,
        we carry solutions for nearly every brand and window type.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { stat: "4,000+", label: "Parts in Stock" },
          { stat: "40+",     label: "Years Experience" },
          { stat: "100%",    label: "Veteran Owned" },
        ].map(({ stat, label }) => (
          <div key={label} className="bg-slate-50 border rounded-xl p-4 text-center">
            <div className="text-3xl font-serif font-bold text-primary">{stat}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <PackageSearch className="w-8 h-8 text-blue-600 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold text-blue-900 mb-0.5">Can't find the right category?</p>
          <p className="text-sm text-blue-700">
            Upload a photo of your part. Our experts will identify it and send you a direct link to purchase — completely free.
          </p>
        </div>
        <Button asChild className="bg-blue-700 hover:bg-blue-800 text-white border-0 shrink-0">
          <Link href="/parts-identification">
            <PackageSearch className="w-4 h-4 mr-2" aria-hidden="true" /> Free Parts ID
          </Link>
        </Button>
      </div>
    </section>
  );
}
