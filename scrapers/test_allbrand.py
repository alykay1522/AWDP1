"""
Test allbrandwindowdoorparts.com specifically
"""

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

url = 'https://allbrandwindowdoorparts.com'

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
        
        # Look for different URL patterns
        catalog_links = [a['href'] for a in links if '/catalog/' in a['href']]
        content_links = [a['href'] for a in links if '/content/' in a['href']]
        
        print(f"Found {len(catalog_links)} catalog links")
        print(f"Found {len(content_links)} content links")
        
        if catalog_links:
            print(f"Sample catalog URLs:")
            for link in catalog_links[:5]:
                print(f"  {link}")
        
        if content_links:
            print(f"Sample content URLs:")
            for link in content_links[:5]:
                print(f"  {link}")
        
        # Try to access a catalog page
        if catalog_links:
            try:
                cat_url = catalog_links[0]
                print(f"\nTrying catalog page: {cat_url}")
                cat_response = requests.get(cat_url, headers=HEADERS, timeout=15)
                print(f"Catalog status: {cat_response.status_code}")
                
                if cat_response.status_code == 200:
                    cat_soup = BeautifulSoup(cat_response.text, 'html.parser')
                    cat_links = cat_soup.find_all('a', href=True)
                    print(f"Found {len(cat_links)} links on catalog page")
                    
                    # Look for numeric catalog IDs (Drupal style)
                    numeric_links = [a['href'] for a in cat_links if '/catalog/' in a['href'] and any(c.isdigit() for c in a['href'])]
                    print(f"Found {len(numeric_links)} numeric catalog links")
                    
                    if numeric_links:
                        print(f"Sample numeric catalog links:")
                        for link in numeric_links[:5]:
                            print(f"  {link}")
            except Exception as e:
                print(f"Error accessing catalog: {e}")
    
    print(f"Test completed")
    
except Exception as e:
    print(f"ERROR: {e}")