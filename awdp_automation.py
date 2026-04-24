import requests
import json
import csv
import time
import sys
import re
import os
from collections import defaultdict
from urllib.parse import urljoin
from io import BytesIO
from PIL import Image

CONFIG_FILE = "config_awdp.json"

# ---------- CONFIG & API HELPERS ----------

def load_config():
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def wc_request(config, method, endpoint, params=None, data=None):
    if params is None:
        params = {}
    url = urljoin(config["site_url"].rstrip("/") + "/", f"wp-json/wc/v3/{endpoint.lstrip('/')}")
    auth = (config["consumer_key"], config["consumer_secret"])
    kwargs = {"auth": auth, "timeout": 30}
    if method == "GET":
        kwargs["params"] = params
        resp = requests.get(url, **kwargs)
    elif method == "DELETE":
        params["force"] = True
        kwargs["params"] = params
        resp = requests.delete(url, **kwargs)
    elif method == "PUT":
        kwargs["params"] = params
        kwargs["json"] = data
        resp = requests.put(url, **kwargs)
    else:
        raise ValueError("Unsupported method")
    resp.raise_for_status()
    return resp.json(), resp.headers

def wc_get(config, endpoint, params=None):
    return wc_request(config, "GET", endpoint, params=params)

def wc_delete(config, endpoint):
    return wc_request(config, "DELETE", endpoint)[0]

def wc_put(config, endpoint, data):
    return wc_request(config, "PUT", endpoint, data=data)[0]

# ---------- FETCH PRODUCTS ----------

def fetch_all_products(config, per_page=100):
    print("Fetching products...")
    page = 1
    all_products = []
    while True:
        data, headers = wc_get(config, "products", params={"per_page": per_page, "page": page})
        if not data:
            break
        all_products.extend(data)
        total_pages = int(headers.get("X-WP-TotalPages", "1"))
        print(f"Fetched page {page}/{total_pages} ({len(data)} products)")
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.2)
    print(f"Total products fetched: {len(all_products)}")
    return all_products

# ---------- UTILITIES ----------

def get_primary_category_name(product):
    cats = product.get("categories") or []
    if not cats:
        return ""
    return (cats[0].get("name") or "").strip().lower()

def normalize_name(name):
    if not name:
        return ""
    s = name.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"[^a-z0-9\s]", "", s)
    return s

def round_price(price):
    try:
        return round(float(price), 2)
    except Exception:
        return None

def is_protected_category(cat_name, protected_categories):
    cat_name = (cat_name or "").strip().lower()
    for c in protected_categories:
        if cat_name == c.strip().lower():
            return True
    return False

def is_protected_sku(sku, protected_prefixes):
    sku = (sku or "").strip().upper()
    for p in protected_prefixes:
        if sku.startswith(p.strip().upper()):
            return True
    return False

# ---------- CLEANUP: UNDER PRICE + DUPLICATES ----------

def classify_for_cleanup(products, config):
    price_threshold = float(config.get("delete_price_threshold", 50.0))
    protected_categories = config.get("protected_categories", [])
    protected_sku_prefixes = config.get("protected_sku_prefixes", [])

    under_threshold = []
    dedupe_groups = defaultdict(list)

    for p in products:
        pid = p.get("id")
        name = p.get("name") or ""
        price = p.get("price") or p.get("regular_price") or "0"
        price_val = round_price(price)
        cat_name = get_primary_category_name(p)
        sku = p.get("sku") or ""

        if is_protected_category(cat_name, protected_categories):
            continue
        if is_protected_sku(sku, protected_sku_prefixes):
            continue

        if price_val is not None and price_val < price_threshold:
            under_threshold.append({
                "id": pid,
                "name": name,
                "sku": sku,
                "price": price_val,
                "category": cat_name
            })

        key = (normalize_name(name), price_val, cat_name)
        dedupe_groups[key].append({
            "id": pid,
            "name": name,
            "sku": sku,
            "price": price_val,
            "category": cat_name
        })

    duplicates = []
    for key, items in dedupe_groups.items():
        if len(items) > 1:
            items_sorted = sorted(items, key=lambda x: x["id"])
            keeper = items_sorted[0]
            extras = items_sorted[1:]
            for e in extras:
                e["keeper_id"] = keeper["id"]
                duplicates.append(e)

    return under_threshold, duplicates

# ---------- PRICE MARKUP RULES ----------

def apply_price_rules_to_product(product, rules):
    name = (product.get("name") or "").lower()
    price = product.get("regular_price") or product.get("price") or "0"
    price_val = round_price(price)
    if price_val is None or price_val <= 0:
        return None  # skip

    original_price = price_val
    new_price = price_val

    for rule in rules:
        rtype = rule.get("type")
        if rtype == "name_contains":
            val = (rule.get("value") or "").lower()
            if val and val in name:
                markup = float(rule.get("markup", 0.0))
                new_price = round(new_price * (1.0 + markup), 2)
        elif rtype == "price_over":
            threshold = float(rule.get("threshold", 0.0))
            if price_val > threshold:
                markup = float(rule.get("markup", 0.0))
                new_price = round(new_price * (1.0 + markup), 2)

    if new_price != original_price:
        return new_price
    return None

def build_price_updates(products, config):
    rules = config.get("price_rules", [])
    updates = []
    for p in products:
        pid = p.get("id")
        new_price = apply_price_rules_to_product(p, rules)
        if new_price is not None:
            updates.append({
                "id": pid,
                "name": p.get("name"),
                "old_price": p.get("regular_price") or p.get("price"),
                "new_price": new_price
            })
    return updates

# ---------- IMAGE PROCESSING HOOKS ----------

def ensure_dir(path):
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)

def download_product_images(products, base_dir="images_raw"):
    ensure_dir(base_dir)
    rows = []
    for p in products:
        pid = p.get("id")
        name = p.get("name") or ""
        images = p.get("images") or []
        if not images:
            rows.append({"id": pid, "name": name, "status": "no_images"})
            continue
        for idx, img in enumerate(images):
            src = img.get("src")
            if not src:
                continue
            try:
                r = requests.get(src, timeout=30)
                r.raise_for_status()
                img_bytes = BytesIO(r.content)
                im = Image.open(img_bytes).convert("RGBA")
                filename = os.path.join(base_dir, f"{pid}_{idx}.png")
                im.save(filename)
                rows.append({"id": pid, "name": name, "status": f"downloaded:{filename}"})
            except Exception as e:
                rows.append({"id": pid, "name": name, "status": f"error:{e}"})
    return rows

# Placeholder for overlay logic – you already have a logo pipeline.
# You can plug your existing overlay code here and then re-upload via media API.

# ---------- PRODUCT SYNC HOOK ----------

def product_sync_stub(products, config):
    # Placeholder: define your source of truth (CSV, other sites, etc.)
    # For now, just export current products to a JSON file for your Replit/frontend.
    with open("products_export.json", "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
    print("Exported products_export.json (sync stub).")

# ---------- CSV HELPERS ----------

def write_csv(filename, rows, fieldnames):
    if not rows:
        print(f"No rows to write for {filename}")
        return
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    print(f"Wrote {len(rows)} rows to {filename}")

# ---------- MAIN ----------

def main():
    try:
        config = load_config()
    except FileNotFoundError:
        print(f"Config file {CONFIG_FILE} not found. Create it first.")
        sys.exit(1)

    dry_run = bool(config.get("dry_run", True))

    products = fetch_all_products(config)

    # --- CLEANUP ---
    if config.get("enable_cleanup", True):
        under_threshold, duplicates = classify_for_cleanup(products, config)
        print(f"Products under delete threshold: {len(under_threshold)}")
        print(f"Duplicate products (to delete): {len(duplicates)}")

        write_csv(
            "deleted_under_threshold.csv",
            under_threshold,
            ["id", "name", "sku", "price", "category"]
        )
        write_csv(
            "deleted_duplicates.csv",
            duplicates,
            ["id", "name", "sku", "price", "category", "keeper_id"]
        )

        if not dry_run:
            to_delete_ids = set()
            for item in under_threshold:
                to_delete_ids.add(item["id"])
            for item in duplicates:
                to_delete_ids.add(item["id"])

            print(f"\nAbout to delete {len(to_delete_ids)} unique products...")
            deleted_count = 0
            for pid in sorted(to_delete_ids):
                try:
                    wc_delete(config, f"products/{pid}")
                    deleted_count += 1
                    if deleted_count % 50 == 0:
                        print(f"Deleted {deleted_count} products so far...")
                    time.sleep(0.1)
                except Exception as e:
                    print(f"Error deleting product {pid}: {e}")
            print(f"Done. Deleted {deleted_count} products.")

    # --- PRICE MARKUP ---
    if config.get("enable_price_markup", True):
        price_updates = build_price_updates(products, config)
        print(f"\nProducts needing price update: {len(price_updates)}")
        write_csv(
            "price_updates.csv",
            price_updates,
            ["id", "name", "old_price", "new_price"]
        )
        if not dry_run:
            updated = 0
            for u in price_updates:
                try:
                    wc_put(config, f"products/{u['id']}", {"regular_price": str(u["new_price"])})
                    updated += 1
                    if updated % 50 == 0:
                        print(f"Updated {updated} prices so far...")
                    time.sleep(0.1)
                except Exception as e:
                    print(f"Error updating price for {u['id']}: {e}")
            print(f"Done. Updated {updated} product prices.")

    # --- IMAGE PROCESSING ---
    if config.get("enable_image_processing", False):
        print("\nDownloading product images (raw) for local processing...")
        img_rows = download_product_images(products, base_dir="images_raw")
        write_csv(
            "image_processing_log.csv",
            img_rows,
            ["id", "name", "status"]
        )

    # --- PRODUCT SYNC ---
    if config.get("enable_product_sync", False):
        print("\nRunning product sync stub...")
        product_sync_stub(products, config)

    if dry_run:
        print("\nDRY RUN ENABLED – no deletions or price changes performed.")
        print("Review CSV files, then set dry_run to false in config_awdp.json to actually apply changes.")

if __name__ == "__main__":
    main()
