"""
Simple AllBrand Catalog Scraper
Scrapes product tables from catalog pages
- Extracts SKU, title, price from catalog tables
- Adds AWDP- prefix to SKUs (no cipher encoding)
- Applies 1.5% markup
- Outputs to admin import CSV format
"""

import requests
from bs4 import BeautifulSoup
import csv
import re
import time
from urllib.parse import urljoin
import os
from datetime import datetime

# Configuration
BASE_URL = "https://www.allbrandwindowdoorparts.com"
CATALOG_URL = f"{BASE_URL}/catalog"
MARKUP_PERCENTAGE = 1.5
OUTPUT_DIR = "scrapers/awdp_output"
OUTPUT_CSV = f"{OUTPUT_DIR}/allbrand_catalog_scraper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

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

def get_catalog_categories():
    """Get all catalog category URLs from main catalog page"""
    categories = []
    
    try:
        print(f"Fetching main catalog page: {CATALOG_URL}")
        response = requests.get(CATALOG_URL, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find catalog links in the catalog section
            for link in soup.find_all('a', href=True):
                href = link['href']
                # Look for catalog category links (numeric catalog IDs)
                if '/catalog/' in href and href != CATALOG_URL:
                    full_url = urljoin(BASE_URL, href)
                    # Only include category URLs (not product pages)
                    if full_url not in categories and full_url.count('/') == 4:  # /catalog/123 format
                        categories.append(full_url)
                        
        print(f"Found {len(categories)} catalog categories")
        return categories
        
    except Exception as e:
        print(f"Error getting catalog categories: {e}")
        return []

def extract_products_from_table(table, category_name):
    """Extract products from a catalog table"""
    products = []
    
    try:
        rows = table.find_all('tr')
        if not rows:
            return products
        
        # Check if this is a product table by looking at headers
        first_row = rows[0]
        headers = first_row.find_all(['th', 'td'])
        header_texts = [h.get_text().strip().lower() for h in headers]
        
        if 'sku' not in header_texts and 'title' not in header_texts:
            return products
        
        # Start from data rows (skip header)
        data_rows = rows[1:] if len(rows) > 1 else []
        
        for row in data_rows:
            cells = row.find_all('td')
            if len(cells) >= 2:
                try:
                    # Extract SKU (first column)
                    sku = cells[0].get_text().strip()
                    
                    # Extract title and URL (second column)
                    title_link = cells[1].find('a')
                    if title_link:
                        title = title_link.get_text().strip()
                        product_url = urljoin(BASE_URL, title_link.get('href', ''))
                    else:
                        title = cells[1].get_text().strip()
                        product_url = ""
                    
                    # Extract price (third column if exists)
                    price = ""
                    if len(cells) >= 3:
                        price_text = cells[2].get_text().strip()
                        price_match = re.search(r'[\d,]+\.?\d*', price_text)
                        if price_match:
                            price = price_match.group()
                    
                    if sku and title:
                        product = {
                            'sku': sku,
                            'title': title,
                            'price': price,
                            'product_url': product_url,
                            'category': category_name
                        }
                        products.append(product)
                        
                except Exception as e:
                    continue
                    
    except Exception as e:
        print(f"Error extracting products from table: {e}")
    
    return products

def scrape_catalog():
    """Main scraping function"""
    print("Starting AllBrand catalog scraper...")
    print(f"Output: {OUTPUT_CSV}")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Get categories
    categories = get_catalog_categories()
    
    if not categories:
        print("No categories found, exiting...")
        return None
    
    all_products = []
    
    # Scrape each category
    for i, category_url in enumerate(categories[:10], 1):  # Limit to first 10 categories for testing
        print(f"\n[{i}/{min(10, len(categories))}] Processing: {category_url}")
        
        try:
            # Extract category name from URL
            category_name = category_url.split('/')[-1]
            
            response = requests.get(category_url, headers=HEADERS, timeout=15)
            if response.status_code != 200:
                print(f"  Failed to fetch page (status {response.status_code})")
                continue
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all tables
            tables = soup.find_all('table')
            category_products = []
            
            for table in tables:
                products = extract_products_from_table(table, category_name)
                category_products.extend(products)
            
            print(f"  Found {len(category_products)} products")
            all_products.extend(category_products)
            
            # Rate limiting
            time.sleep(1)
            
        except Exception as e:
            print(f"  Error: {e}")
            continue
    
    print(f"\nTotal products found: {len(all_products)}")
    
    if len(all_products) == 0:
        print("No products found, exiting...")
        return None
    
    # Prepare CSV data
    print("Preparing CSV data...")
    csv_data = []
    
    for product in all_products:
        # Apply AWDP- prefix to SKU (no cipher)
        original_sku = product['sku']
        simple_sku = f"AWDP-{original_sku}"
        
        # Apply markup
        original_price = product['price']
        marked_price = apply_markup(original_price)
        
        # Determine category from URL path
        category = product.get('category', 'Window Hardware').replace('-', ' ').title()
        
        csv_row = {
            'sku': simple_sku,
            'name': clean_text(product['title']),
            'description': f'Product from {category}',
            'price': marked_price,
            'originalPrice': original_price,
            'category': category,
            'supplier': 'All Window Door Parts',
            'inStock': True,
            'imageUrl': '',
            'tags': '',
            'compatibleBrands': '',
            'specifications': '{}'
        }
        
        csv_data.append(csv_row)
    
    # Write CSV
    print(f"Writing CSV to {OUTPUT_CSV}...")
    
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['sku', 'name', 'description', 'price', 'originalPrice', 'category', 
                     'supplier', 'inStock', 'imageUrl', 'tags', 'compatibleBrands', 'specifications']
        
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_data)
    
    print(f"SUCCESS: CSV written with {len(csv_data)} products")
    print(f"File: {OUTPUT_CSV}")
    
    return OUTPUT_CSV

if __name__ == "__main__":
    try:
        output_file = scrape_catalog()
        if output_file:
            print(f"\nSUCCESS: Scraping completed!")
            print(f"Import file: {output_file}")
        else:
            print("\nERROR: Scraping failed")
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()