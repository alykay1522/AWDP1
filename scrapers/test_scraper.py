"""
Simple test scraper to debug issues
"""

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def test_site(url):
    print(f"Testing {url}...")
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        print(f"Status: {response.status_code}")
        print(f"Content length: {len(response.text)}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Count links
            links = soup.find_all('a', href=True)
            print(f"Found {len(links)} links")
            
            # Look for product links
            product_links = [a['href'] for a in links if '/product/' in a['href']]
            catalog_links = [a['href'] for a in links if '/catalog/' in a['href']]
            shop_links = [a['href'] for a in links if '/shop/' in a['href']]
            
            print(f"Found {len(product_links)} product links")
            print(f"Found {len(catalog_links)} catalog links")
            print(f"Found {len(shop_links)} shop links")
            
            # Show sample URLs
            if catalog_links:
                print(f"Sample catalog URL: {catalog_links[0]}")
            if shop_links:
                print(f"Sample shop URL: {shop_links[0]}")
            
            if product_links:
                print(f"Sample product URL: {product_links[0]}")
                
                # Try to parse one product
                try:
                    prod_response = requests.get(product_links[0], headers=HEADERS, timeout=15)
                    if prod_response.status_code == 200:
                        prod_soup = BeautifulSoup(prod_response.text, 'html.parser')
                        
                        # Try to find title
                        title_selectors = ['h1.product_title', 'h1.entry-title', 'h1']
                        for selector in title_selectors:
                            element = prod_soup.select_one(selector)
                            if element:
                                print(f"Found title with selector {selector}: {element.get_text()[:50]}")
                                break
                except Exception as e:
                    print(f"Error parsing product: {e}")
            
            # Also try catalog pages
            if catalog_links and not product_links:
                print(f"Trying catalog page instead...")
                try:
                    cat_response = requests.get(catalog_links[0], headers=HEADERS, timeout=15)
                    if cat_response.status_code == 200:
                        cat_soup = BeautifulSoup(cat_response.text, 'html.parser')
                        
                        # Look for products on catalog page
                        cat_product_links = [a['href'] for a in cat_soup.find_all('a', href=True) if '/product/' in a['href']]
                        print(f"Found {len(cat_product_links)} product links on catalog page")
                        
                        if cat_product_links:
                            print(f"Sample: {cat_product_links[0]}")
                except Exception as e:
                    print(f"Error parsing catalog: {e}")
        
        print(f"OK {url} test completed")
        return True
        
    except Exception as e:
        print(f"ERROR with {url}: {e}")
        return False

if __name__ == "__main__":
    print("Testing website connectivity...")
    print("=" * 60)
    
    sites = [
        'https://wefixitusa.com',
        'https://truthentrygard.com',
        'https://allbrandwindowdoorparts.com'
    ]
    
    for site in sites:
        try:
            test_site(site)
            print()
        except Exception as e:
            print(f"CRITICAL ERROR testing {site}: {e}")
            print()