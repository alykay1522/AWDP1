import re
import csv
import time
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

START_URLS = [
    "https://biltbestwindowparts.com",
    "https://truthentrygard.com",
    "https://www.oldachparts.com",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# --- helpers -------------------------------------------------------------

def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def get_domain(url: str) -> str:
    return urlparse(url).netloc.replace("www.", "")

def is_same_domain(start_url: str, link: str) -> bool:
    try:
        base = get_domain(start_url)
        target = get_domain(link)
        return base == target or target == ""
    except Exception:
        return False

def looks_like_product_url(url: str, start_url: str) -> bool:
    """Per-site URL pattern matching."""
    domain = get_domain(start_url)
    url_lower = url.lower()

    if "biltbestwindowparts" in domain:
        # Drupal numeric catalog IDs: /catalog/123
        return bool(re.search(r"/catalog/\d+", url_lower))

    if "truthentrygard" in domain or "oldachparts" in domain:
        # WooCommerce: /product/slug/ but not /product-category/
        return "/product/" in url_lower and "/product-category/" not in url_lower

    return False

def extract_rules(text: str):
    if not text:
        return "", "no", "", "", "each", ""

    lower = text.lower()
    notes = []

    # min order qty
    min_order_qty = ""
    m = re.search(r"(minimum order of|minimum order|min\.?\s*order)\s*(of\s*)?(\d+)", lower)
    if m:
        min_order_qty = m.group(3)
        notes.append(m.group(0).strip())

    # sold in pairs
    sold_in_pairs = "no"
    if "sold in pairs" in lower or "pair only" in lower or "pairs only" in lower:
        sold_in_pairs = "yes"
        notes.append("sold in pairs")

    # sold in packs
    sold_in_packs = ""
    m_pack = re.search(r"(pack of|pk of|pkg of)\s*(\d+)", lower)
    if m_pack:
        sold_in_packs = f"pack_of_{m_pack.group(2)}"
        notes.append(m_pack.group(0).strip())

    # min lineal feet
    min_lineal_feet = ""
    unit_type = ""

    patterns_lf = [
        r"(minimum order of|minimum|min\.?)\s*(\d+)\s*(lineal feet|lf|linear feet)",
        r"(\d+)\s*(lineal feet|lf|linear feet)\s*minimum",
    ]
    for pat in patterns_lf:
        m_lf = re.search(pat, lower)
        if m_lf:
            nums = [g for g in m_lf.groups() if g and g.isdigit()]
            if nums:
                min_lineal_feet = nums[0]
                unit_type = "lf"
                notes.append(m_lf.group(0).strip())
                break

    m_sticks = re.search(r"minimum\s*(\d+)\s*sticks?\s*at\s*(\d+)\s*['ft]+", lower)
    if not min_lineal_feet and m_sticks:
        min_lineal_feet = str(int(m_sticks.group(1)) * int(m_sticks.group(2)))
        unit_type = "lf"
        notes.append(m_sticks.group(0).strip())

    m_lengths = re.search(r"(\d+)\s*['ft]+\s*lengths?,?\s*(\d+)\s*(length|piece|pc)\s*minimum", lower)
    if not min_lineal_feet and m_lengths:
        min_lineal_feet = str(int(m_lengths.group(1)) * int(m_lengths.group(2)))
        unit_type = "lf"
        notes.append(m_lengths.group(0).strip())

    if not unit_type:
        if sold_in_pairs == "yes":
            unit_type = "pair"
        elif sold_in_packs:
            unit_type = "pack"
        else:
            unit_type = "each"

    notes_raw_rules = "; ".join(dict.fromkeys(notes))
    return (min_order_qty, sold_in_pairs, sold_in_packs, min_lineal_feet, unit_type, notes_raw_rules)

# --- crawling ------------------------------------------------------------

def get_product_links(start_url: str, max_pages: int = 300):
    visited = set()
    to_visit = [start_url]
    product_links = set()

    while to_visit and len(visited) < max_pages:
        url = to_visit.pop(0)
        if url in visited:
            continue
        visited.add(url)

        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
        except Exception as e:
            print(f"    [skip] {url}: {e}")
            continue

        if resp.status_code != 200:
            continue
        if "text/html" not in resp.headers.get("Content-Type", ""):
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        for a in soup.find_all("a", href=True):
            href = urljoin(url, a["href"].split("#")[0])  # strip fragments
            if not href.startswith("http"):
                continue
            if not is_same_domain(start_url, href):
                continue
            if looks_like_product_url(href, start_url):
                product_links.add(href)
            if href not in visited:
                to_visit.append(href)

        time.sleep(0.25)

    return sorted(product_links)

def parse_product_page(url: str, source_site: str):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=20)
    except Exception as e:
        print(f"    [parse error] {url}: {e}")
        return None

    if resp.status_code != 200:
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # --- title ---
    title = ""
    for sel in ["h1.product_title", "h1.entry-title", "h1.page-title", "h1"]:
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            title = clean_text(el.get_text(strip=True))
            break

    if not title:
        return None  # skip pages without a title

    # --- description: try many selectors in priority order ---
    desc_parts = []

    # WooCommerce short description
    for sel in [
        "div.woocommerce-product-details__short-description",
        "div.product-short-description",
        "div.short-description",
    ]:
        el = soup.select_one(sel)
        if el:
            desc_parts.append(el.get_text(" ", strip=True))

    # WooCommerce / Drupal long description / tab content
    for sel in [
        "div#tab-description",
        "div.woocommerce-tabs div.panel",
        "div.product_description",
        "div.entry-content",
        "div.field-name-body",   # Drupal
        "div.field-items",       # Drupal
        "div.node-content",      # Drupal
        "div.content",
    ]:
        el = soup.select_one(sel)
        if el:
            text = el.get_text(" ", strip=True)
            if len(text) > 30:
                desc_parts.append(text)

    # fallback: all <p> tags in main content area
    if not desc_parts:
        main = soup.select_one("main") or soup.select_one("article") or soup.body
        if main:
            ps = main.find_all("p")
            desc_parts.append(" ".join(p.get_text(" ", strip=True) for p in ps))

    description_raw = clean_text(" ".join(desc_parts))

    (min_order_qty, sold_in_pairs, sold_in_packs,
     min_lineal_feet, unit_type, notes_raw_rules) = extract_rules(description_raw)

    return {
        "product_title":   title,
        "source_site":     source_site,
        "product_url":     url,
        "description_clean": description_raw,
        "min_order_qty":   min_order_qty,
        "sold_in_pairs":   sold_in_pairs,
        "sold_in_packs":   sold_in_packs,
        "min_lineal_feet": min_lineal_feet,
        "unit_type":       unit_type,
        "notes_raw_rules": notes_raw_rules,
    }

# --- main ----------------------------------------------------------------

FIELDNAMES = [
    "product_title", "source_site", "product_url", "description_clean",
    "min_order_qty", "sold_in_pairs", "sold_in_packs",
    "min_lineal_feet", "unit_type", "notes_raw_rules",
]

def main():
    rows = []
    seen_keys = set()

    for start in START_URLS:
        domain = get_domain(start)
        print(f"\nScanning: {start}")

        product_links = get_product_links(start)
        print(f"  Found {len(product_links)} product URLs")

        for link in product_links:
            data = parse_product_page(link, domain)
            if not data:
                continue

            key = (data["source_site"], data["product_title"].lower())
            if key in seen_keys:
                continue
            seen_keys.add(key)

            rows.append(data)
            desc_preview = data["description_clean"][:80].replace("\n", " ")
            print(f"  + {data['product_title'][:55]:<55} | {desc_preview}")

            time.sleep(0.25)

    out_file = "scrapers/awdp_products_scraped.csv"
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone. Wrote {len(rows)} products → {out_file}")

if __name__ == "__main__":
    main()
