import { productsTable } from "@workspace/db/schema";
import { and, isNotNull, ne, sql, type SQL } from "drizzle-orm";

// Public pricing policy used consistently by product pages and active listings.
export const visiblePrice = sql`(${productsTable.price}::numeric = 0 OR ${productsTable.price}::numeric >= 35)`;

// The legacy source database contains a small set of service/advertising pages that
// were imported as products. Keep the rows available to administrators, but quarantine
// them from the customer catalog and search-engine feeds. Some of those rows only reveal
// their service-page purpose in the description, so all customer-facing text is checked.
export const NON_PRODUCT_PATTERN = "(handyman|remodeling help|wildlife feeder|feeder control system|scam alert|service call)";

const isNotLegacyService = sql`
  LOWER(
    COALESCE(${productsTable.name}, '') || ' ' ||
    COALESCE(${productsTable.sku}, '') || ' ' ||
    COALESCE(${productsTable.description}, '')
  ) !~ ${NON_PRODUCT_PATTERN}
`;

// A direct product URL may remain useful regardless of internal inventory flags.
export const publicProductCondition: SQL = and(
  visiblePrice,
  isNotLegacyService,
) as SQL;

// Shop listings and category counts include customer-visible, imaged products.
// Inventory is managed internally and is not used as customer-facing availability copy.
export const publicListingCondition: SQL = and(
  publicProductCondition,
  isNotNull(productsTable.imageUrl),
  ne(productsTable.imageUrl, ""),
) as SQL;
