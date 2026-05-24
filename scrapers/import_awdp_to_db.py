"""
Import AWDP-structured products to PostgreSQL database
Handles parent/variation relationships according to AWDP schema
"""

import json
import psycopg2
import psycopg2.extras
from datetime import datetime
from typing import Dict, List, Any
import uuid

def get_connection(db_url: str):
    """Get database connection"""
    return psycopg2.connect(db_url)

def load_awdp_data():
    """Load AWDP processed data from JSON files"""
    with open('scrapers/awdp_output/awdp-products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    with open('scrapers/awdp_output/awdp-variations.json', 'r', encoding='utf-8') as f:
        variations = json.load(f)
    
    print(f"Loaded {len(products)} parent products and {len(variations)} variations")
    return products, variations

def map_parent_to_db(product: Dict, variant_group_id: str) -> Dict[str, Any]:
    """Map AWDP parent product to database schema"""
    category = product.get('category', '') or 'OEM Hardware'  # Default category fallback
    
    return {
        'sku': product.get('id', ''),  # Use UUID as base SKU for parent
        'name': product.get('name', ''),
        'description': product.get('description', ''),
        'price': str(product.get('price_range', {}).get('min', 0) or 0),
        'original_price': str(product.get('price_range', {}).get('max', 0) or 0),
        'category': category,
        'subcategory': '',
        'supplier': product.get('brand', ''),
        'in_stock': True,
        'image_url': product.get('image', ''),
        'tags': [],
        'specifications': {},
        'compatible_brands': [],
        'variant_group_id': variant_group_id,
        'variant_label': 'Base',
        'attributes': {},
        'sold_as': 'Pair' if product.get('flags', {}).get('sold_in_pairs') else 'Each'
    }

def map_variation_to_db(variation: Dict, variant_group_id: str, parent_name: str, parent: Dict) -> Dict[str, Any]:
    """Map AWDP variation to database schema"""
    attributes = variation.get('attributes', {})
    
    # Build variant label from attributes
    label_parts = []
    if 'length' in attributes:
        label_parts.append(attributes['length'])
    if 'color' in attributes:
        label_parts.append(attributes['color'])
    if 'handing' in attributes:
        label_parts.append(attributes['handing'])
    
    variant_label = ' - '.join(label_parts) if label_parts else 'Variant'
    
    # Inherit category from parent, with fallback
    category = parent.get('category', '') or 'OEM Hardware'
    
    return {
        'sku': variation.get('awdp_sku', ''),
        'name': f"{parent_name} - {variant_label}",
        'description': parent.get('description', ''),  # Inherit from parent
        'price': str(variation.get('price', '0') or '0'),
        'original_price': str(variation.get('price', '0') or '0'),
        'category': category,  # Inherit from parent
        'subcategory': parent.get('subcategory', ''),
        'supplier': parent.get('brand', ''),  # Inherit from parent
        'in_stock': variation.get('stock', 'true').lower() == 'true',
        'image_url': variation.get('image_override', '') or parent.get('image', ''),  # Use override or parent image
        'tags': parent.get('tags', []),  # Inherit from parent
        'specifications': attributes,
        'compatible_brands': parent.get('compatible_brands', []),  # Inherit from parent
        'variant_group_id': variant_group_id,
        'variant_label': variant_label,
        'attributes': attributes,
        'sold_as': 'Each'  # Variations are typically individual items
    }

def import_to_database(db_url: str):
    """Import AWDP products to database"""
    products, variations = load_awdp_data()
    
    conn = get_connection(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    stats = {
        'existing_removed': 0,
        'parents_inserted': 0,
        'parents_updated': 0,
        'variations_inserted': 0,
        'variations_updated': 0,
        'errors': 0
    }
    
    print("Starting database import...")
    print("=" * 60)
    
    # Option: Remove existing AWDP products to avoid conflicts
    print("Removing existing products with variant_group_id...")
    cur.execute("DELETE FROM products WHERE variant_group_id IS NOT NULL")
    removed = cur.rowcount
    conn.commit()
    stats['existing_removed'] = removed
    print(f"Removed {removed} existing products")
    print("=" * 60)
    
    # Import parent products first
    for product in products:
        try:
            variant_group_id = product.get('id', str(uuid.uuid4()))
            db_product = map_parent_to_db(product, variant_group_id)
            
            # Check if parent already exists (by variant_group_id)
            cur.execute(
                "SELECT id FROM products WHERE variant_group_id = %s LIMIT 1",
                (variant_group_id,)
            )
            existing = cur.fetchone()
            
            if existing:
                # Update existing parent
                update_query = """
                    UPDATE products 
                    SET name = %s, description = %s, category = %s, supplier = %s,
                        image_url = %s, sold_as = %s
                    WHERE id = %s
                """
                cur.execute(update_query, (
                    db_product['name'],
                    db_product['description'],
                    db_product['category'],
                    db_product['supplier'],
                    db_product['image_url'],
                    db_product['sold_as'],
                    existing['id']
                ))
                stats['parents_updated'] += 1
                print(f"Updated parent: {db_product['name'][:50]}")
            else:
                # Insert new parent
                insert_query = """
                    INSERT INTO products (
                        sku, name, description, price, original_price, 
                        category, subcategory, supplier, in_stock, image_url, tags,
                        specifications, compatible_brands, variant_group_id, 
                        variant_label, attributes, sold_as, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                
                cur.execute(insert_query, (
                    db_product['sku'],
                    db_product['name'],
                    db_product['description'],
                    db_product['price'],
                    db_product['original_price'],
                    db_product['category'] or 'OEM Hardware',
                    db_product['subcategory'],
                    db_product['supplier'],
                    db_product['in_stock'],
                    db_product['image_url'],
                    json.dumps(db_product['tags']),
                    json.dumps(db_product['specifications']),
                    json.dumps(db_product['compatible_brands']),
                    db_product['variant_group_id'],
                    db_product['variant_label'],
                    json.dumps(db_product['attributes']),
                    db_product['sold_as']
                ))
                stats['parents_inserted'] += 1
                print(f"Inserted parent: {db_product['name'][:50]}")
                
        except Exception as e:
            print(f"Error processing parent {product.get('name', 'unknown')}: {e}")
            stats['errors'] += 1
            conn.rollback()
            continue
    
    conn.commit()
    
    # Import variations
    # Build a mapping of parent_id to product info
    parent_map = {p['id']: p for p in products}
    
    for variation in variations:
        try:
            parent_id = variation.get('parent_id')
            if not parent_id or parent_id not in parent_map:
                print(f"Skipping variation with missing parent: {variation.get('awdp_sku', 'unknown')}")
                stats['errors'] += 1
                continue
            
            parent = parent_map[parent_id]
            variant_group_id = parent.get('id', str(uuid.uuid4()))
            db_variation = map_variation_to_db(variation, variant_group_id, parent.get('name', ''), parent)
            
            # Check if variation already exists (by SKU)
            cur.execute(
                "SELECT id FROM products WHERE sku = %s LIMIT 1",
                (db_variation['sku'],)
            )
            existing = cur.fetchone()
            
            if existing:
                # Update existing variation
                update_query = """
                    UPDATE products 
                    SET name = %s, price = %s, original_price = %s, in_stock = %s,
                        image_url = %s, specifications = %s, variant_label = %s, attributes = %s
                    WHERE id = %s
                """
                cur.execute(update_query, (
                    db_variation['name'],
                    db_variation['price'],
                    db_variation['original_price'],
                    db_variation['in_stock'],
                    db_variation['image_url'],
                    json.dumps(db_variation['specifications']),
                    db_variation['variant_label'],
                    json.dumps(db_variation['attributes']),
                    existing['id']
                ))
                stats['variations_updated'] += 1
                print(f"Updated variation: {db_variation['sku']}")
            else:
                # Insert new variation
                insert_query = """
                    INSERT INTO products (
                        sku, name, description, price, original_price, 
                        category, subcategory, supplier, in_stock, image_url, tags,
                        specifications, compatible_brands, variant_group_id, 
                        variant_label, attributes, sold_as, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                
                cur.execute(insert_query, (
                    db_variation['sku'],
                    db_variation['name'],
                    db_variation['description'],
                    db_variation['price'],
                    db_variation['original_price'],
                    db_variation['category'] or 'OEM Hardware',
                    db_variation['subcategory'],
                    db_variation['supplier'],
                    db_variation['in_stock'],
                    db_variation['image_url'],
                    json.dumps(db_variation['tags']),
                    json.dumps(db_variation['specifications']),
                    json.dumps(db_variation['compatible_brands']),
                    db_variation['variant_group_id'],
                    db_variation['variant_label'],
                    json.dumps(db_variation['attributes']),
                    db_variation['sold_as']
                ))
                stats['variations_inserted'] += 1
                print(f"Inserted variation: {db_variation['sku']}")
                
        except Exception as e:
            print(f"Error processing variation {variation.get('awdp_sku', 'unknown')}: {e}")
            stats['errors'] += 1
            conn.rollback()
            continue
    
    conn.commit()
    
    print(f"\n{'=' * 60}")
    print("Database Import Summary")
    print(f"{'=' * 60}")
    print(f"Existing products removed: {stats['existing_removed']}")
    print(f"Parents inserted: {stats['parents_inserted']}")
    print(f"Parents updated: {stats['parents_updated']}")
    print(f"Variations inserted: {stats['variations_inserted']}")
    print(f"Variations updated: {stats['variations_updated']}")
    print(f"Errors: {stats['errors']}")
    print(f"Total products processed: {len(products) + len(variations)}")
    print(f"{'=' * 60}")
    
    cur.close()
    conn.close()

def main():
    import sys
    if len(sys.argv) < 2:
        print("Usage: python import_awdp_to_db.py <database_url>")
        print("Example: python import_awdp_to_db.py 'postgresql://...'")
        sys.exit(1)
    
    db_url = sys.argv[1]
    print(f"Connecting to database...")
    
    try:
        import_to_database(db_url)
        print("\nImport completed successfully!")
    except Exception as e:
        print(f"\nImport failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()