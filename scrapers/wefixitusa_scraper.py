#!/usr/bin/env python3
"""
wefixitusa.com Scraper v3.3 (Final)
- Configurable MARKUP
- Category filtering
- Skip products under $20
- Image download + Price history
"""

import requests
from bs4 import BeautifulSoup
import json
import os
import time
from datetime import datetime
from urllib.parse import urljoin
import hashlib

# ====================== CONFIG ======================
MARKUP = 2.5
MIN_PRICE = 20
BASE_URL = "https://wefixitusa.com"
CATALOG_URL = "https://wefixitusa.forpartsnow.com/order/order.php"
IMAGES_DIR = "images/wefixitusa"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
# ====================================================

os.makedirs(IMAGES_DIR, exist_ok=True)

CATEGORY_KEYWORDS = {
    "Casement Operators": ["casement", "operator", "dual arm", "single arm"],
    "Window Balances": ["balance", "sash balance", "tilt balance"],
    "Patio Door Rollers": ["roller", "patio door", "screen door roller"],
    "Crank Handles": ["crank", "handle", "operator handle"],
    "Pivot Bars": ["pivot", "pivot bar", "bottom pivot"],
    "Locks & Latches": ["lock", "latch", "deadbolt", "handle set"],
    "Weatherstripping": ["weatherstrip", "weather stripping", "seal", "gasket"],
    "Screen Parts": ["screen", "screen frame", "screen spline"],
    "Awning Operators": ["awning", "awning operator"],
    "Double Hung Parts": ["double hung", "sash", "double-hung"],
}

def categorize_product(name):
    if not name:
        return "Uncategorized"
    name_lower = name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name_lower:
                return category
    return "Other Window & Door Parts"

def download_image(url, product_name):
    try:
        if not url or not url.startswith("http"):
            return None
        ext = url.split(".")[-1].split("?")[0][:4]
        filename = hashlib.md5(product_name.encode()).hexdigest()[:12] + f".{ext}"
        filepath = os.path.join(IMAGES_DIR, filename)
        if os.path.exists(filepath):
            return filepath
        resp = requests.get(url, headers=HEADERS, timeout=15, stream=True)
        if resp.status_code == 200:
            with open(filepath, "wb") as f:
                for chunk in resp.iter_content(1024):
                    f.write(chunk)
            return filepath
    except:
        pass
    return None

def get_soup(url):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except:
        return None

def scrape_product_detail(detail_url):
    soup = get_soup(detail_url)
    if not soup:
        return None

    try:
        name = soup.select_one("h1, .product-title").get_text(strip=True) if soup.select_one("h1, .product-title") else None
        price_text = soup.select_one(".price, .product-price").get_text(strip=True) if soup.select_one(".price, .product-price") else None
        stock = soup.select_one(".stock, .availability").get_text(strip=True) if soup.select_one(".stock, .availability") else None
        description = soup.select_one(".description, .product-desc").get_text(strip=True) if soup.select_one(".description, .product-desc") else None

        image_url = None
        img_tag = soup.select_one("img.product-image, .main-image img")
        if img_tag:
            image_url = img_tag.get("src") or img_tag.get("data-src")
            if image_url:
                image_url = urljoin(BASE_URL, image_url)

        local_image = download_image(image_url, name or "unknown") if image_url else None

        supplier_price = None
        retail_price = None
        if price_text:
            try:
                supplier_price = float(price_text.replace("$", "").replace(",", "").strip())
                if supplier_price < MIN_PRICE:
                    return None
                retail_price = round(supplier_price * MARKUP, 2)
            except:
                return None

        category = categorize_product(name)

        return {
            "name": name,
            "price": retail_price,
            "supplier_price": supplier_price,
            "price_text": price_text,
            "stock": stock,
            "description": description[:600] if description else None,
            "image": local_image,
            "category": category,
            "detail_url": detail_url,
            "source": "wefixitusa.com",
            "last_scraped": datetime.now().isoformat()
        }
    except:
        return None

def scrape_wefixitusa():
    print("🔍 Starting wefixitusa.com scrape v3.3...")

    all_products = []
    page = 1
    max_pages = 30

    while page <= max_pages:
        url = f"{CATALOG_URL}?page={page}" if page > 1 else CATALOG_URL
        print(f"  Page {page}...")

        soup = get_soup(url)
        if not soup:
            break

        product_links = [urljoin(BASE_URL, link.get("href")) 
                        for link in soup.select("a[href*='product.php']") if link.get("href")]

        if not product_links:
            break

        for detail_url in product_links:
            product = scrape_product_detail(detail_url)
            if product and product.get("name"):
                all_products.append(product)
            time.sleep(0.6)

        if not soup.select_one("a.next, a[rel='next']"):
            break

        page += 1
        time.sleep(1.0)

    print(f"\n✅ Scraped {len(all_products)} products (≥${MIN_PRICE})")

    merge_with_price_history(all_products)
    return all_products

def merge_with_price_history(new_products):
    products_file = "products.json"
    if os.path.exists(products_file):
        with open(products_file, "r", encoding="utf-8") as f:
            existing = json.load(f)
    else:
        existing = []

    existing_dict = {(p.get("part_number") or p.get("name")): p for p in existing}

    added = updated = 0
    for p in new_products:
        key = p.get("part_number") or p.get("name")
        if not key:
            continue

        if key in existing_dict:
            old = existing_dict[key]
            if p.get("price") and old.get("price") and p["price"] != old["price"]:
                if "price_history" not in old:
                    old["price_history"] = []
                old["price_history"].append({
                    "price": old["price"],
                    "date": datetime.now().isoformat()
                })
            for k, v in p.items():
                if v:
                    old[k] = v
            updated += 1
        else:
            existing_dict[key] = p
            added += 1

    with open(products_file, "w", encoding="utf-8") as f:
        json.dump(list(existing_dict.values()), f, indent=2, ensure_ascii=False)

    print(f"   Added: {added} | Updated: {updated}")

if __name__ == "__main__":
    scrape_wefixitusa()
