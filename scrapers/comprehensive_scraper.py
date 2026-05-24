"""
Comprehensive Product Scraper for AWDP
Scrapes from multiple sources and formats for AWDP import with 1.5% markup
"""

import re
import csv
import json
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from datetime import datetime
import sys

# Configuration
SOURCES = {
    'wefixitusa': {
        'base_url': 'https://wefixitusa.com',
        'type': 'woocommerce',
        'enabled': True
    },
    'truthentrygard': {
        'base_url': 'https://truthentrygard.com', 
        'type': 'woocommerce',
        'enabled': True,
        'csv_file': 'attached_assets/truthentrygard_full_products_1776317786975.csv'
    },
    'allbrand': {
        'base_url': 'https://allbrandwindowdoorparts.com',
        'type': 'drupal',
        'enabled': True,
        'csv_file': 'attached_assets/allbrand_products_1776979015894.csv'
    },
    'biltbest': {
        'base_url': 'https://biltbestwindows.com',
        'type': 'drupal_wayback',
        'enabled': True
    }
}

MARKUP_PERCENTAGE = 1.5  # 1.5% markup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# AWDP SKU Cipher (from adminProducts.ts)
NUM_TO_LETTER = {
    "0": "E", "1": "P", "2": "R", "3": "O", "4": "F",
    "5": "I", "6": "T", "7": "A", "8": "B", "9": "L",
}
LETTER_TO_NUM = {
    "P": "1", "R": "2", "O": "3", "F": "4", "I": "5",
    "T": "6", "A": "7", "B": "8", "L": "9", "E": "0",
}

def apply_cipher(text):
    """Apply PROFITABLE cipher to generate AWDP SKU"""
    result = []
    for char in text.upper():
        if char in NUM_TO_LETTER:
            result.append(NUM_TO_LETTER[char])
        elif char in LETTER_TO_NUM:
            result.append(LETTER_TO_NUM[char])
        else:
            result.append(char)
    return ''.join(result)

def generate_awdp_sku(original_sku, source):
    """Generate AWDP SKU from original SKU"""
    if not original_sku:
        # Generate from source and timestamp
        timestamp = str(int(time.time()))[-6:]
        return f"AWDP-{apply_cipher(source.upper() + timestamp)}"
    
    clean_sku = re.sub(r'[^a-zA-Z0-9]', '', str(original_sku))
    ciphered = apply_cipher(clean_sku)
    return f"AWDP-{ciphered}"

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

def clean_text(text):
    """Clean and normalize text"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def get_product_urls_woocommerce(base_url, max_pages=50):
    """Get product URLs from WooCommerce site"""
    product_urls = set()
    
    # Try common WooCommerce endpoints
    endpoints = [
        '/product',
        '/shop',
        '/catalog',
        '/products'
    ]
    
    for endpoint in endpoints:
        try:
            url = urljoin(base_url, endpoint)
            response = requests.get(url, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find product links
                for link in soup.find_all('a', href=True):
                    href = link['href']
                    if '/product/' in href and '/product-category/' not in href:
                        product_urls.add(href)
                
                print(f"Found {len(product_urls)} products from {endpoint}")
                if len(product_urls) > 10:
                    break
                    
        except Exception as e:
            print(f"Error accessing {endpoint}: {e}")
            continue
    
    return list(product_urls)

def get_product_urls_drupal(base_url, max_pages=50):
    """Get product URLs from Drupal site"""
    product_urls = set()
    
    try:
        # Try to access catalog pages
        response = requests.get(base_url, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Look for catalog/category links
            for link in soup.find_all('a', href=True):
                href = link['href']
                # Drupal often uses /catalog/ or numeric IDs
                if '/catalog/' in href or re.search(r'/\d+$', href):
                    try:
                        cat_response = requests.get(href, headers=HEADERS, timeout=15)
                        if cat_response.status_code == 200:
                            cat_soup = BeautifulSoup(cat_response.text, 'html.parser')
                            for product_link in cat_soup.find_all('a', href=True):
                                prod_href = product_link['href']
                                if re.search(r'/catalog/\d+', prod_href):
                                    product_urls.add(prod_href)
                    except:
                        continue
                        
    except Exception as e:
        print(f"Error accessing Drupal site: {e}")
    
    return list(product_urls)

def get_wayback_urls(base_url):
    """Get URLs from Wayback Machine for offline sites"""
    import json as json_lib
    
    wayback_urls = []
    
    try:
        # Wayback Machine CDX API
        cdx_url = f"http://web.archive.org/cdx/search/cdx?url={base_url}/*&output=json&fl=timestamp,original&filter=statuscode:200&limit=100"
        
        response = requests.get(cdx_url, headers=HEADERS, timeout=30)
        if response.status_code == 200:
            data = json_lib.loads(response.text)
            
            if len(data) > 1:  # First row is header
                for row in data[1:]:
                    timestamp, original = row
                    # Construct wayback URL
                    wayback_url = f"https://web.archive.org/web/{timestamp}/{original}"
                    wayback_urls.append(wayback_url)
                    
        print(f"Found {len(wayback_urls)} Wayback snapshots for {base_url}")
        
    except Exception as e:
        print(f"Error accessing Wayback Machine: {e}")
    
    return wayback_urls[:50]  # Limit to most recent 50

def parse_woocommerce_product(url, source):
    """Parse product page from WooCommerce site"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract product title
        title = ""
        for selector in ['h1.product_title', 'h1.entry-title', 'h1']:
            element = soup.select_one(selector)
            if element:
                title = clean_text(element.get_text())
                break
        
        if not title:
            return None
        
        # Extract price
        price = ""
        price_element = soup.select_one('.price .amount, .price ins .amount, .price')
        if price_element:
            price_text = price_element.get_text()
            price_match = re.search(r'[\d,]+\.?\d*', price_text)
            if price_match:
                price = price_match.group()
        
        # Extract description
        description = ""
        desc_element = soup.select_one('.woocommerce-product-details__short-description, .short-description, div[data-role="description"]')
        if desc_element:
            description = clean_text(desc_element.get_text())
        
        # Extract category
        category = ""
        cat_element = soup.select_one('.posted_in a, .product-categories a')
        if cat_element:
            category = clean_text(cat_element.get_text())
        
        # Extract image
        image = ""
        img_element = soup.select_one('.woocommerce-product-gallery img, .product-image img')
        if img_element and img_element.get('src'):
            image = img_element['src']
        
        # Extract SKU
        sku = ""
        sku_element = soup.select_one('.sku, .product_sku, [itemprop="sku"]')
        if sku_element:
            sku = clean_text(sku_element.get_text())
        
        return {
            'source': source,
            'product_url': url,
            'name': title,
            'sku': sku,
            'price': price,
            'description': description,
            'category': category,
            'image_url': image,
            'raw_price': price
        }
        
    except Exception as e:
        print(f"Error parsing WooCommerce product {url}: {e}")
        return None

def parse_drupal_product(url, source):
    """Parse product page from Drupal site"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=20)
        if response.status_code != 200:
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract product title
        title = ""
        for selector in ['h1.page-title', 'h1.title', 'h1']:
            element = soup.select_one(selector)
            if element:
                title = clean_text(element.get_text())
                break
        
        if not title:
            return None
        
        # Extract price (Drupal often has different structure)
        price = ""
        price_patterns = [
            r'\$\s*[\d,]+\.?\d*',
            r'Price:\s*\$?[\d,]+\.?\d*',
            r'[\d,]+\.?\d*\s*USD'
        ]
        
        page_text = soup.get_text()
        for pattern in price_patterns:
            match = re.search(pattern, page_text)
            if match:
                price = match.group()
                break
        
        # Extract description
        description = ""
        desc_element = soup.select_one('.field-name-body, .field-type-text, .content, article')
        if desc_element:
            description = clean_text(desc_element.get_text())
        
        # Extract image
        image = ""
        img_element = soup.select_one('article img, .field-name-field-image img')
        if img_element and img_element.get('src'):
            image = img_element['src']
        
        return {
            'source': source,
            'product_url': url,
            'name': title,
            'sku': '',  # Drupal sites often don't show SKUs
            'price': price,
            'description': description,
            'category': '',
            'image_url': image,
            'raw_price': price
        }
        
    except Exception as e:
        print(f"Error parsing Drupal product {url}: {e}")
        return None

def load_csv_products(csv_file, source):
    """Load products from existing CSV file"""
    products = []
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Map CSV columns to our format
                if source == 'truthentrygard':
                    product = {
                        'source': source,
                        'product_url': row.get('product_url', ''),
                        'name': row.get('product_name', ''),
                        'sku': row.get('base_sku', row.get('variation_sku', '')),
                        'price': row.get('base_price_text', row.get('variation_price', '')),
                        'description': row.get('description', ''),
                        'category': row.get('category', ''),
                        'image_url': row.get('image_urls', ''),
                        'raw_price': row.get('base_price_text', row.get('variation_price', ''))
                    }
                elif source == 'allbrand':
                    product = {
                        'source': source,
                        'product_url': row.get('Meta: _awdp_source_url', ''),
                        'name': row.get('Name', ''),
                        'sku': row.get('Meta: _awdp_raw_sku', row.get('SKU', '')),
                        'price': row.get('Regular price', row.get('Sale price', '')),
                        'description': row.get('Description', row.get('Short description', '')),
                        'category': row.get('Categories', ''),
                        'image_url': row.get('Images', ''),
                        'raw_price': row.get('Regular price', row.get('Sale price', ''))
                    }
                
                if product['name']:
                    products.append(product)
                    
        print(f"Loaded {len(products)} products from {csv_file}")
        
    except Exception as e:
        print(f"Error loading CSV {csv_file}: {e}")
    
    return products

def format_for_awdp_import(products):
    """Format products for AWDP import"""
    formatted_products = []
    
    for product in products:
        # Generate AWDP SKU
        original_sku = product['sku'] or product['name']
        awdp_sku = generate_awdp_sku(original_sku, product['source'])
        
        # Apply markup
        marked_up_price = apply_markup(product['price'])
        
        # Format for AWDP import (matches normalizeRow expected columns)
        formatted = {
            'sku': awdp_sku,
            'name': product['name'],
            'description': product['description'][:2000],  # Limit description length
            'price': str(marked_up_price) if marked_up_price else '',
            'originalPrice': str(product['raw_price']) if product['raw_price'] else '',
            'category': product['category'],
            'supplier': product['source'],
            'imageUrl': product['image_url'],
            'inStock': 'true',
            'tags': '',
            'compatibleBrands': '',
            'specifications': ''
        }
        
        formatted_products.append(formatted)
    
    return formatted_products

def main():
    """Main scraping function"""
    all_products = []
    
    print("Starting comprehensive product scraping...")
    print(f"Markup: {MARKUP_PERCENTAGE}%")
    print("=" * 60)
    
    # Process each source
    for source_name, config in SOURCES.items():
        if not config['enabled']:
            continue
            
        print(f"\nProcessing {source_name}...")
        
        # Load existing CSV if available
        if 'csv_file' in config:
            csv_products = load_csv_products(config['csv_file'], source_name)
            all_products.extend(csv_products)
        
        # Scrape live website
        if config['type'] == 'woocommerce':
            product_urls = get_product_urls_woocommerce(config['base_url'])
            print(f"Found {len(product_urls)} product URLs to scrape")
            
            for i, url in enumerate(product_urls[:20]):  # Limit to 20 for testing
                if i % 5 == 0:
                    print(f"  Progress: {i}/{len(product_urls)}")
                    
                product = parse_woocommerce_product(url, source_name)
                if product:
                    all_products.append(product)
                time.sleep(1)  # Rate limiting
                
        elif config['type'] == 'drupal':
            product_urls = get_product_urls_drupal(config['base_url'])
            print(f"Found {len(product_urls)} product URLs to scrape")
            
            for i, url in enumerate(product_urls[:20]):  # Limit to 20 for testing
                if i % 5 == 0:
                    print(f"  Progress: {i}/{len(product_urls)}")
                    
                product = parse_drupal_product(url, source_name)
                if product:
                    all_products.append(product)
                time.sleep(1)  # Rate limiting
                
        elif config['type'] == 'drupal_wayback':
            wayback_urls = get_wayback_urls(config['base_url'])
            print(f"Found {len(wayback_urls)} Wayback URLs to scrape")
            
            for i, url in enumerate(wayback_urls[:10]):  # Limit to 10 for testing
                if i % 2 == 0:
                    print(f"  Progress: {i}/{len(wayback_urls)}")
                    
                product = parse_drupal_product(url, source_name)
                if product:
                    all_products.append(product)
                time.sleep(2)  # Slower rate limiting for Wayback
    
    print(f"\n{'=' * 60}")
    print(f"Total products collected: {len(all_products)}")
    
    # Remove duplicates based on name and source
    seen = set()
    unique_products = []
    for product in all_products:
        key = (product['name'], product['source'])
        if key not in seen:
            seen.add(key)
            unique_products.append(product)
    
    print(f"Unique products after deduplication: {len(unique_products)}")
    
    # Format for AWDP import
    formatted_products = format_for_awdp_import(unique_products)
    
    # Save to CSV
    output_file = f"scrapers/awdp_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if formatted_products:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['sku', 'name', 'description', 'price', 'originalPrice', 
                         'category', 'supplier', 'imageUrl', 'inStock', 'tags', 
                         'compatibleBrands', 'specifications']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(formatted_products)
        
        print(f"Saved {len(formatted_products)} products to {output_file}")
        print(f"Ready for import via AWDP admin API")
    else:
        print("No products to save")

if __name__ == "__main__":
    main()