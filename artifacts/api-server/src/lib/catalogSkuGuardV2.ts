import { pool } from "@workspace/db";

let guardPromise: Promise<void> | undefined;

async function installGuard(): Promise<void> {
  await pool.query(`
    CREATE OR REPLACE FUNCTION awdp_catalog_sku_guard_v2()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      source_sku text;
      desired_sku text;
      existing_id integer;
    BEGIN
      source_sku := COALESCE(
        CASE
          WHEN json_typeof(NEW.attributes) = 'object'
            AND json_typeof(NEW.attributes -> 'original_sku') = 'array'
          THEN NEW.attributes -> 'original_sku' ->> 0
        END,
        CASE
          WHEN json_typeof(NEW.specifications) = 'object'
            AND json_typeof(NEW.specifications -> 'original_sku') = 'array'
          THEN NEW.specifications -> 'original_sku' ->> 0
        END,
        NEW.sku
      );

      source_sku := btrim(COALESCE(source_sku, ''));
      IF source_sku = '' THEN
        RAISE EXCEPTION 'Product SKU cannot be empty';
      END IF;

      IF source_sku ~* '^AWDP-' THEN
        desired_sku := 'AWDP-' || substring(source_sku from 6);
      ELSE
        desired_sku := 'AWDP-' || source_sku;
      END IF;

      IF NEW.attributes IS NULL
         AND json_typeof(NEW.specifications) = 'object'
         AND EXISTS (
           SELECT 1 FROM json_each(NEW.specifications)
           WHERE json_typeof(value) = 'array'
         ) THEN
        NEW.attributes := NEW.specifications;
      END IF;

      SELECT id INTO existing_id
      FROM products
      WHERE lower(sku) = lower(desired_sku)
      LIMIT 1;

      IF existing_id IS NOT NULL THEN
        UPDATE products
        SET
          name = CASE
            WHEN length(COALESCE(NEW.name, '')) > length(COALESCE(name, ''))
              THEN NEW.name ELSE name END,
          description = CASE
            WHEN length(COALESCE(NEW.description, '')) > length(COALESCE(description, ''))
              THEN NEW.description ELSE description END,
          price = CASE
            WHEN NEW.price IS NOT NULL AND NEW.price::numeric > 0
              THEN NEW.price ELSE price END,
          original_price = COALESCE(NEW.original_price, original_price),
          category = CASE
            WHEN category = 'Other Hardware'
                 AND COALESCE(NEW.category, '') <> ''
                 AND NEW.category <> 'Other Hardware'
              THEN NEW.category ELSE category END,
          subcategory = COALESCE(NEW.subcategory, subcategory),
          supplier = COALESCE(NULLIF(NEW.supplier, ''), supplier),
          in_stock = in_stock OR NEW.in_stock,
          image_url = COALESCE(NULLIF(NEW.image_url, ''), image_url),
          attributes = (
            COALESCE(attributes, '{}'::json)::jsonb ||
            COALESCE(NEW.attributes, '{}'::json)::jsonb
          )::json,
          sold_as = COALESCE(NEW.sold_as, sold_as),
          variant_group_id = COALESCE(NEW.variant_group_id, variant_group_id),
          variant_label = COALESCE(NEW.variant_label, variant_label)
        WHERE id = existing_id;
        RETURN NULL;
      END IF;

      NEW.sku := desired_sku;
      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS awdp_catalog_sku_guard_trigger ON products;
    DROP TRIGGER IF EXISTS awdp_catalog_sku_guard_v2_trigger ON products;
    CREATE TRIGGER awdp_catalog_sku_guard_v2_trigger
      BEFORE INSERT ON products
      FOR EACH ROW
      EXECUTE FUNCTION awdp_catalog_sku_guard_v2();
  `);
}

export function ensureCatalogSkuGuardV2(): Promise<void> {
  if (!guardPromise) {
    guardPromise = installGuard().catch((error) => {
      guardPromise = undefined;
      throw error;
    });
  }
  return guardPromise;
}
