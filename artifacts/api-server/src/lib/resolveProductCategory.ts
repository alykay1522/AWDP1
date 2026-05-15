/**
 * Maps CSV / supplier category strings and AWDP SKU patterns to canonical shop categories.
 * Mirrors startup seed rules in seed.ts (fixProductCategories + migrateLegacyCategories).
 */

export const CANONICAL_CATEGORIES = [
  "Window Hardware",
  "Door Hardware",
  "Window Balances",
  "Sash Hardware",
  "Window Glazing and Weatherstrip",
  "Screen Hardware and Accessories",
  "Other Hardware",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

const CANONICAL_BY_LOWER = new Map(
  CANONICAL_CATEGORIES.map((c) => [c.toLowerCase(), c]),
);

/** Supplier / legacy labels → canonical category (before SKU inference). */
const CATEGORY_ALIASES: Record<string, CanonicalCategory> = {
  "window hardware": "Window Hardware",
  "window operators": "Window Hardware",
  "window operators cranks": "Window Hardware",
  "window operators and cranks": "Window Hardware",
  "operators": "Window Hardware",
  "operators cranks": "Window Hardware",
  "casement": "Window Hardware",
  "awning": "Window Hardware",

  "door hardware": "Door Hardware",
  "patio door": "Door Hardware",
  "patio doors": "Door Hardware",
  "rollers": "Door Hardware",
  "door rollers": "Door Hardware",
  "closers": "Door Hardware",
  "hinges": "Door Hardware",

  "window balances": "Window Balances",
  "balances": "Window Balances",
  "balance": "Window Balances",
  "channel balance": "Window Balances",
  "channel balances": "Window Balances",
  "spiral balance": "Window Balances",
  "spiral balances": "Window Balances",
  "block and tackle": "Window Balances",
  "sash balances": "Window Balances",

  "sash hardware": "Sash Hardware",
  "sash": "Sash Hardware",
  "tilt latches": "Sash Hardware",
  "locks handles": "Sash Hardware",
  "locks and handles": "Sash Hardware",

  "window glazing and weatherstrip": "Window Glazing and Weatherstrip",
  "glazing": "Window Glazing and Weatherstrip",
  "weatherstrip": "Window Glazing and Weatherstrip",
  "weatherstripping": "Window Glazing and Weatherstrip",
  "weather seal": "Window Glazing and Weatherstrip",
  "seals": "Window Glazing and Weatherstrip",

  "screen hardware and accessories": "Screen Hardware and Accessories",
  "screen hardware": "Screen Hardware and Accessories",
  "screens": "Screen Hardware and Accessories",
  "screen": "Screen Hardware and Accessories",

  "other hardware": "Other Hardware",
  "hardware": "Other Hardware",
  "misc": "Other Hardware",
  "miscellaneous": "Other Hardware",
  "skylights": "Other Hardware",
  "skylight": "Other Hardware",
};

function compactKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isBalanceProductName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("balance")
    || n.includes("chan bal")
    || n.includes("ribbed bal")
    || n.includes("overhead bal")
    || n.includes(" bal w/")
    || n.includes(" bal w:")
    || n.includes(" bal @")
    || n.includes(" bal.")
    || n.includes(" bal ")
    || n.startsWith("inverted tilt b")
  );
}

/**
 * Normalize a free-text category from CSV to a canonical name, or null if unknown.
 */
export function normalizeCategoryLabel(raw: string): CanonicalCategory | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const exact = CANONICAL_BY_LOWER.get(trimmed.toLowerCase());
  if (exact) return exact;

  const key = compactKey(trimmed);
  const alias = CATEGORY_ALIASES[key];
  if (alias) return alias;

  // Partial match: "Window Balance Accessories" → Window Balances
  for (const [needle, cat] of Object.entries(CATEGORY_ALIASES)) {
    if (key.includes(needle) || needle.includes(key)) return cat;
  }
  for (const cat of CANONICAL_CATEGORIES) {
    if (key.includes(compactKey(cat))) return cat;
  }

  return null;
}

function skuMatches(sku: string, prefix: string): boolean {
  return sku.toUpperCase().startsWith(prefix.toUpperCase());
}

/**
 * Infer category from AWDP SKU cipher prefix and product name (seed.ts rules).
 */
export function inferCategoryFromSkuAndName(sku: string, name: string): CanonicalCategory | null {
  const s = sku.trim().toUpperCase();
  if (!s.startsWith("AWDP-")) return null;

  const balanceFamily =
    skuMatches(s, "AWDP-TR")
    || skuMatches(s, "AWDP-TE")
    || skuMatches(s, "AWDP-IA")
    || skuMatches(s, "AWDP-IB")
    || skuMatches(s, "AWDP-BI")
    || skuMatches(s, "AWDP-TF")
    || skuMatches(s, "AWDP-TP")
    || skuMatches(s, "AWDP-BE")
    || skuMatches(s, "AWDP-LT");

  if (balanceFamily) {
    return isBalanceProductName(name) ? "Window Balances" : "Sash Hardware";
  }

  if (
    skuMatches(s, "AWDP-OT")
    || skuMatches(s, "AWDP-OA")
    || skuMatches(s, "AWDP-OF")
    || skuMatches(s, "AWDP-OR")
    || skuMatches(s, "AWDP-RL")
    || skuMatches(s, "AWDP-IE")
    || skuMatches(s, "AWDP-OB")
    || skuMatches(s, "AWDP-OO")
    || skuMatches(s, "AWDP-BB")
  ) {
    return "Window Hardware";
  }

  if (skuMatches(s, "AWDP-OL")) {
    if (name.toUpperCase().includes("SKYLIGHT")) return "Other Hardware";
    return "Window Hardware";
  }

  if (
    skuMatches(s, "AWDP-PO")
    || skuMatches(s, "AWDP-PR")
    || skuMatches(s, "AWDP-RB")
    || skuMatches(s, "AWDP-IT")
    || skuMatches(s, "AWDP-PT")
    || skuMatches(s, "AWDP-L-")
    || skuMatches(s, "AWDP-II")
    || skuMatches(s, "AWDP-FT")
  ) {
    return "Door Hardware";
  }

  if (skuMatches(s, "AWDP-TO")) return "Window Glazing and Weatherstrip";

  if (skuMatches(s, "AWDP-PE") || skuMatches(s, "AWDP-PF")) {
    return "Screen Hardware and Accessories";
  }

  if (skuMatches(s, "AWDP-RE") || skuMatches(s, "AWDP-BT")) {
    return "Other Hardware";
  }

  if (skuMatches(s, "AWDP-LE")) {
    const n = name.toLowerCase();
    if (n.includes("weather") || n.includes("seal") || n.includes("glazing")) {
      return "Window Glazing and Weatherstrip";
    }
    if (
      n.includes("patio door")
      || n.includes("roller")
      || n.includes("hook mount")
      || n.includes("tailpiece")
    ) {
      return "Door Hardware";
    }
    if (n.includes("balance clip") || n.includes("balance support")) {
      return "Window Balances";
    }
    return "Window Hardware";
  }

  return null;
}

export interface ResolveProductCategoryInput {
  rawCategory?: string;
  sku: string;
  name: string;
  /** When updating, keep DB category if CSV left category blank. */
  existingCategory?: string | null;
}

/**
 * Pick the category used for catalog placement (shop filters, category pages).
 */
export function resolveProductCategory(input: ResolveProductCategoryInput): string {
  const raw = (input.rawCategory ?? "").trim();
  const existing = (input.existingCategory ?? "").trim();

  if (raw) {
    const lower = raw.toLowerCase();
    if (lower === "window balances and accessories") {
      return isBalanceProductName(input.name) ? "Window Balances" : "Sash Hardware";
    }

    const normalized = normalizeCategoryLabel(raw);
    if (normalized) return normalized;

    // Unknown label but non-empty — keep as-is (admin may have a custom category)
    return raw;
  }

  if (existing) {
    const normalizedExisting = normalizeCategoryLabel(existing);
    if (normalizedExisting) return normalizedExisting;
    return existing;
  }

  const inferred = inferCategoryFromSkuAndName(input.sku, input.name);
  if (inferred) return inferred;

  return "Other Hardware";
}
