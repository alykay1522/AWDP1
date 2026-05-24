"""
Direct database import script for AWDP products
Inserts products directly into PostgreSQL database without requiring API server
"""

import csv
import os
import psycopg2
import psycopg2.extras
from datetime import datetime

def get_connection(db_url):
    """Get database connection from provided URL"""
    if not db_url:
        print("ERROR: DATABASE_URL not provided")
        print("Please provide it as: python direct_db_import.py <csv_file> <database_url>")
        return None
    return psycopg2.connect(db_url)

def import_products_from_csv(csv_file, db_url):
    """Import products from CSV file directly into database"""
    
    conn = get_connection(db_url)
    if not conn:
        return
    
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Read CSV file
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        products = list(reader)
    
    print(f"Found {len(products)} products in CSV file")
    
    # Track statistics
    stats = {
        'inserted': 0,
        'updated': 0,
        'skipped': 0,
        'errors': 0
    }
    
    for product in products:
        try:
            # Extract fields
            sku = product.get('sku', '').strip()
            name = product.get('name', '').strip()
            description = product.get('description', '').strip()
            price = product.get('price', '').strip()
            original_price = product.get('originalPrice', '').strip()
            category = product.get('category', '').strip()
            supplier = product.get('supplier', '').strip()
            image_url = product.get('imageUrl', '').strip()
            in_stock = product.get('inStock', 'true').strip().lower() == 'true'
            tags = product.get('tags', '').strip()
            compatible_brands = product.get('compatibleBrands', '').strip()
            specifications = product.get('specifications', '').strip()
            
            if not sku or not name:
                print(f"Skipping: Missing SKU or name")
                stats['skipped'] += 1
                continue
            
            # Check if product already exists
            cur.execute("SELECT id, price FROM products WHERE sku = %s", (sku,))
            existing = cur.fetchone()
            
            if existing:
                # Update existing product
                update_fields = []
                params = []
                
                if name:
                    update_fields.append("name = %s")
                    params.append(name)
                if description:
                    update_fields.append("description = %s")
                    params.append(description)
                if price:
                    update_fields.append("price = %s")
                    params.append(price)
                if original_price:
                    update_fields.append("original_price = %s")
                    params.append(original_price)
                if category:
                    update_fields.append("category = %s")
                    params.append(category)
                if supplier:
                    update_fields.append("supplier = %s")
                    params.append(supplier)
                if image_url:
                    update_fields.append("image_url = %s")
                    params.append(image_url)
                
                update_fields.append("in_stock = %s")
                params.append(in_stock)
                
                if tags:
                    update_fields.append("tags = %s")
                    params.append(tags)
                if compatible_brands:
                    update_fields.append("compatible_brands = %s")
                    params.append(compatible_brands)
                if specifications:
                    update_fields.append("specifications = %s")
                    params.append(specifications)
                
                params.append(sku)  # WHERE clause
                
                if update_fields:
                    update_query = f"""
                        UPDATE products 
                        SET {', '.join(update_fields)}
                        WHERE sku = %s
                    """
                    cur.execute(update_query, params)
                    stats['updated'] += 1
                    print(f"Updated: {sku} - {name[:50]}")
                else:
                    stats['skipped'] += 1
                    
            else:
                # Insert new product
                insert_query = """
                    INSERT INTO products (
                        sku, name, description, price, original_price, 
                        category, supplier, image_url, in_stock, tags,
                        compatible_brands, specifications, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                
                cur.execute(insert_query, (
                    sku, name, description, price or None, original_price or None,
                    category or None, supplier or None, image_url or None, in_stock,
                    tags or None, compatible_brands or None, specifications or None
                ))
                stats['inserted'] += 1
                print(f"Inserted: {sku} - {name[:50]}")
            
            # Commit every 10 products to avoid large transactions
            if (stats['inserted'] + stats['updated']) % 10 == 0:
                conn.commit()
                
        except Exception as e:
            print(f"Error processing product {sku}: {e}")
            stats['errors'] += 1
            conn.rollback()  # Rollback on error to maintain transaction integrity
    
    # Final commit
    conn.commit()
    
    print(f"\n{'=' * 60}")
    print(f"Import completed!")
    print(f"Inserted: {stats['inserted']}")
    print(f"Updated: {stats['updated']}")
    print(f"Skipped: {stats['skipped']}")
    print(f"Errors: {stats['errors']}")
    print(f"Total processed: {len(products)}")
    
    cur.close()
    conn.close()

def main():
    if len(os.sys.argv) < 3:
        print("Usage: python direct_db_import.py <csv_file> <database_url>")
        print("Example: python direct_db_import.py scrapers/awdp_import_20260523_222419.csv 'postgresql://awdp:awdp123@localhost:5432/awdp'")
        os.sys.exit(1)
    
    csv_file = os.sys.argv[1]
    db_url = os.sys.argv[2]
    
    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found: {csv_file}")
        os.sys.exit(1)
    
    print(f"Starting direct database import from: {csv_file}")
    print(f"Database: {db_url}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    import_products_from_csv(csv_file, db_url)

if __name__ == "__main__":
    main()