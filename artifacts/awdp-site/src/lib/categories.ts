// Category name/slug pairs must match artifacts/api-server/src/seed-data/categories.json
// (the categoriesTable seed) — this is the frontend's static mirror of that data, used for
// routing and SEO metadata without an extra fetch on every page.
export interface CategoryDef {
  name: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    name: "Window Balances",
    slug: "window-balances",
    seoTitle: "Replacement Window Balances | Channel, Block & Tackle, Spiral — Fast Shipping",
    seoDescription:
      "Shop replacement window balances for vinyl, aluminum, and wood windows. Block & tackle, spiral, constant force, and specialty balances, with expert support.",
  },
  {
    name: "Window Hardware",
    slug: "window-hardware",
    seoTitle: "Casement & Awning Window Operators | Truth, EntryGard, Andersen",
    seoDescription:
      "Shop casement and awning window operators from Truth, EntryGard, Andersen, Pella, and more. Left/right handing, split arms, dual arms, and specialty operators.",
  },
  {
    name: "Sash Hardware",
    slug: "sash-hardware",
    seoTitle: "Sash Hardware — Locks, Lifts, Keepers & Tilt Latches",
    seoDescription:
      "Shop sash locks, sash lifts, tilt latches, keepers, and pivot bars for double-hung and single-hung windows. Veteran-owned, 40+ years experience.",
  },
  {
    name: "Door Hardware",
    slug: "door-hardware",
    seoTitle: "Patio Door Rollers | Sliding Door Replacement Wheels — Veteran Owned",
    seoDescription:
      "Find the correct patio door rollers for sliding glass doors. Stainless steel, tandem, nylon, and precision rollers. Identify your part with our free Parts ID service.",
  },
  {
    name: "Window Glazing and Weatherstrip",
    slug: "window-glazing-and-weatherstrip",
    seoTitle: "Weatherstripping for Windows & Doors | Kerf, Foam, Bulb, Fin Seal",
    seoDescription:
      "Replace worn weatherstripping to stop drafts and improve efficiency. Kerf, bulb, fin seal, foam, and OEM-specific profiles.",
  },
  {
    name: "Screen Hardware and Accessories",
    slug: "screen-hardware-and-accessories",
    seoTitle: "Screen Door & Window Screen Hardware | Frames, Spline, Rollers, Corners",
    seoDescription:
      "Shop replacement screen hardware for window and door screens — frames, corner keys, spline, clips, and rollers. Veteran-owned, 40+ years experience.",
  },
  {
    name: "Other Hardware",
    slug: "other-hardware",
    seoTitle: "Specialty Window & Door Hardware | Hard-to-Find & Discontinued Parts",
    seoDescription:
      "Shop specialty and hard-to-find window and door hardware, including skylights, deer blind windows, and obsolete parts other suppliers don't carry.",
  },
];

export function getCategoryBySlug(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getCategoryByName(name: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.name === name);
}
