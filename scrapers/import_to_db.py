"""
import_to_db.py
--------------
Reads awdp_products_scraped.csv and updates matching products in the AWDP
PostgreSQL database.

What it updates (only when our data is weaker):
  - description    : filled in when our product description is < 80 chars
  - specifications : adds min_order_qty, unit_type, min_lineal_feet keys
  - tags           : appends "sold_in_pairs" or "sold_in_packs:N" when flagged

Matching strategy (in order):
  1. Exact name match (case-insensitive)
  2. Scraped title is a substring of our product name (or vice versa)
  3. Word-overlap ratio >= 0.55 (via difflib)

Run modes:
  python3 scrapers/import_to_db.py            # dry run — shows matches only
  python3 scrapers/import_to_db.py --apply    # writes changes to the database
"""

import os
import csv
import json
import sys
import difflib
import re
import psycopg2
import psycopg2.extras

CSV_FILE  = "scrapers/awdp_products_scraped.csv"
DRY_RUN   = "--apply" not in sys.argv
THRESHOLD = 0.55   # word-overlap ratio for fuzzy matching

# ── DB connection ─────────────────────────────────────────────────────────

def get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return psycopg2.connect(db_url)

# ── name normalisation ────────────────────────────────────────────────────

def normalise(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[^\w\s]", " ", name)   # strip punctuation
    return re.sub(r"\s+", " ", name).strip()

def word_set(name: str):
    return set(normalise(name).split())

def overlap_ratio(a: str, b: str) -> float:
    wa, wb = word_set(a), word_set(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / max(len(wa), len(wb))

def find_match(scraped_title: str, db_products: list) -> dict | None:
    """
    Returns the best matching DB product row, or None.
    db_products is a list of dicts with keys: id, name, description,
    specifications, tags.
    """
    norm_scraped = normalise(scraped_title)

    best = None
    best_score = 0.0

    for prod in db_products:
        norm_db = normalise(prod["name"])

        # 1. Exact
        if norm_scraped == norm_db:
            return prod

        # 2. Substring
        if norm_scraped in norm_db or norm_db in norm_scraped:
            score = 0.90
        else:
            # 3. Word overlap
            score = overlap_ratio(scraped_title, prod["name"])

        if score > best_score:
            best_score = score
            best = prod

    if best and best_score >= THRESHOLD:
        return best
    return None

# ── spec / tag helpers ────────────────────────────────────────────────────

def merged_specs(existing: dict, row: dict) -> dict:
    specs = dict(existing or {})
    if row["min_order_qty"]:
        specs["min_order_qty"] = row["min_order_qty"]
    if row["unit_type"] and row["unit_type"] != "each":
        specs["unit_type"] = row["unit_type"]
    if row["min_lineal_feet"]:
        specs["min_lineal_feet"] = row["min_lineal_feet"] + " lf"
    return specs

def merged_tags(existing: list, row: dict) -> list:
    tags = list(existing or [])
    if row["sold_in_pairs"] == "yes" and "sold_in_pairs" not in tags:
        tags.append("sold_in_pairs")
    if row["sold_in_packs"]:
        tag = f"sold_{row['sold_in_packs']}"   # e.g. sold_pack_of_5
        if tag not in tags:
            tags.append(tag)
    return tags

# ── main ──────────────────────────────────────────────────────────────────

def main():
    # Load CSV
    if not os.path.exists(CSV_FILE):
        print(f"ERROR: {CSV_FILE} not found. Run the scraper first.")
        sys.exit(1)

    with open(CSV_FILE, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"Loaded {len(rows)} scraped products from {CSV_FILE}")
    if DRY_RUN:
        print("DRY RUN — pass --apply to write changes\n")
    else:
        print("APPLY MODE — changes will be written to the database\n")

    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Load all products into memory for matching
    cur.execute("SELECT id, name, description, specifications, tags FROM products")
    db_products = [dict(r) for r in cur.fetchall()]
    print(f"Loaded {len(db_products)} products from database\n")

    matched = 0
    updated = 0
    skipped = 0

    updates = []   # collect for batch apply

    for row in rows:
        if not row["product_title"].strip():
            continue

        match = find_match(row["product_title"], db_products)
        if not match:
            skipped += 1
            continue

        matched += 1

        # Work out what needs changing
        new_desc  = match["description"]
        new_specs = merged_specs(match["specifications"] or {}, row)
        new_tags  = merged_tags(match["tags"] or [], row)

        desc_changed  = False
        specs_changed = new_specs != (match["specifications"] or {})
        tags_changed  = sorted(new_tags) != sorted(match["tags"] or [])

        # Only overwrite description when ours is thin
        if len((match["description"] or "").strip()) < 80 and len(row["description_clean"]) > 40:
            new_desc = row["description_clean"][:2000]  # cap at 2000 chars
            desc_changed = True

        has_changes = desc_changed or specs_changed or tags_changed
        if not has_changes:
            continue

        updated += 1
        updates.append({
            "id":    match["id"],
            "desc":  new_desc,
            "specs": new_specs,
            "tags":  new_tags,
        })

        # Print summary
        score_str = f"  scraped: {row['source_site']} → db: {match['name'][:55]}"
        print(score_str)
        if desc_changed:
            print(f"    description   : (was {len(match['description'])} chars) → {len(new_desc)} chars")
        if specs_changed:
            print(f"    specifications: {new_specs}")
        if tags_changed:
            print(f"    tags          : {new_tags}")
        print()

    print(f"Summary: {matched} matched / {skipped} unmatched / {updated} have changes")

    if DRY_RUN:
        print("\nDry run complete. Run with --apply to commit these changes.")
        cur.close()
        conn.close()
        return

    # Apply updates
    if updates:
        print(f"\nApplying {len(updates)} updates...")
        for u in updates:
            cur.execute(
                """
                UPDATE products
                SET description    = %s,
                    specifications = %s,
                    tags           = %s
                WHERE id = %s
                """,
                (
                    u["desc"],
                    json.dumps(u["specs"]),
                    json.dumps(u["tags"]),
                    u["id"],
                )
            )
        conn.commit()
        print(f"Done. {len(updates)} products updated in the database.")
    else:
        print("No changes to apply.")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
