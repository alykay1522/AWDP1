import { pool } from "@workspace/db";
import { CATALOG_SOURCE_SKUS } from "./catalogOptionHints";

let guardPromise: Promise<void> | undefined;

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function installCatalogSkuGuard(): Promise<void> {
  const knownSourceSkus = [...CATALOG_SOURCE_SKUS]
    .map(sqlLiteral)
    .join(", ");

  await pool.query(`
    CREATE OR REPLACE FUNCTION awdp_catalog_sku_guard()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      base_sku text;
      existing_row products%ROWTYPE;
      duplicate_evidence boolean;
    BEGIN
      IF NEW.sku !~* '^AWDP-' THEN
        NEW.sku := 'AWDP-' || NEW.sku;
      END IF;

      IF NEW.attributes IS NULL
         AND json_typeof(NEW.specifications) = 'object'
         AND EXISTS (
           SELECT 1
           FROM json_each(NEW.specifications)
           WHERE json_typeof(value) = 'array'
         ) THEN
        NEW.attributes := NEW.specifications;
      END IF;

      IF NEW.sku ~ '-([2-9]|[1-9][0-9])$' THEN
        base_sku := regexp_replace(NEW.sku, '-([2-9]|[1-9][0-9])$', '');
        SELECT * INTO existing_row FROM products WHERE sku = base_sku LIMIT 1;

        IF FOUND THEN
          duplicate_evidence :=
            base_sku = ANY(ARRAY[${knownSourceSkus}]::text[])
            OR regexp_replace(lower(existing_row.name), '[^a-z0-9]+', '', 'g') =
               regexp_replace(lower(NEW.name), '[^a-z0-9]+', '', 'g')
            OR (
              existing_row.image_url IS NOT NULL
              AND NEW.image_url IS NOT NULL
              AND split_part(lower(existing_row.image_url), '?', 1) =
                  split_part(lower(NEW.image_url), '?', 1)
            );

          IF duplicate_evidence THEN
            UPDATE products
            SET
              name = CASE
                WHEN length(coalesce(NEW.name, '')) > length(coalesce(existing_row.name, ''))
                  THEN NEW.name ELSE existing_row.name END,
              description = CASE
                WHEN length(coalesce(NEW.description, '')) > length(coalesce(existing_row.description, ''))
                  THEN NEW.description ELSE existing_row.description END,
              price = CASE WHEN NEW.price::numeric > 0 THEN NEW.price ELSE existing_row.price END,
              original_price = coalesce(NEW.original_price, existing_row.original_price),
              category = CASE
                WHEN existing_row.category = 'Other Hardware' AND NEW.category <> 'Other Hardware'
                  THEN NEW.category ELSE existing_row.category END,
              subcategory = coalesce(NEW.subcategory, existing_row.subcategory),
              supplier = coalesce(nullif(NEW.supplier, ''), existing_row.supplier),
              in_stock = existing_row.in_stock OR NEW.in_stock,
              image_url = coalesce(nullif(NEW.image_url, ''), existing_row.image_url),
              tags = coalesce(existing_row.tags, '[]'::json) || coalesce(NEW.tags, '[]'::json),
              specifications = coalesce(existing_row.specifications, '{}'::json) || coalesce(NEW.specifications, '{}'::json),
              compatible_brands = coalesce(existing_row.compatible_brands, '[]'::json) || coalesce(NEW.compatible_brands, '[]'::json),
              attributes = coalesce(existing_row.attributes, '{}'::json) || coalesce(NEW.attributes, '{}'::json),
              sold_as = coalesce(NEW.sold_as, existing_row.sold_as)
            WHERE id = existing_row.id;

            RETURN NULL;
          END IF;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS awdp_catalog_sku_guard_trigger ON products;
    CREATE TRIGGER awdp_catalog_sku_guard_trigger
      BEFORE INSERT ON products
      FOR EACH ROW
      EXECUTE FUNCTION awdp_catalog_sku_guard();
  `);
}

export function ensureCatalogSkuGuard(): Promise<void> {
  if (!guardPromise) {
    guardPromise = installCatalogSkuGuard().catch((error) => {
      guardPromise = undefined;
      throw error;
    });
  }
  return guardPromise;
}
