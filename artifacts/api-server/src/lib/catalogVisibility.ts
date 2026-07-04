import { productsTable } from "@workspace/db/schema";
import { and, eq, isNotNull, ne, sql, type SQL } from "drizzle-orm";

// Public pricing policy used consistently by listings, categories, featured items,
// direct product pages, and the sitemap.
export const visiblePrice = sql`(${productsTable.price}::numeric = 0 OR ${productsTable.price}::numeric >= 35)`;

// The legacy source database contains a small set of service/advertising pages that
// were imported as products. Keep the rows available to administrators, but quarantine
// them from the customer catalog and search-engine feeds.
export const NON_PRODUCT_PATTERN = "(handyman|remodeling help|wildlife feeder|feeder control system|scam alert|service call)";

const isNotLegacyService = sql`LOWER(${productsTable.name} || ' ' || ${productsTable.sku}) !~ ${NON_PRODUCT_PATTERN}`;

export const publicProductCondition: SQL = and(
  eq(productsTable.inStock, true),
  visiblePrice,
  isNotLegacyService,
) as SQL;

export const publicListingCondition: SQL = and(
  publicProductCondition,
  isNotNull(productsTable.imageUrl),
  ne(productsTable.imageUrl, ""),
) as SQL;
