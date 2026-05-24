"""
Convert AWDP JSON to admin import CSV format
Maps AWDP parent/variation structure to flat CSV format for admin import
"""

import json
import csv
from typing import Dict, List

def load_awdp_data():
    """Load AWDP processed data from JSON files"""
    with open('scrapers/awdp_output/awdp-products.json', 'r', encoding='utf-8') as f:
        products = json.load(f)
    
    with open('scrapers/awdp_output/awdp-variations.json', 'r', encoding='utf-8') as f:
        variations = json.load(f)
    
    print(f"Loaded {len(products)} parent products and {len(variations)} variations")
    return products, variations

def convert_variation_to_csv_row(variation: Dict, parent: Dict) -> Dict:
    """Convert AWDP variation to CSV row format"""
    attributes = variation.get('attributes', {})
    
    # Build specifications string from attributes
    specifications = {}
    for key, value in attributes.items():
        if value:
            specifications[key] = str(value)
    
    # Build tags from parent flags and attributes
    tags = []
    if parent.get('flags', {}).get('sold_in_pairs'):
        tags.append('sold_in_pairs')
    if 'handing' in attributes:
        tags.append(f"handing_{attributes['handing']}")
    
    return {
        'sku': variation.get('awdp_sku', ''),
        'name': variation.get('name', f"{parent.get('name', '')} - {variation.get('variant_label', 'Variation')}"),
        'description': parent.get('description', ''),
        'price': str(variation.get('price', '0') or '0'),
        'originalPrice': str(variation.get('price', '0') or '0'),
        'category': parent.get('category', ''),
        'supplier': parent.get('brand', ''),
        'inStock': 'true' if variation.get('stock', 'true') == 'true' else 'false',
        'imageUrl': variation.get('image_override', '') or parent.get('image', ''),
        'tags': ', '.join(tags),
        'compatibleBrands': '',
        'specifications': json.dumps(specifications) if specifications else ''
    }

def convert_parent_to_csv_row(product: Dict) -> Dict:
    """Convert AWDP parent product to CSV row format"""
    flags = product.get('flags', {})
    
    # Build tags from parent flags
    tags = []
    if flags.get('sold_in_pairs'):
        tags.append('sold_in_pairs')
    if flags.get('OEM'):
        tags.append('OEM')
    if flags.get('discontinued'):
        tags.append('discontinued')
    
    # Use price range midpoint for parent
    price_range = product.get('price_range', {})
    if price_range and price_range.get('min') and price_range.get('max'):
        price = str((price_range['min'] + price_range['max']) / 2)
        original_price = str(price_range['max'])
    else:
        price = '0'
        original_price = '0'
    
    return {
        'sku': product.get('id', ''),  # Use UUID as SKU for parent
        'name': product.get('name', ''),
        'description': product.get('description', ''),
        'price': price,
        'originalPrice': original_price,
        'category': product.get('category', ''),
        'supplier': product.get('brand', ''),
        'inStock': 'true',
        'imageUrl': product.get('image', ''),
        'tags': ', '.join(tags),
        'compatibleBrands': '',
        'specifications': ''
    }

def convert_to_csv(products: List[Dict], variations: List[Dict]):
    """Convert AWDP data to CSV format for admin import"""
    # Create parent map
    parent_map = {p['id']: p for p in products}
    
    csv_rows = []
    
    # Convert variations (these are the actual sellable products)
    for variation in variations:
        parent_id = variation.get('parent_id')
        if parent_id and parent_id in parent_map:
            parent = parent_map[parent_id]
            csv_row = convert_variation_to_csv_row(variation, parent)
            csv_rows.append(csv_row)
    
    # Also include parents as standalone products
    for product in products:
        csv_row = convert_parent_to_csv_row(product)
        csv_rows.append(csv_row)
    
    print(f"Converted {len(csv_rows)} rows to CSV format")
    return csv_rows

def save_csv(csv_rows: List[Dict], output_file: str):
    """Save CSV rows to file"""
    fieldnames = ['sku', 'name', 'description', 'price', 'originalPrice', 
                 'category', 'supplier', 'inStock', 'imageUrl', 'tags', 
                 'compatibleBrands', 'specifications']
    
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)
    
    print(f"Saved CSV to {output_file}")

def main():
    """Main conversion function"""
    print("Converting AWDP JSON to admin import CSV format...")
    print("=" * 60)
    
    # Load AWDP data
    products, variations = load_awdp_data()
    
    # Convert to CSV format
    csv_rows = convert_to_csv(products, variations)
    
    # Save CSV
    timestamp = __import__('datetime').datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"scrapers/awdp_admin_import_{timestamp}.csv"
    save_csv(csv_rows, output_file)
    
    print("=" * 60)
    print(f"Conversion complete!")
    print(f"Ready for admin import via API endpoint")
    print(f"CSV file: {output_file}")

if __name__ == "__main__":
    main()