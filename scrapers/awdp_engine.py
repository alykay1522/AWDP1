"""
AWDP Engine - Product Processing Pipeline
Processes raw product data according to AWDP technical rules:
- Parent/variation grouping
- AWDP naming conventions
- SKU encoding
- Category assignment
- Validation
"""

import csv
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Any, Optional

# AWDP Configuration
CATEGORY_CODES = {
    'Balances': 'BAL',
    'Operators': 'OPR',
    'Locks & Keepers': 'LOC',
    'Rollers': 'ROL',
    'Weatherstrip': 'WTH',
    'Glazing Bead': 'GLZ',
    'Jamb Liners': 'JAM',
    'Patio Door Hardware': 'PAT',
    'Sash Hardware': 'SAS',
    'OEM Hardware': 'OEM',
    'Specialty': 'SPC'
}

BRAND_CODES = {
    'Truth EntryGard': 'TEG',
    'AllBrand': 'ALB',
    'BiltBest': 'BBT',
    'WeFixItUSA': 'WFU',
    'Norco': 'NRC',
    'Generic': 'GEN'
}

# AWDP Master Attributes
MASTER_ATTRIBUTES = [
    'length', 'width', 'thickness', 'diameter', 'color', 'finish', 
    'material', 'brand', 'series', 'model', 'handing', 'mount_type',
    'sash_type', 'arm_length', 'wheel_diameter', 'housing_type',
    'jamb_liner_type', 'glazing_profile', 'lock_type', 'track_type'
]

class AWDPEngine:
    def __init__(self):
        self.parent_products = []
        self.variations = []
        self.validation_errors = []
        self.stats = {
            'total_raw': 0,
            'grouped_parents': 0,
            'total_variations': 0,
            'validation_failures': 0
        }
    
    def load_csv_data(self, csv_file: str) -> List[Dict]:
        """Load raw product data from CSV"""
        products = []
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                products.append(row)
        self.stats['total_raw'] = len(products)
        print(f"Loaded {len(products)} raw products from CSV")
        return products
    
    def extract_attributes(self, product: Dict) -> Dict:
        """Extract and normalize attributes from raw product data"""
        attributes = {}
        
        # Extract from specifications if present
        specs = product.get('specifications', '')
        if specs:
            try:
                specs_dict = json.loads(specs) if isinstance(specs, str) else specs
                if isinstance(specs_dict, dict):
                    for key, value in specs_dict.items():
                        # Handle TruthEntryGard format: attribute_length, attribute_color
                        normalized_key = self.normalize_attribute_name(key)
                        if normalized_key in MASTER_ATTRIBUTES:
                            attributes[normalized_key] = self.normalize_attribute_value(value)
            except:
                pass
        
        # Extract from description
        description = product.get('description', '')
        if description:
            # Try to extract common attributes from description
            attributes.update(self.extract_attributes_from_text(description))
        
        # Extract from name
        name = product.get('name', '')
        if name:
            attributes.update(self.extract_attributes_from_text(name))
        
        # Override with explicit supplier info
        supplier = product.get('supplier', '')
        if supplier:
            # Map supplier names to brand codes
            brand_mapping = {
                'TruthEntryGard': 'Truth EntryGard',
                'AllBrand': 'AllBrand',
                'BiltBest': 'BiltBest'
            }
            attributes['brand'] = brand_mapping.get(supplier, supplier)
        
        return attributes
    
    def normalize_attribute_name(self, name: str) -> str:
        """Normalize attribute names to match AWDP master attributes"""
        name_mapping = {
            'attribute_length': 'length',
            'attribute_color': 'color',
            'attribute_finish': 'finish',
            'attribute_handing': 'handing',
            'attribute_pa_handing': 'handing',  # TruthEntryGard format
            'length': 'length',
            'color': 'color',
            'finish': 'finish',
            'handing': 'handing',
            'material': 'material',
            'width': 'width',
            'thickness': 'thickness',
            'diameter': 'diameter'
        }
        
        # Direct match first
        if name.lower() in name_mapping:
            return name_mapping[name.lower()]
        
        # Fuzzy match
        normalized = name.lower().replace('_', '').replace('-', '').replace(' ', '')
        for key, value in name_mapping.items():
            key_normalized = key.lower().replace('_', '').replace('-', '').replace(' ', '')
            if key_normalized == normalized or key_normalized in normalized:
                return value
        
        return name.lower()
    
    def normalize_attribute_value(self, value: Any) -> str:
        """Normalize attribute values"""
        if value is None:
            return ''
        return str(value).strip().strip('"\'')
    
    def extract_attributes_from_text(self, text: str) -> Dict:
        """Extract attributes from product text using patterns"""
        attributes = {}
        
        # Length patterns (inches, feet, etc.)
        length_patterns = [
            r'(\d+)\s*["\']',  # 34"
            r'(\d+)\s*in',     # 34in
            r'(\d+)\s*inch',   # 34inch
            r'(\d+)\s*["\']\s*(\d+)/(\d+)',  # 34 1/2"
        ]
        
        for pattern in length_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 3:
                    # Handle fractional inches
                    whole, frac_num, frac_den = match.groups()
                    length = f"{whole} {frac_num}/{frac_den}\""
                else:
                    length = match.group(1) + '"'
                attributes['length'] = length
                break
        
        # Color/finish patterns
        color_patterns = [
            r'(white|black|bronze|brass|chrome|silver|gold|tan|beige|brown|gray)',
            r'(white|black|bronze|brass|chrome|silver|gold|tan|beige|brown|gray)\s*(finish|color)?'
        ]
        
        for pattern in color_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                attributes['color'] = match.group(1).capitalize()
                break
        
        # Handing patterns
        if re.search(r'left\s*hand|lh|left', text, re.IGNORECASE):
            attributes['handing'] = 'Left'
        elif re.search(r'right\s*hand|rh|right', text, re.IGNORECASE):
            attributes['handing'] = 'Right'
        
        # Material patterns
        material_patterns = [
            r'(aluminum|steel|vinyl|plastic|wood|brass|zinc|nylon)',
        ]
        
        for pattern in material_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                attributes['material'] = match.group(1).capitalize()
                break
        
        return attributes
    
    def determine_product_family(self, product: Dict, attributes: Dict) -> str:
        """Determine product family for grouping"""
        # PRIORITY 1: Use OEM SKU if available (most reliable for OEM grouping)
        oem_sku = product.get('oem_sku', '')
        if oem_sku and not oem_sku.startswith('AWDP-'):
            # Remove common variation suffixes from SKU
            base_sku = re.sub(r'[-_].*$', '', oem_sku)  # Remove everything after first dash/underscore
            if base_sku:
                return f"SKU:{base_sku}"
        
        # PRIORITY 2: Use regular SKU if it has OEM info
        sku = product.get('sku', '')
        if sku and not sku.startswith('AWDP-'):
            # Remove common variation suffixes from SKU
            base_sku = re.sub(r'[-_].*$', '', sku)  # Remove everything after first dash/underscore
            if base_sku:
                return f"SKU:{base_sku}"
        
        # PRIORITY 3: Use supplier + core product name
        name = product.get('name', '')
        supplier = product.get('supplier', '')
        category = self.assign_category(product, attributes)
        
        # Remove variations from name to get core type
        core_name = self.extract_core_product_name(name)
        
        # Use a more aggressive grouping strategy
        # Group by supplier + category + first 2-3 words of core name
        core_words = core_name.split()[:3]
        core_key = ' '.join(core_words)
        
        family_key = f"{supplier}:{category}:{core_key}"
        
        return family_key
    
    def extract_core_product_name(self, name: str) -> str:
        """Extract core product name by removing variations"""
        # Remove common variation patterns
        variations_to_remove = [
            r'\s*\d+\s*\d/\d+\s*["\']',  # Remove fractional lengths like 34 1/2"
            r'\s*\d+\s*["\']',  # Remove lengths like 34"
            r'\s*\d+\s*[\'′]',  # Remove lengths like 34'
            r'\s*\d+\s*in',  # Remove lengths like 34in
            r'\s*(white|black|bronze|brass|chrome|silver|gold|tan|beige|brown|gray|dark\s*bronze|sandstone)',  # Remove colors
            r'\s*(left\s*hand|right\s*hand|lh|rh)',  # Remove handing
            r'\s*(pair|pack|set)',  # Remove packaging
            r'\s*-\s*[\d\s\-"]+',  # Remove size ranges
        ]
        
        core_name = name
        for pattern in variations_to_remove:
            core_name = re.sub(pattern, '', core_name, flags=re.IGNORECASE)
        
        # Clean up extra spaces and dashes
        core_name = re.sub(r'\s+', ' ', core_name)
        core_name = re.sub(r'\s*-\s*', ' - ', core_name)
        
        return core_name.strip()
    
    def group_products_by_family(self, products: List[Dict]) -> Dict[str, List[Dict]]:
        """Group products into families based on OEM relationships"""
        families = defaultdict(list)
        
        for product in products:
            attributes = self.extract_attributes(product)
            family_key = self.determine_product_family(product, attributes)
            families[family_key].append({
                'product': product,
                'attributes': attributes
            })
        
        print(f"Grouped into {len(families)} product families")
        self.stats['grouped_parents'] = len(families)
        
        return families
    
    def assign_category(self, product: Dict, attributes: Dict) -> str:
        """Auto-assign category based on rules"""
        name = product.get('name', '').lower()
        description = product.get('description', '').lower()
        
        # Category assignment rules
        category_keywords = {
            'Balances': ['balance', 'spring', 'coil', 'spiral', 'channel'],
            'Operators': ['operator', 'crank', 'handle', 'operator arm'],
            'Locks & Keepers': ['lock', 'keeper', 'latch', 'catch'],
            'Rollers': ['roller', 'wheel', 'assembly'],
            'Weatherstrip': ['weatherstrip', 'seal', 'bulb', 'kerf', 'glazing'],
            'Glazing Bead': ['bead', 'glazing', 'spline'],
            'Jamb Liners': ['jamb liner', 'carrier', 'track'],
            'Patio Door Hardware': ['patio door', 'sliding door', 'roller assembly'],
            'Sash Hardware': ['sash', 'tilt', 'pivot']
        }
        
        text_to_check = f"{name} {description}"
        
        for category, keywords in category_keywords.items():
            for keyword in keywords:
                if keyword in text_to_check:
                    return category
        
        # Default fallback
        return 'OEM Hardware'
    
    def generate_awdp_name(self, product: Dict, attributes: Dict) -> str:
        """Generate AWDP-compliant product name"""
        brand = attributes.get('brand', product.get('supplier', 'Generic'))
        series_model = attributes.get('series', attributes.get('model', ''))
        product_type = self.extract_product_type(product.get('name', ''))
        
        # Key attributes for name
        key_attrs = []
        if 'length' in attributes:
            key_attrs.append(attributes['length'])
        if 'handing' in attributes:
            key_attrs.append(attributes['handing'])
        if 'color' in attributes:
            key_attrs.append(attributes['color'])
        
        # Build name
        name_parts = [brand]
        if series_model:
            name_parts.append(series_model)
        name_parts.append(product_type)
        name_parts.extend(key_attrs)
        
        return ' - '.join(filter(None, name_parts))
    
    def extract_product_type(self, name: str) -> str:
        """Extract product type from name"""
        product_types = [
            'Operator', 'Crank Handle', 'Lock', 'Keeper', 'Latch', 
            'Roller', 'Balance', 'Weatherstrip', 'Jamb Liner', 
            'Hinge', 'Handle', 'Seal', 'Bead'
        ]
        
        name_lower = name.lower()
        for ptype in product_types:
            if ptype.lower() in name_lower:
                return ptype
        
        return 'Hardware'
    
    def encode_awdp_sku(self, category: str, brand: str, series: str, 
                       attributes: Dict, index: int) -> str:
        """Encode SKU using CAT-BRAND-SERIES-ATTRIBUTES-INDEX format"""
        cat_code = CATEGORY_CODES.get(category, 'GEN')
        brand_code = BRAND_CODES.get(brand, 'GEN')
        
        # Compress series/model code
        series_code = self.compress_code(series, max_length=4)
        
        # Compress attributes
        attr_tokens = []
        if 'length' in attributes:
            attr_tokens.append(self.compress_code(attributes['length'], max_length=3))
        if 'color' in attributes:
            attr_tokens.append(self.compress_code(attributes['color'], max_length=3))
        if 'handing' in attributes:
            attr_tokens.append('LH' if attributes['handing'] == 'Left' else 'RH')
        
        attr_code = '-'.join(attr_tokens) if attr_tokens else 'GEN'
        
        # 2-digit index
        index_code = f"{index:02d}"
        
        return f"{cat_code}-{brand_code}-{series_code}-{attr_code}-{index_code}"
    
    def compress_code(self, text: str, max_length: int) -> str:
        """Compress text to fit within max length"""
        if not text:
            return 'GEN'
        
        # Remove vowels and common letters to compress
        compressed = re.sub(r'[aeiouAEIOU]', '', text)
        compressed = re.sub(r'[^a-zA-Z0-9]', '', compressed)
        
        return compressed[:max_length].upper() or 'GEN'
    
    def validate_product(self, product: Dict, attributes: Dict) -> bool:
        """Validate product against AWDP rules"""
        errors = []
        
        # Rule: No hypothetical products
        if not product.get('oem_sku') and not product.get('sku') and not product.get('name'):
            errors.append("Missing OEM SKU, SKU and name - hypothetical product")
        
        # Rule: Must have real attributes
        if not attributes:
            errors.append("No extractable attributes - insufficient data")
        
        # Rule: Must have category
        category = self.assign_category(product, attributes)
        if not category:
            errors.append("Could not assign category")
        
        if errors:
            self.validation_errors.append({
                'product': product.get('oem_sku', product.get('sku', 'unknown')),
                'errors': errors
            })
            self.stats['validation_failures'] += 1
            return False
        
        return True
    
    def process_families(self, families: Dict[str, List[Dict]]):
        """Process each family into parent + variations"""
        
        for family_key, family_products in families.items():
            # Get representative product for parent
            first_product = family_products[0]['product']
            first_attributes = family_products[0]['attributes']
            
            # Validate
            if not self.validate_product(first_product, first_attributes):
                continue
            
            # Determine category
            category = self.assign_category(first_product, first_attributes)
            
            # Generate parent SKU and data
            parent_id = str(uuid.uuid4())
            brand = first_attributes.get('brand', first_product.get('supplier', 'Generic'))
            series_model = first_attributes.get('series', first_attributes.get('model', ''))
            
            # Generate variations
            variations = []
            price_range = []
            
            for idx, item in enumerate(family_products):
                product = item['product']
                attributes = item['attributes']
                
                # Generate variation SKU
                awdp_sku = self.encode_awdp_sku(
                    category, brand, series_model, attributes, idx + 1
                )
                
                # Get price
                price = product.get('price', '0')
                try:
                    price_float = float(re.sub(r'[^\d.]', '', price))
                    if price_float > 0:
                        price_range.append(price_float)
                except:
                    pass
                
                variation = {
                    'parent_id': parent_id,
                    'variation_id': str(uuid.uuid4()),
                    'attributes': attributes,
                    'sku': product.get('oem_sku', product.get('sku', '')),  # Use OEM SKU
                    'awdp_sku': awdp_sku,
                    'price': price,
                    'stock': 'true' if product.get('inStock', 'true').lower() == 'true' else 'false',
                    'image_override': product.get('imageUrl', '')
                }
                variations.append(variation)
                self.stats['total_variations'] += 1
            
            # Generate parent product
            parent_product = {
                'id': parent_id,
                'name': self.generate_awdp_name(first_product, first_attributes),
                'category': category,
                'brand': brand,
                'series_model': series_model,
                'description': first_product.get('description', '')[:500],
                'image': first_product.get('imageUrl', ''),
                'price_range': {
                    'min': min(price_range) if price_range else 0,
                    'max': max(price_range) if price_range else 0
                },
                'flags': {
                    'sold_in_pairs': 'pair' in first_product.get('name', '').lower(),
                    'OEM': bool(first_product.get('sku')),
                    'discontinued': False,
                    'special_order': False
                },
                'seo': {
                    'meta_title': f"{brand} {series_model} - {category}",
                    'meta_description': first_product.get('description', '')[:160],
                    'keywords': f"{brand}, {series_model}, {category}, window parts, door parts"
                }
            }
            
            self.parent_products.append(parent_product)
            self.variations.extend(variations)
    
    def export_json(self, output_dir: str = 'scrapers/awdp_output'):
        """Export processed data to JSON files"""
        import os
        from pathlib import Path
        
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Export parent products
        products_file = output_path / 'awdp-products.json'
        with open(products_file, 'w', encoding='utf-8') as f:
            json.dump(self.parent_products, f, indent=2)
        
        # Export variations
        variations_file = output_path / 'awdp-variations.json'
        with open(variations_file, 'w', encoding='utf-8') as f:
            json.dump(self.variations, f, indent=2)
        
        # Export validation errors
        if self.validation_errors:
            errors_file = output_path / 'validation-errors.json'
            with open(errors_file, 'w', encoding='utf-8') as f:
                json.dump(self.validation_errors, f, indent=2)
        
        print(f"\nExported to {output_dir}/")
        print(f"  - awdp-products.json: {len(self.parent_products)} parent products")
        print(f"  - awdp-variations.json: {len(self.variations)} variations")
        if self.validation_errors:
            print(f"  - validation-errors.json: {len(self.validation_errors)} errors")
    
    def print_summary(self):
        """Print processing summary"""
        print(f"\n{'=' * 60}")
        print("AWDP Engine Processing Summary")
        print(f"{'=' * 60}")
        print(f"Total raw products: {self.stats['total_raw']}")
        print(f"Product families: {self.stats['grouped_parents']}")
        print(f"Parent products: {len(self.parent_products)}")
        print(f"Total variations: {self.stats['total_variations']}")
        print(f"Validation failures: {self.stats['validation_failures']}")
        print(f"{'=' * 60}")

def main():
    """Main processing function"""
    engine = AWDPEngine()
    
    # Load raw data
    print("Loading raw product data...")
    products = engine.load_csv_data('scrapers/awdp_import_20260523_230959.csv')
    
    # Group products into families
    print("\nGrouping products into families...")
    families = engine.group_products_by_family(products)
    
    # Process families into parent + variations
    print("\nProcessing families into parent/variation structure...")
    engine.process_families(families)
    
    # Print summary
    engine.print_summary()
    
    # Export JSON
    print("\nExporting processed data...")
    engine.export_json()
    
    print("\nAWDP Engine processing complete!")

if __name__ == "__main__":
    main()