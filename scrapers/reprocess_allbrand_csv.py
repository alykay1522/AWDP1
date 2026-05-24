"""
Reprocess AllBrand CSV with simple AWDP- prefix
- Reads existing allbrand_products CSV
- Replaces cipher-encoded SKUs with simple AWDP- prefix
- Applies 1.5% markup
- Outputs to admin import CSV format
"""

import csv
import re
import os
from datetime import datetime

# Configuration
INPUT_CSV = "attached_assets/allbrand_products_1776979015894.csv"
OUTPUT_DIR = "scrapers/awdp_output"
OUTPUT_CSV = f"{OUTPUT_DIR}/allbrand_simple_sku_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
MARKUP_PERCENTAGE = 1.5

def clean_text(text):
    """Clean and normalize text"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', str(text))
    return text.strip()

def apply_markup(price):
    """Apply 1.5% markup to price"""
    try:
        price_float = float(re.sub(r'[^\d.]', '', str(price)))
        if price_float > 0:
            marked_up = price_float * (1 + MARKUP_PERCENTAGE / 100)
            return round(marked_up, 2)
    except:
        pass
    return price

def extract_original_sku(awdp_sku):
    """Extract original SKU from AWDP cipher-encoded SKU"""
    # Remove AWDP- prefix
    if awdp_sku.startswith('AWDP-'):
        cipher_part = awdp_sku[5:]
        
        # Try to get original SKU from metadata if available
        # For now, return a simplified version
        return cipher_part[:20]  # Truncate to reasonable length
    
    return awdp_sku

def process_csv():
    """Process the AllBrand CSV file"""
    print("Starting AllBrand CSV reprocessing...")
    print(f"Input: {INPUT_CSV}")
    print(f"Output: {OUTPUT_CSV}")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    products = []
    
    try:
        with open(INPUT_CSV, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            
            for i, row in enumerate(reader, 1):
                if i % 100 == 0:
                    print(f"Processing row {i}...")
                
                # Extract original SKU from the encoded one
                encoded_sku = row.get('SKU', '')
                raw_sku = row.get('Meta: _awdp_raw_sku', '')
                
                # Use raw SKU if available, otherwise use encoded
                original_sku = raw_sku if raw_sku else encoded_sku.replace('AWDP-', '')
                
                # Clean up the original SKU
                original_sku = re.sub(r'[^a-zA-Z0-9\-]', '', original_sku)[:30]
                
                # Create simple AWDP- prefix SKU
                if original_sku and not original_sku.startswith('AWDP-'):
                    simple_sku = f"AWDP-{original_sku}"
                else:
                    simple_sku = f"AWDP-{encoded_sku.replace('AWDP-', '')[:20]}"
                
                # Extract price
                price_str = row.get('Regular price', '') or row.get('Sale price', '') or '0'
                original_price = apply_markup(price_str)  # Apply markup to whatever price we find
                
                # Extract name
                name = clean_text(row.get('Name', ''))
                
                # Extract description
                description = clean_text(row.get('Short description', '') or row.get('Description', ''))
                
                # Extract category
                categories = row.get('Categories', '')
                category = categories.split(',')[0].strip() if categories else 'Window Hardware'
                
                # Extract image
                images = row.get('Images', '')
                image_url = images.split(',')[0].strip() if images else ''
                
                # Extract source URL
                source_url = row.get('Meta: _awdp_source_url', '')
                
                product = {
                    'sku': simple_sku,
                    'name': name,
                    'description': description,
                    'price': original_price,
                    'originalPrice': price_str if price_str else '0',
                    'category': category,
                    'supplier': 'All Window Door Parts',
                    'inStock': row.get('In stock?', '1') == '1',
                    'imageUrl': image_url,
                    'tags': '',
                    'compatibleBrands': '',
                    'specifications': '{}'
                }
                
                products.append(product)
        
        print(f"Processed {len(products)} products")
        
        # Write output CSV
        print(f"Writing output CSV...")
        
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['sku', 'name', 'description', 'price', 'originalPrice', 'category', 
                         'supplier', 'inStock', 'imageUrl', 'tags', 'compatibleBrands', 'specifications']
            
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(products)
        
        print(f"SUCCESS: CSV written successfully with {len(products)} products")
        print(f"File: {OUTPUT_CSV}")
        
        return OUTPUT_CSV
        
    except Exception as e:
        print(f"Error processing CSV: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    try:
        output_file = process_csv()
        if output_file:
            print(f"\nSUCCESS: Reprocessing completed successfully!")
            print(f"Import file: {output_file}")
        else:
            print("\nERROR: Reprocessing failed")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()