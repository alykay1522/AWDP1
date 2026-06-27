import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Search, Camera, Phone, ChevronRight, HelpCircle } from "lucide-react";
import { PageSeo } from "@/components/page-seo";
import { Breadcrumb } from "@/components/breadcrumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FaqGroup {
  title: string;
  questions: string[];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Ordering, Identification & Commercial Service",
    questions: [
      "What Double Hung Window Services and Products do we offer?",
      "Large U.S. Apartment Managers Association asks? - Can we get volume discounts?",
      "Our property management company services several area condos - can you supply us at a discount?",
      "QUESTION: How do I identify my product based on glass etchings | serial numbers | stampings?",
      "Is the AllWindowDoorPartsGroup [AWDPG] Helpful with old Marvin Parts Identification?",
      "How do I determine handing?",
      "Who is the best Colorado Springs Window Repair Guru for restoration and repairs?",
      "From Cincinnatti - I am on a fixed income and cannot afford high costs of replacement parts - can you help?",
      "Where can I find parts for my old windows and patio doors here in Colorado Springs?",
      "Where can I get the best Deer Hunting Stand Windows?",
      "How Do I Find Old Obsolete Window and Door Repair Replacement Parts",
      "Know Your Marvin Windows and Doors - ask questions?",
    ],
  },
  {
    title: "Marvin, Integrity & Infinity Parts",
    questions: [
      "How can I order Marvin or Integrity replacement parts?",
      "How can I order replacement parts for my Marvin products?",
      "What are my parts replacement options for my old and obsolete Marvin windows and doors?",
      "How can I cut costs on restoring my old Marvin Casemaster windows and French doors?",
      "Any other replacement options for obsolete Marvin awning roto-gear units?",
      "Frequently Asked Parts Questions: Why is it important to use Marvin Integrity OEM replacement parts?",
      "Marvin Window and Door Service Parts | Florida Storm Repair | Restoration Questions [Answers]",
      "Marvin Old Double Hung Jamb Balance Tracks - Can I get Replacements?",
      "Can I replace my own Marvin Window balances? Can you help with Spiral Balances?",
      "Can You Help ID My Old Marvin Brand Windows?",
      "A Great Window Debate | Replace vs. Repair & Restoration of Old Marvin Windows - What's The Honest Scoop?",
      "Marvin Double Hung Window Jamb Carrier Tracks and Balances?",
      "Where can I get help with [Marvin] Integrity infinity Parts in NY, New York?",
      "I work in New York - where and how can I find Marvin Window Parts?",
      "What are the most Frequently Asked Marvin Window Door Description Search Terms",
      "Can you help with a Glossary of Terms for Marvin products - A - B?",
      "What public-facing websites does Marvin have?",
      "Do you have local Marvin in home service in Colorado Springs?",
      "Do you sell Marvin weather strip for old historic building windows?",
      "Air leaks around my old Marvin Casemaster Windows - will new seals help?",
      "I have water (condensation) fog in my Marvin windows - what can I do?",
      "Water Leakage Around My Marvin Windows and Doors - What do I do?",
      "We're refinishing, reglazing and restoring all our old Marvin windows in a 1970's Wausau house - can you help?",
      "Should I replace or restore my 25 year old Marvin windows?",
      "How often should I perform maintenance on my Marvin Window weather strip?",
    ],
  },
  {
    title: "Obsolete Brands, Hardware & Storm Repair",
    questions: [
      "Do you have any information about the Bilt-Best Window Company of Ste. Genevieve Missouri?",
      "Do you know of a Biltbest window and door parts supplier in Oxnard Thousand Oaks California area?",
      "Hurricane Harvey Aftermath - can you ship the window and door parts we need?",
      "I know this is a longshot - but can you help find Peachtree Screen Door Rollers?",
      "Do you have replacement parts for the ROTO FRANK - North America Skylight Products?",
      "I need Truth EntryGard Window Hardware in Stainless [Coastal] Hardware?",
      "Hail SWATH Storm Damages in Kansas - Any Help With Glazing Bead Window Parts?",
      "Searching for replacement parts for P-234 DC P-233 233 D.C. LC Parts - can you help?",
      "Can You Help Us With Multipoint Locks Multi Point Door Lock Systems Help",
      "Is the PVD Finish worth all the extra cost? How good is it?",
    ],
  },
  {
    title: "Shipping & Regional Questions",
    questions: [
      "[FAQ] Canadian Provinces Marvin Parts | Canada Shipping [FAQ'S]",
      "Will you ship us parts to the Hawaiian Islands?",
      "Marvin Window and Door Service Parts | Florida Storm Repair | Restoration Questions [Answers]",
      "Hurricane Harvey Aftermath - can you ship the window and door parts we need?",
      "Where can I get help with [Marvin] Integrity infinity Parts in NY, New York?",
      "I work in New York - where and how can I find Marvin Window Parts?",
    ],
  },
  {
    title: "Double-Hung Windows, Balances & Jamb Liners",
    questions: [
      "Single Mom Asks? Can I do my own window jambliner replacements?",
      "Jambliner and Balance Replacements - Can My Wife and I DO-IT-OURSELF [YOURSELF]",
      "Q: What does the Keeper on my hung windows do?",
      "Q: What is a Jamb liner?",
      "Q: Which part of a window or door is the Jamb?",
      "Q: My Marvin windows have two moving sashes. What is this kind of window called?",
      "Q: What is a double-hung window?",
      "Can I remove and replace my jamb carrier plastic tracks on windows?",
      "When I pull the sash lock lever to tilt window from frame only one side releases?",
    ],
  },
  {
    title: "Glass, Glazing & Window Terminology",
    questions: [
      "Q: Is Float Glass still made or used today?",
      "Q: How is Float Glass made?",
      "Q: What is Float Glass?",
      "Q: What are Exterior Glazed windows?",
      "Q: What are Interior Glazed windows?",
      "Q: Is Insulated Glass always just two panes of glass sealed together?",
      "Q: Is there gas between the panes of my Insulated Glass?",
      "Q: How does Insulated Glass (IG) work?",
      "Q: Why are there muntin bars in my window glass?",
      "Q: What are the metal grids in my windows called, and what do they do?",
      "Q: What are the metal bars between the panes of my double paned windows called?",
      "Q: Can I buy replacement Glazing Bead for my windows?",
      "Q: What purpose does Glazing Bead serve?",
      "Q: What is Glazing Bead?",
      "Q: What does Glazing mean in terms of my Low E Marvin Windows and doors?",
      "Q: What does Glazing mean in terms of windows and doors?",
      "Q: What does Flashing do to protect my windows and doors?",
      "Q: What is the strip of metal that goes over the tops of my windows and doors called?",
      "Q: Will double paned glass affect the R-Value of my Marvin windows?",
      "Q: I was told by my handyman that I have double glazed casement windows. What are the benefits to having two panes of glass instead of one?",
      "Q: What is the benefit of having double glazing in my Biltbest windows?",
      "Q: What is meant by daylight transmittance as related to my home's windows?",
      "Q: What is meant by the term daylight transmittance in IG windows?",
      "Q: What is meant by the term daylight transmittance in my Marvin casement windows?",
      "Can we get window glazing bead for windows from the 60's, 70's and 80's?",
      "Is there a Glossary of Terms available?",
    ],
  },
  {
    title: "Weatherstripping, Air Leaks & Maintenance",
    questions: [
      "My windows are leaking cold air around the sash frames - do I need to replace my old weather strip?",
      "Q: Is Fin Pile weatherseal a good seal for my single and double hung windows?",
      "Q: What does fin pile weatherseal do for my windows?",
      "Q: The weatherseal in my vinyl windows is made of some kind of fuzzy gray material with a plastic strip running down the middle. What kind of weatherseal is this?",
      "What should I do for annual or spring maintenance on my windows and doors?",
      "How long is weather strip performance good for?",
      "My painter got paint all over my window weather strip - will that affect performance?",
      "How often should I perform maintenance on my window hardware parts?",
    ],
  },
  {
    title: "Window Types, Egress & Fixed Windows",
    questions: [
      "Q: What is the value of having fixed windows in my home?",
      "Q: Why does only one side of my window open?",
      "Q: What is a Fixed window and what does it do?",
      "Q: How does an egress window work?",
      "Q: Where in my home are Egress Windows required?",
      "Q: What is the purpose of an Egress window?",
    ],
  },
];

function answerFor(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("volume discount") || q.includes("property management") || q.includes("apartment")) {
    return "Commercial and multi-property pricing may be available. Send the SKUs, quantities, property count, and delivery schedule through our contact form so we can review the order and provide the most accurate quote.";
  }
  if (q.includes("handing")) {
    return "Handing is determined from the viewing position specified for that product. For most window operators, stand inside facing the window and note which side the lock, hinge, or crank is on. Because manufacturers use different conventions, send photos before ordering if there is any doubt.";
  }
  if (q.includes("canadian") || q.includes("hawaiian") || q.includes("hurricane") || q.includes("florida storm") || q.includes("new york")) {
    return "We ship replacement parts throughout the United States, including Hawaii. Canadian and other international shipments depend on the item, carrier, destination, and customs requirements. Contact us with the part and postal code for availability and a shipping quote.";
  }
  if (q.includes("colorado springs") || q.includes("oxnard") || q.includes("thousand oaks") || q.includes("in home service")) {
    return "All Window Door Parts focuses on parts identification and nationwide parts supply. We do not rank local contractors or guarantee in-home service in every city. For installation, use a properly insured local window or door professional and provide them with the identified part information.";
  }
  if (q.includes("marvin") || q.includes("integrity") || q.includes("infinity") || q.includes("casemaster")) {
    return "Search by the original part number when available, or use our Free Parts ID service with clear photos, visible labels, dimensions, and the approximate product age. We source OEM parts when available and compatible replacement options when the original component has been discontinued.";
  }
  if (q.includes("bilt") || q.includes("peachtree") || q.includes("roto frank") || q.includes("entrygard") || q.includes("p-234") || q.includes("p-233") || q.includes("obsolete")) {
    return "Older and discontinued hardware often can be matched by shape, mounting pattern, dimensions, stamped numbers, and operating style. Submit several photos and measurements through our Free Parts ID form; availability varies, but compatible replacements are often possible.";
  }
  if (q.includes("glass etch") || q.includes("serial") || q.includes("stampings") || q.includes("identify my product") || q.includes("parts identification")) {
    return "Photograph every label, glass etching, casting number, stamp, and logo. Also include a full view of the window or door, close-ups of the removed part, and key measurements. A single stamped number may identify only one component, so the photos and dimensions are equally important.";
  }
  if (q.includes("jamb liner") || q.includes("jambliner") || q.includes("jamb carrier") || q.includes("balance") || q.includes("keeper") || q.includes("double-hung")) {
    return "Double-hung window repairs commonly involve balances, jamb liners, pivot bars, tilt latches, locks, keepers, and carrier tracks. Many can be replaced by a careful DIYer, but the correct balance type, length, weight rating, handing, and terminal style must be confirmed before ordering.";
  }
  if (q.includes("float glass")) {
    return "Float glass is flat glass made by floating molten glass on a bath of molten metal, producing smooth, parallel surfaces. It remains a common base glass used for windows, mirrors, laminated glass, tempered glass, and insulated glass units.";
  }
  if (q.includes("insulated glass") || q.includes("double glazed") || q.includes("double paned") || q.includes("r-value") || q.includes("daylight transmittance")) {
    return "Insulated glass uses two or more panes separated by a sealed spacer. The sealed space may contain air or an insulating gas. Multiple panes, Low-E coatings, spacer design, and gas fill can improve thermal performance; daylight transmittance describes how much visible light passes through the glazing.";
  }
  if (q.includes("muntin") || q.includes("metal grid") || q.includes("metal bars")) {
    return "The decorative bars are commonly called muntins, grilles, grids, or divided-light bars. Some are applied to the glass, some are removable, and others are sealed between the panes. They divide the visual appearance of the glass and may or may not be structural.";
  }
  if (q.includes("glazing bead")) {
    return "Glazing bead is the removable trim that helps retain the glass or insulated glass unit in the sash or frame. Replacement profiles must match the original shape, width, depth, material, and installation method. Photos of the end profile and accurate measurements are essential.";
  }
  if (q.includes("glazing") && !q.includes("bead")) {
    return "Glazing refers to the glass system and the materials used to secure and seal it in a window or door. Depending on context, it can include the glass, setting blocks, sealants, gaskets, glazing tape, stops, and glazing bead.";
  }
  if (q.includes("flashing") || q.includes("strip of metal")) {
    return "Flashing directs water away from the opening and helps prevent moisture from entering behind the exterior wall system. Head flashing or a drip cap is commonly installed above windows and doors. Installation details must follow the wall system and local building requirements.";
  }
  if (q.includes("weather") || q.includes("air leak") || q.includes("cold air") || q.includes("fin pile") || q.includes("fuzzy gray")) {
    return "Weatherstripping should be replaced when it is torn, permanently compressed, brittle, missing, painted, or no longer contacting the sash. Fin-pile weatherseal is the fuzzy strip with a center fin commonly used in sliding and hung windows. Match the backing width, pile height, fin, and mounting style before ordering.";
  }
  if (q.includes("condensation") || q.includes("water leakage")) {
    return "Moisture on the room-side surface can be caused by indoor humidity and cold glass. Fog or moisture trapped between panes usually indicates a failed insulated-glass seal. Water entering around the frame may involve glazing, drainage, flashing, sealant, or installation and should be diagnosed before parts are ordered.";
  }
  if (q.includes("egress")) {
    return "An egress window provides an emergency escape and rescue opening. Required locations and minimum opening dimensions are controlled by the building code adopted in your area, so verify the current requirements with the local building department before altering the opening.";
  }
  if (q.includes("fixed window") || q.includes("only one side")) {
    return "A fixed window does not open; it provides light, views, and weather protection with fewer moving parts. Combination units often pair one operating sash with one fixed panel, which is why only one side may open.";
  }
  if (q.includes("multipoint")) {
    return "Multipoint locks must be matched by manufacturer markings, faceplate width, backset, handle spacing, overall length, hook or roller locations, and handing. Send photos of the full lock strip and all measurements before ordering.";
  }
  if (q.includes("pvd")) {
    return "PVD finishes generally provide a durable, thin decorative coating with improved wear and corrosion resistance. The added cost is most valuable in coastal, humid, or high-use locations, but the base material and maintenance still affect service life.";
  }
  if (q.includes("maintenance") || q.includes("painter") || q.includes("spring")) {
    return "Inspect windows and doors at least annually. Clean tracks and drainage openings, check fasteners, seals, locks, balances, rollers, and operators, and use only manufacturer-approved lubricants. Paint on flexible weatherstripping can make it stiff or prevent sealing and usually warrants replacement.";
  }
  if (q.includes("replace vs") || q.includes("replace or restore") || q.includes("cut costs") || q.includes("fixed income")) {
    return "Repair is often economical when the frame and sash remain structurally sound and the problem is limited to hardware, balances, weatherstripping, glazing bead, or an insulated-glass unit. Replacement may make more sense when there is widespread rot, severe distortion, repeated water intrusion, or multiple failing systems.";
  }
  if (q.includes("deer hunting")) {
    return "We specialize in replacement window and door hardware rather than complete hunting-stand window systems. We may be able to help with latches, hinges, rollers, seals, and other repair components if you send photos and dimensions.";
  }
  if (q.includes("public-facing") || q.includes("websites does marvin")) {
    return "Use the manufacturer's official consumer website and its support, warranty, product-documentation, and dealer-locator pages for current information. For obsolete service parts, also submit the original product label and photos through our Parts ID service.";
  }
  if (q.includes("glossary") || q.includes("description search terms")) {
    return "Useful search terms include the window or door type, manufacturer, series, operating style, handing, material, visible markings, dimensions, and the component name. Our guides and FAQ definitions can help translate older trade terminology into current replacement-part terms.";
  }
  if (q.includes("tilt") && q.includes("one side")) {
    return "A sash that releases on only one side commonly has a broken or disconnected tilt latch, damaged pivot bar, or a balance shoe that is not positioned correctly. Do not force the sash; inspect both sides and send photos before ordering replacement parts.";
  }

  return "Send clear photos, any stamped numbers, the window or door brand, approximate age, and key dimensions through our Free Parts ID service. Our team will compare the details with available OEM and compatible replacement parts and explain the practical options.";
}

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalized) return FAQ_GROUPS;
    return FAQ_GROUPS
      .map((group) => ({
        ...group,
        questions: group.questions.filter((question) =>
          `${question} ${answerFor(question)}`.toLowerCase().includes(normalized),
        ),
      }))
      .filter((group) => group.questions.length > 0);
  }, [normalized]);

  const allQuestions = FAQ_GROUPS.flatMap((group) => group.questions);
  const visibleCount = filteredGroups.reduce((sum, group) => sum + group.questions.length, 0);

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <PageSeo
        title="Window & Door Parts Frequently Asked Questions"
        path="/faq"
        description="Answers about Marvin, Integrity, Bilt-Best, balances, jamb liners, glazing bead, weatherstripping, obsolete hardware, shipping, repairs, and parts identification."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: allQuestions.map((question) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answerFor(question) },
          })),
        }}
      />

      <Breadcrumb items={[{ label: "Frequently Asked Questions" }]} />

      <section className="bg-slate-900 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-amber-400" />
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-slate-300 text-lg max-w-3xl mx-auto">
            Search answers about replacement hardware, obsolete parts, Marvin and Integrity products, glazing, balances, weatherstripping, repair decisions, and shipping.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="sticky top-20 z-30 bg-slate-50/95 backdrop-blur py-3 mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions, brands, parts, or terms..."
              className="h-14 pl-12 text-base bg-white shadow-sm"
              aria-label="Search frequently asked questions"
            />
          </div>
          <p className="text-center text-xs text-slate-500 mt-2">Showing {visibleCount} of {allQuestions.length} questions</p>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="bg-white border rounded-2xl p-10 text-center">
            <h2 className="text-xl font-bold text-slate-900 mb-2">No matching question found</h2>
            <p className="text-slate-600 mb-6">Send us photos and details and our parts team will help identify the correct replacement.</p>
            <Button asChild><Link href="/parts-identification">Use Free Parts ID</Link></Button>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredGroups.map((group) => (
              <section key={group.title} aria-labelledby={`faq-${group.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
                <h2 id={`faq-${group.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} className="text-2xl font-serif font-bold text-slate-900 mb-4">
                  {group.title}
                </h2>
                <div className="bg-white border rounded-2xl divide-y overflow-hidden shadow-sm">
                  {group.questions.map((question) => (
                    <details key={question} className="group p-0">
                      <summary className="cursor-pointer list-none px-6 py-5 flex items-start justify-between gap-4 font-semibold text-slate-900 hover:bg-slate-50">
                        <span>{question}</span>
                        <ChevronRight className="w-5 h-5 shrink-0 text-primary transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="px-6 pb-6 text-slate-600 leading-relaxed">
                        <p>{answerFor(question)}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-12 rounded-2xl bg-gradient-to-r from-red-700 to-red-900 text-white p-8 flex flex-col md:flex-row items-center gap-6">
          <Camera className="w-12 h-12 shrink-0" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold mb-2">Still not sure which part you need?</h2>
            <p className="text-red-100">Upload photos, markings, and measurements. Our experts will identify the best available match.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button asChild size="lg" className="bg-white text-red-800 hover:bg-red-50">
              <Link href="/parts-identification">Free Parts ID</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              <a href="tel:785-533-0244"><Phone className="w-4 h-4 mr-2" />785-533-0244</a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
