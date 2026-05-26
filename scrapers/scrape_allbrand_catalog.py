"""
AllBrand Window Door Parts Catalog Scraper
Scrapes all products from https://www.allbrandwindowdoorparts.com/catalog
- Extracts product data including images
- Adds AWDP- prefix to SKUs (no cipher encoding)
- Applies 1.5% markup
- Outputs to admin import CSV format
"""

import requests
from bs4 import BeautifulSoup
import csv
import re
import time
from urllib.parse import urljoin, urlparse
import os
from datetime import datetime

# Configuration
BASE_URL = "https://www.allbrandwindowdoorparts.com"
CATALOG_URL = f"{BASE_URL}/catalog"
MARKUP_PERCENTAGE = 1.5
OUTPUT_DIR = "scrapers/awdp_output"
OUTPUT_CSV = f"{OUTPUT_DIR}/allbrand_catalog_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean_text(text):
    """Clean and normalize text"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
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
    """Get all catalog category URLs"""
    categories = []
    
    try:
        response = requests.get(CATALOG_URL, headers=HEADERS, timeout=15)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find catalog links
            for link in soup.find_all('a', href=True):
                href = link['href']
                # Look for catalog category links
                if '/catalog/' in href and href != CATALOG_URL:
                    full_url = urljoin(BASE_URL, href)
                    if full_url not in categories:
                        categories.append(full_url)
                        
        print(f"Found {len(categories)} catalog categories")
        return categories
        
    except Exception as e:
        print(f"Error getting catalog categories: {e}")
        return []

def get_products_from_category(category_url):
    """Extract products from a category page"""
    products = []
    
    try:
        response = requests.get(category_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return products
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for product tables - the site uses table format
        # Find tables with SKU, Title, Price columns
        tables = soup.find_all('table')
        
        for table in tables:
            # Check if this is a product table
            headers = table.find_all('th')
            header_texts = [h.get_text().strip().lower() for h in headers]
            
            if 'sku' in header_texts and 'title' in header_texts:
                rows = table.find_all('tr')[1:]  # Skip header row
                
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        # Extract SKU, Title, Price
                        sku_cell = cells[0].get_text().strip()
                        title_link = cells[1].find('a')
                        title = title_link.get_text().strip() if title_link else cells[1].get_text().strip()
                        product_url = urljoin(BASE_URL, title_link['href']) if title_link and title_link.get('href') else ""
                        
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
                                'category_url': category_url
                            }
                            products.append(product)
                            
        # Also check for pagination
        next_link = soup.find('a', text='next ›')
        if next_link and next_link.get('href'):
            next_url = urljoin(BASE_URL, next_link['href'])
            print(f"  Found next page: {next_url}")
            # You could recursively fetch next pages here
            
        print(f"  Found {len(products)} products in {category_url}")
        return products
        
    except Exception as e:
        print(f"Error processing category {category_url}: {e}")
        return products

def get_product_details(product_url):
    """Get detailed product information including images"""
    details = {
        'description': '',
        'image_url': '',
        'category': '',
        'specifications': {}
    }
    
    try:
        response = requests.get(product_url, headers=HEADERS, timeout=15)
        if response.status_code != 200:
            return details
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract description
        desc_selectors = [
            '.field-type-text-with-summary',
            '.description',
            '#content',
            '.product-description'
        ]
        
        for selector in desc_selectors:
            desc_element = soup.select_one(selector)
            if desc_element:
                details['description'] = clean_text(desc_element.get_text())
                break
        
        # Extract image
        img_element = soup.select_one('img.product-image, img.field-type-image, #content img')
        if img_element and img_element.get('src'):
            details['image_url'] = urljoin(BASE_URL, img_element['src'])
        
        # Extract category from breadcrumbs or taxonomy
        cat_elements = soup.select('.breadcrumb a, .field-name-field-category a, .terms a')
        if cat_elements:
            details['category'] = clean_text(cat_elements[-1].get_text())
            
    except Exception as e:
        print(f"Error getting product details for {product_url}: {e}")
        
    return details

def process_products():
    """Main processing function"""
    print("Starting AllBrand catalog scraper...")
    print(f"Output will be saved to: {OUTPUT_CSV}")
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Get all categories
    categories = get_catalog_categories()
    if not categories:
        print("No categories found, trying main catalog page...")
        categories = [CATALOG_URL]
    
    all_products = []
    
    # Scrape each category
    for i, category_url in enumerate(categories, 1):
        print(f"\nProcessing category {i}/{len(categories)}: {category_url}")
        products = get_products_from_category(category_url)
        all_products.extend(products)
        
        # Rate limiting
        time.sleep(1)
    
    print(f"\nTotal products found: {len(all_products)}")
    
    # Get detailed information for each product
    print("\nGetting product details...")
    for i, product in enumerate(all_products, 1):
        if product['product_url']:
            print(f"  Getting details for {i}/{len(all_products)}: {product['sku']}")
            details = get_product_details(product['product_url'])
            product.update(details)
            time.sleep(0.5)  # Rate limiting
    
    # Prepare CSV data
    print("\nPreparing CSV data...")
    csv_data = []
    
    for product in all_products:
        # Apply AWDP- prefix to SKU (no cipher)
        awdp_sku = f"AWDP-{product['sku']}"
        
        # Apply markup
        original_price = product['price']
        marked_price = apply_markup(original_price)
        
        # Determine category
        category = product.get('category', 'Window Hardware')
        if not category:
            # Extract from URL
            path = urlparse(product['category_url']).path
            category = path.split('/')[-1].replace('-', ' ').title() if path else 'Window Hardware'
        
        csv_row = {
            'sku': awdp_sku,
            'name': clean_text(product['title']),
            'description': clean_text(product.get('description', '')),
            'price': marked_price,
            'originalPrice': original_price,
            'category': category,
            'supplier': 'All Window Door Parts',
            'inStock': True,
            'imageUrl': product.get('image_url', ''),
            'tags': '',
            'compatibleBrands': '',
            'specifications': '{}'
        }
        
        csv_data.append(csv_row)
    
    # Write CSV
    print(f"\nWriting CSV to {OUTPUT_CSV}...")
    
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['sku', 'name', 'description', 'price', 'originalPrice', 'category', 
                     'supplier', 'inStock', 'imageUrl', 'tags', 'compatibleBrands', 'specifications']
        
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_data)
    
    print(f"✓ CSV written successfully with {len(csv_data)} products")
    print(f"✓ File: {OUTPUT_CSV}")
    
    return OUTPUT_CSV

if __name__ == "__main__":
    try:
        output_file = process_products()
        print(f"\n✓ Scraping completed successfully!")
        print(f"✓ Import file: {output_file}")
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()