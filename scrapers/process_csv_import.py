"""
Process existing CSV data and prepare for AWDP import with 1.5% markup
"""

import csv
import re
import json
from datetime import datetime

# AWDP SKU Cipher (from adminProducts.ts)
NUM_TO_LETTER = {
    "0": "E", "1": "P", "2": "R", "3": "O", "4": "F",
    "5": "I", "6": "T", "7": "A", "8": "B", "9": "L",
}
LETTER_TO_NUM = {
    "P": "1", "R": "2", "O": "3", "F": "4", "I": "5",
    "T": "6", "A": "7", "B": "8", "L": "9", "E": "0",
}

MARKUP_PERCENTAGE = 1.5  # 1.5% markup

def apply_cipher(text):
    """Apply PROFITABLE cipher to generate AWDP SKU"""
    result = []
    for char in str(text).upper():
        if char in NUM_TO_LETTER:
            result.append(NUM_TO_LETTER[char])
        elif char in LETTER_TO_NUM:
            result.append(LETTER_TO_NUM[char])
        else:
            result.append(char)
    return ''.join(result)

def generate_awdp_sku(original_sku, product_name, source):
    """Generate AWDP SKU from original SKU or product name"""
    clean_sku = ""
    
    if original_sku:
        clean_sku = re.sub(r'[^a-zA-Z0-9]', '', str(original_sku))
    
    # If no SKU or SKU is too short, use product name
    if not clean_sku or len(clean_sku) < 3:
        # Use first few words of product name
        words = re.findall(r'[a-zA-Z0-9]+', product_name)
        clean_sku = ''.join(words[:3]) if words else source
    
    ciphered = apply_cipher(clean_sku[:20])  # Limit to 20 chars
    return f"AWDP-{ciphered}"

def apply_markup(price):
    """Apply 1.5% markup to price"""
    try:
        # Remove currency symbols and extract price
        price_text = str(price)
        price_match = re.search(r'[\d,]+\.?\d*', price_text)
        if price_match:
            price_float = float(price_match.group().replace(',', ''))
            if price_float > 0:
                marked_up = price_float * (1 + MARKUP_PERCENTAGE / 100)
                return round(marked_up, 2)
    except:
        pass
    return 0.0

def clean_text(text):
    """Clean and normalize text"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', str(text))
    text = re.sub(r'<[^>]+>', '', text)  # Remove HTML tags
    return text.strip()[:2000]  # Limit to 2000 chars

def clean_category(category):
    """Clean category name"""
    if not category:
        return "Window Parts"
    
    # Remove parenthetical numbers like "(101)"
    category = re.sub(r'\s*\(\d+\)', '', str(category))
    category = category.strip()
    
    return category if category else "Window Parts"

def process_truthentrygard_csv(csv_file):
    """Process TruthEntryGard CSV file"""
    products = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Extract basic product info
                name = clean_text(row.get('product_name', ''))
                if not name:
                    continue
                
                base_sku = row.get('base_sku', '').strip()
                variation_sku = row.get('variation_sku', '').strip()
                price_text = row.get('base_price_text', row.get('variation_price', ''))
                category = clean_category(row.get('category', ''))
                description = clean_text(row.get('description', ''))
                image_urls = row.get('image_urls', '')
                product_url = row.get('product_url', '')
                
                # Use variation SKU if available, otherwise base SKU
                sku = variation_sku if variation_sku else base_sku
                
                # Extract price
                price = apply_markup(price_text)
                
                # Handle attributes JSON if present
                attributes = {}
                try:
                    attrs_json = row.get('variation_attributes_json', row.get('base_attributes_json', '{}'))
                    if attrs_json:
                        attributes = json.loads(attrs_json)
                except:
                    pass
                
                # Create specifications from attributes
                specifications = {}
                if attributes:
                    for key, value in attributes.items():
                        if value and value != '""':
                            specifications[key] = value
                
                # Format for AWDP import - preserve original SKU
                awdp_sku = generate_awdp_sku(sku, name, 'truthentrygard')
                
                product = {
                    'sku': awdp_sku,  # AWDP encoded SKU
                    'oem_sku': sku,   # Original OEM SKU for grouping
                    'name': name,
                    'description': description,
                    'price': str(price) if price > 0 else '',
                    'originalPrice': price_text,
                    'category': category,
                    'supplier': 'TruthEntryGard',
                    'imageUrl': image_urls,
                    'inStock': 'true',
                    'tags': '',
                    'compatibleBrands': '',
                    'specifications': json.dumps(specifications) if specifications else ''
                }
                
                products.append(product)
                
        print(f"Processed {len(products)} products from TruthEntryGard CSV")
        return products
        
    except Exception as e:
        print(f"Error processing TruthEntryGard CSV: {e}")
        return []

def process_allbrand_csv(csv_file):
    """Process AllBrand CSV file"""
    products = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Extract basic product info
                name = clean_text(row.get('Name', ''))
                if not name:
                    continue
                
                sku = row.get('SKU', '').strip().replace('AWDP-', '')  # Remove AWDP- prefix if present
                raw_sku = row.get('Meta: _awdp_raw_sku', '')
                price_text = row.get('Regular price', row.get('Sale price', ''))
                category = clean_category(row.get('Categories', ''))
                description = clean_text(row.get('Description', row.get('Short description', '')))
                image = row.get('Images', '')
                source_url = row.get('Meta: _awdp_source_url', '')
                
                # Use raw_sku if available, otherwise SKU
                original_sku = raw_sku if raw_sku else sku
                
                # Extract price
                price = apply_markup(price_text)
                
                # Parse attributes if present
                specifications = {}
                try:
                    attrs_raw = row.get('Attributes (raw)', '')
                    if attrs_raw:
                        attrs_dict = json.loads(attrs_raw)
                        # Extract relevant specs
                        for key, value in attrs_dict.items():
                            if key not in ['0_items', 'terms_and_conditions', 'additional_info', 'search', 
                                         'shopping_cart', 'catalog', 'sku', 'https', '_a_href']:
                                if value and len(str(value)) < 200:  # Skip very long values
                                    specifications[key] = str(value)[:100]
                except:
                    pass
                
                # Create AWDP SKU if not already present
                if sku.startswith('AWDP-'):
                    awdp_sku = sku
                    original_sku_clean = raw_sku if raw_sku else sku.replace('AWDP-', '')
                else:
                    awdp_sku = generate_awdp_sku(original_sku, name, 'allbrand')
                    original_sku_clean = original_sku if original_sku else sku
                
                product = {
                    'sku': awdp_sku,      # AWDP encoded SKU
                    'oem_sku': original_sku_clean,  # Original OEM SKU for grouping
                    'name': name,
                    'description': description,
                    'price': str(price) if price > 0 else '',
                    'originalPrice': price_text,
                    'category': category,
                    'supplier': 'AllBrand',
                    'imageUrl': image,
                    'inStock': 'true',
                    'tags': '',
                    'compatibleBrands': '',
                    'specifications': json.dumps(specifications) if specifications else ''
                }
                
                products.append(product)
                
        print(f"Processed {len(products)} products from AllBrand CSV")
        return products
        
    except Exception as e:
        print(f"Error processing AllBrand CSV: {e}")
        return []

def main():
    """Main processing function"""
    all_products = []
    
    print("Processing existing CSV data for AWDP import")
    print(f"Markup: {MARKUP_PERCENTAGE}%")
    print("=" * 60)
    
    # Process TruthEntryGard CSV
    print("\nProcessing TruthEntryGard CSV...")
    truth_products = process_truthentrygard_csv('attached_assets/truthentrygard_full_products_1776317786975.csv')
    all_products.extend(truth_products)
    
    # Process AllBrand CSV
    print("\nProcessing AllBrand CSV...")
    allbrand_products = process_allbrand_csv('attached_assets/allbrand_products_1776979015894.csv')
    all_products.extend(allbrand_products)
    
    print(f"\n{'=' * 60}")
    print(f"Total products processed: {len(all_products)}")
    
    # Remove duplicates based on SKU
    seen_skus = set()
    unique_products = []
    for product in all_products:
        if product['sku'] not in seen_skus:
            seen_skus.add(product['sku'])
            unique_products.append(product)
    
    print(f"Unique products after deduplication: {len(unique_products)}")
    
    # Save to CSV
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"scrapers/awdp_import_{timestamp}.csv"
    
    if unique_products:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['sku', 'oem_sku', 'name', 'description', 'price', 'originalPrice', 
                         'category', 'supplier', 'imageUrl', 'inStock', 'tags', 
                         'compatibleBrands', 'specifications']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(unique_products)
        
        print(f"Saved {len(unique_products)} products to {output_file}")
        print(f"Ready for import via AWDP admin API")
        
        # Show sample products
        print(f"\nSample products:")
        for i, product in enumerate(unique_products[:3]):
            print(f"\n{i+1}. {product['sku']}")
            print(f"   Name: {product['name'][:50]}")
            print(f"   Price: {product['price']}")
            print(f"   Category: {product['category']}")
    else:
        print("No products to save")

if __name__ == "__main__":
    main()