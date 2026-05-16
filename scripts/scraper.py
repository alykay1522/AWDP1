import requests
import json
import time
import random
import signal
import sys
from bs4 import BeautifulSoup
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://www.allbrandwindowdoorparts.com"
CATALOG_URL = f"{BASE_URL}/catalog"
OUTPUT_FILE = "data/catalog.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

running = True
def handle_interrupt(sig, frame):
    global running
    running = False
    print("\n⚠️ CTRL+C detected — saving partial results...\n")
signal.signal(signal.SIGINT, handle_interrupt)

# ---------------------------------------------------------
# FETCH HELPERS
# ---------------------------------------------------------

def fetch(url, retries=3, delay=2):
    for attempt in range(retries):
        try:
            print(f"Fetching: {url}")
            res = requests.get(url, headers=HEADERS, timeout=20)
            if res.status_code == 200:
                return res.text
            print(f"Non-200 status: {res.status_code}")
        except Exception as e:
            print(f"Error: {e}")

        time.sleep(delay + random.random())

    print(f"❌ Failed after {retries} attempts: {url}")
    return None

# ---------------------------------------------------------
# CATEGORY + PAGINATION
# ---------------------------------------------------------

def get_catalog_pages():
    pages = [CATALOG_URL]
    html = fetch(CATALOG_URL)
    if not html:
        return pages

    soup = BeautifulSoup(html, "html.parser")

    for a in soup.select("a"):
        href = a.get("href", "")
        if "catalog?page=" in href:
            if href.startswith("/"):
                href = BASE_URL + href
            pages.append(href)

    return sorted(list(set(pages)))

def extract_category_name(soup):
    h1 = soup.select_one("h1")
    if not h1:
        return "Uncategorized"
    return h1.get_text(strip=True)

# ---------------------------------------------------------
# PRODUCT LINK EXTRACTION
# ---------------------------------------------------------

def extract_product_links(html):
    soup = BeautifulSoup(html, "html.parser")
    links = []

    for a in soup.select("a"):
        href = a.get("href", "")
        if "/node/" in href or "/product/" in href:
            if href.startswith("/"):
                href = BASE_URL + href
            if href.startswith(BASE_URL):
                links.append(href)

    return list(set(links)), extract_category_name(soup)

# ---------------------------------------------------------
# PRODUCT SCRAPING
# ---------------------------------------------------------

def normalize_sku(raw):
    if not raw:
        return None
    raw = raw.replace("SKU", "").replace(":", "").strip()
    return raw.upper()

def extract_price(soup):
    price_el = soup.find(text=lambda t: "$" in t)
    if not price_el:
        return None
    return price_el.strip()

def scrape_product(url, category):
    html = fetch(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    title_el = soup.select_one("h1")
    title = title_el.get_text(strip=True) if title_el else "Unknown Product"

    desc_el = soup.select_one(".product-description, .description, #description")
    description = desc_el.get_text(" ", strip=True) if desc_el else ""

    images = []
    for img in soup.select("img"):
        src = img.get("src")
        if src and "http" in src:
            images.append(src)

    images = list(set(images))  # dedupe

    sku_el = soup.find(text=lambda t: "SKU" in t.upper())
    sku = normalize_sku(sku_el) if sku_el else None

    price = extract_price(soup)

    return {
        "title": title,
        "description": description,
        "images": images,
        "sku": sku,
        "price": price,
        "category": category,
        "source_url": url
    }

# ---------------------------------------------------------
# MAIN SCRAPER
# ---------------------------------------------------------

def scrape_all():
    print("📡 Fetching catalog pages...")
    pages = get_catalog_pages()
    print(f"📄 Found {len(pages)} catalog pages")

    product_map = {}  # category → list of product URLs

    for page in pages:
        if not running:
            break
        html = fetch(page)
        if not html:
            continue

        links, category = extract_product_links(html)

        if category not in product_map:
            product_map[category] = set()

        for link in links:
            product_map[category].add(link)

    # Flatten for multithreading
    tasks = []
    for category, urls in product_map.items():
        for url in urls:
            tasks.append((url, category))

    print(f"🔗 Total products found: {len(tasks)}")

    results = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(scrape_product, url, category): (url, category)
            for url, category in tasks
        }

        for future in as_completed(futures):
            if not running:
                break
            try:
                data = future.result()
                if data:
                    results.append(data)
            except Exception as e:
                print(f"❌ Error scraping product: {e}")

    return results

# ---------------------------------------------------------
# SAVE OUTPUT
# ---------------------------------------------------------

def save_output(data):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({
            "updated": datetime.utcnow().isoformat(),
            "count": len(data),
            "products": data
        }, f, indent=2)

    print(f"\n💾 Saved {len(data)} products → {OUTPUT_FILE}")

# ---------------------------------------------------------
# ENTRY
# ---------------------------------------------------------

if __name__ == "__main__":
    print("\n🚀 Starting AWDP Catalog Scraper\n")
    data = scrape_all()
    save_output(data)
    print("\n✅ Scraper finished.\n")
