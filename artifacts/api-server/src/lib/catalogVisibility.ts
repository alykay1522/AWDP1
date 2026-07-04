import { productsTable } from "@workspace/db/schema";
import { and, eq, isNotNull, ne, sql, type SQL } from "drizzle-orm";

// Public pricing policy used consistently by product pages and active listings.
export const visiblePrice = sql`(${productsTable.price}::numeric = 0 OR ${productsTable.price}::numeric >= 35)`;

// The legacy source database contains a small set of service/advertising pages that
// were imported as products. Keep the rows available to administrators, but quarantine
// them from the customer catalog and search-engine feeds.
export const NON_PRODUCT_PATTERN = "(handyman|remodeling help|wildlife feeder|feeder control system|scam alert|service call)";

const isNotLegacyService = sql`LOWER(${productsTable.name} || ' ' || ${productsTable.sku}) !~ ${NON_PRODUCT_PATTERN}`;

// A direct product URL may remain useful when an item is temporarily out of stock.
export const publicProductCondition: SQL = and(
  visiblePrice,
  isNotLegacyService,
) as SQL;

// Shop listings and category counts only include currently purchasable, imaged items.
export const publicListingCondition: SQL = and(
  publicProductCondition,
  eq(productsTable.inStock, true),
  isNotNull(productsTable.imageUrl),
  ne(productsTable.imageUrl, ""),
) as SQL;
